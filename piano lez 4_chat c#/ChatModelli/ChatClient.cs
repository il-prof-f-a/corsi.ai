using System;
using System.Collections;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace ChatModelli
{
    public sealed class ChatTurn
    {
        public ChatTurn(string role, string content)
        {
            Role = role;
            Content = content;
        }

        public string Role { get; private set; }
        public string Content { get; private set; }
    }

    public sealed class ChatClient : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly JavaScriptSerializer _serializer;
        private readonly AppLogger _logger;

        public ChatClient(int timeoutMs)
            : this(timeoutMs, null)
        {
        }

        public ChatClient(int timeoutMs, AppLogger logger)
        {
            _logger = logger;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromMilliseconds(timeoutMs);
            _serializer = new JavaScriptSerializer();
            _serializer.MaxJsonLength = Int32.MaxValue;
        }

        public async Task<string> SendAsync(ProviderSettings provider, string model, IList<ChatTurn> history)
        {
            if (provider == null)
            {
                throw new ArgumentNullException("provider");
            }

            if (String.IsNullOrWhiteSpace(model))
            {
                throw new ArgumentException("Seleziona un modello.", "model");
            }

            string apiKey = provider.ResolveApiKey();
            if (String.IsNullOrWhiteSpace(apiKey))
            {
                throw new InvalidOperationException("La chiave API del provider " + provider.Name + " è vuota.");
            }

            string dialect = GetDialect(provider);
            string endpoint = GetEndpoint(provider, model, dialect);
            Dictionary<string, object> body = BuildRequestBody(model, history, dialect);
            int messageCount = history == null ? 0 : history.Count;
            int lastMessageChars = 0;
            if (history != null && history.Count > 0 && history[history.Count - 1].Content != null)
            {
                lastMessageChars = history[history.Count - 1].Content.Length;
            }

            if (_logger != null)
            {
                _logger.Write("debug", BuildDebugRequestSummary(dialect, endpoint, model, messageCount, lastMessageChars));
            }

            DateTime requestStartedUtc = DateTime.UtcNow;

            using (HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, endpoint))
            {
                request.Content = new StringContent(_serializer.Serialize(body), Encoding.UTF8, "application/json");
                AddAuthentication(request, apiKey, dialect);

                try
                {
                    using (HttpResponseMessage response = await _httpClient.SendAsync(request).ConfigureAwait(false))
                    {
                        string responseBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                        string requestId = GetRequestId(response);
                        if (!response.IsSuccessStatusCode)
                        {
                            if (_logger != null)
                            {
                                _logger.Write("debug", "Risposta HTTP non riuscita. Status=" + (int)response.StatusCode + " " + response.ReasonPhrase + "; elapsed_ms=" + (long)(DateTime.UtcNow - requestStartedUtc).TotalMilliseconds + "; request_id=" + requestId + "; " + BuildErrorDiagnostic(responseBody) + ".");
                            }

                            throw new InvalidOperationException("HTTP " + (int)response.StatusCode + " " + response.ReasonPhrase + ": " + LimitText(responseBody));
                        }

                        if (_logger != null)
                        {
                            _logger.Write("debug", "Risposta HTTP riuscita. Status=" + (int)response.StatusCode + "; elapsed_ms=" + (long)(DateTime.UtcNow - requestStartedUtc).TotalMilliseconds + "; response_chars=" + responseBody.Length + "; request_id=" + requestId + ".");
                        }

                        return ParseResponse(responseBody, dialect);
                    }
                }
                catch (TaskCanceledException exception)
                {
                    if (_logger != null)
                    {
                        _logger.Write("debug", "Timeout richiesta HTTP dopo " + (long)(DateTime.UtcNow - requestStartedUtc).TotalMilliseconds + " ms; tipo=" + exception.GetType().Name + ".");
                    }

                    throw new InvalidOperationException("La richiesta ha superato il timeout configurato in API_TIMEOUT_MS.", exception);
                }
                catch (HttpRequestException exception)
                {
                    if (_logger != null)
                    {
                        _logger.Write("debug", "Errore di trasporto HTTP dopo " + (long)(DateTime.UtcNow - requestStartedUtc).TotalMilliseconds + " ms; tipo=" + exception.GetType().Name + "; messaggio=" + exception.Message + ".");
                    }

                    throw;
                }
            }
        }

        public void Dispose()
        {
            _httpClient.Dispose();
        }

        internal static string BuildDebugRequestSummary(string dialect, string endpoint, string model, int messageCount, int lastMessageChars)
        {
            return "Richiesta HTTP. dialect=" + dialect + "; endpoint=" + endpoint + "; model=" + model + "; messages=" + messageCount + "; last_message_chars=" + lastMessageChars + ".";
        }

        internal static string BuildErrorDiagnostic(string json)
        {
            string responseText = json ?? String.Empty;
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                IDictionary<string, object> root = serializer.DeserializeObject(responseText) as IDictionary<string, object>;
                IDictionary<string, object> error = AsDictionary(GetValue(root, "error"));
                if (error != null)
                {
                    string type = GetValue(error, "type") as string;
                    string message = GetValue(error, "message") as string;
                    return "error_type=" + (String.IsNullOrWhiteSpace(type) ? "unknown" : LimitText(type)) + "; error_message=" + (String.IsNullOrWhiteSpace(message) ? "dettaglio non fornito" : LimitText(message));
                }
            }
            catch (InvalidOperationException)
            {
                // Nei log diagnostici evitiamo di copiare risposte non strutturate.
            }

            return "response_chars=" + responseText.Length;
        }

        private static string GetRequestId(HttpResponseMessage response)
        {
            IEnumerable<string> values;
            if (response.Headers.TryGetValues("request-id", out values))
            {
                return String.Join(",", values);
            }

            return "non fornito";
        }

        private static string GetDialect(ProviderSettings provider)
        {
            if (String.Equals(provider.Name, "anthropic", StringComparison.OrdinalIgnoreCase) || provider.UsesTransformer("Anthropic"))
            {
                return "anthropic";
            }

            if (String.Equals(provider.Name, "gemini", StringComparison.OrdinalIgnoreCase) || provider.UsesTransformer("gemini"))
            {
                return "gemini";
            }

            return "openai";
        }

        private static string GetEndpoint(ProviderSettings provider, string model, string dialect)
        {
            if (!String.Equals(dialect, "gemini", StringComparison.Ordinal))
            {
                return provider.ApiBaseUrl;
            }

            string baseUrl = provider.ApiBaseUrl.TrimEnd('/');
            if (baseUrl.EndsWith(":generateContent", StringComparison.OrdinalIgnoreCase))
            {
                return baseUrl;
            }

            return baseUrl + "/" + Uri.EscapeDataString(model) + ":generateContent";
        }

        private static Dictionary<string, object> BuildRequestBody(string model, IList<ChatTurn> history, string dialect)
        {
            if (String.Equals(dialect, "anthropic", StringComparison.Ordinal))
            {
                return BuildAnthropicBody(model, history);
            }

            if (String.Equals(dialect, "gemini", StringComparison.Ordinal))
            {
                return BuildGeminiBody(history);
            }

            return BuildOpenAiBody(model, history);
        }

        private static Dictionary<string, object> BuildOpenAiBody(string model, IList<ChatTurn> history)
        {
            List<object> messages = new List<object>();
            foreach (ChatTurn turn in history)
            {
                messages.Add(new Dictionary<string, object>
                {
                    { "role", turn.Role },
                    { "content", turn.Content }
                });
            }

            return new Dictionary<string, object>
            {
                { "model", model },
                { "messages", messages }
            };
        }

        private static Dictionary<string, object> BuildAnthropicBody(string model, IList<ChatTurn> history)
        {
            List<object> messages = new List<object>();
            foreach (ChatTurn turn in history)
            {
                messages.Add(new Dictionary<string, object>
                {
                    { "role", turn.Role },
                    { "content", turn.Content }
                });
            }

            return new Dictionary<string, object>
            {
                { "model", model },
                { "max_tokens", 4096 },
                { "messages", messages }
            };
        }

        private static Dictionary<string, object> BuildGeminiBody(IList<ChatTurn> history)
        {
            List<object> contents = new List<object>();
            foreach (ChatTurn turn in history)
            {
                string role = String.Equals(turn.Role, "assistant", StringComparison.OrdinalIgnoreCase) ? "model" : "user";
                contents.Add(new Dictionary<string, object>
                {
                    {
                        "role", role
                    },
                    {
                        "parts", new List<object>
                        {
                            new Dictionary<string, object> { { "text", turn.Content } }
                        }
                    }
                });
            }

            return new Dictionary<string, object>
            {
                { "contents", contents }
            };
        }

        private static void AddAuthentication(HttpRequestMessage request, string apiKey, string dialect)
        {
            if (String.Equals(dialect, "anthropic", StringComparison.Ordinal))
            {
                request.Headers.TryAddWithoutValidation("x-api-key", apiKey);
                request.Headers.TryAddWithoutValidation("anthropic-version", "2023-06-01");
                return;
            }

            if (String.Equals(dialect, "gemini", StringComparison.Ordinal))
            {
                request.Headers.TryAddWithoutValidation("x-goog-api-key", apiKey);
                return;
            }

            request.Headers.TryAddWithoutValidation("Authorization", "Bearer " + apiKey);
        }

        private string ParseResponse(string json, string dialect)
        {
            IDictionary<string, object> root;
            try
            {
                root = _serializer.DeserializeObject(json) as IDictionary<string, object>;
            }
            catch (InvalidOperationException exception)
            {
                throw new InvalidOperationException("Il provider ha restituito una risposta JSON non valida: " + exception.Message, exception);
            }

            if (root == null)
            {
                throw new InvalidOperationException("Il provider ha restituito una risposta vuota o non valida.");
            }

            string text;
            if (String.Equals(dialect, "anthropic", StringComparison.Ordinal))
            {
                text = ReadText(root, "content");
            }
            else if (String.Equals(dialect, "gemini", StringComparison.Ordinal))
            {
                List<object> candidates = ReadArrayValue(GetValue(root, "candidates"));
                text = candidates.Count == 0 ? null : ReadText(AsDictionary(candidates[0]), "content", "parts");
            }
            else
            {
                List<object> choices = ReadArrayValue(GetValue(root, "choices"));
                if (choices.Count == 0)
                {
                    throw new InvalidOperationException("La risposta OpenAI-compatible non contiene choices. Dettaglio: " + ReadError(root));
                }

                IDictionary<string, object> choice = AsDictionary(choices[0]);
                IDictionary<string, object> message = AsDictionary(GetValue(choice, "message"));
                text = ExtractText(GetValue(message, "content"));
            }

            if (String.IsNullOrWhiteSpace(text))
            {
                string detail = ReadError(root);
                if (detail.Length == 0)
                {
                    detail = "la risposta non contiene testo leggibile";
                }

                throw new InvalidOperationException("Il provider non ha restituito testo: " + detail);
            }

            return text;
        }

        private static string ReadText(IDictionary<string, object> source, string key)
        {
            return ExtractText(GetValue(source, key));
        }

        private static string ReadText(IDictionary<string, object> source, string parentKey, string childKey)
        {
            IDictionary<string, object> parent = AsDictionary(GetValue(source, parentKey));
            return parent == null ? null : ExtractText(GetValue(parent, childKey));
        }

        private static string ExtractText(object value)
        {
            string directText = value as string;
            if (directText != null)
            {
                return directText;
            }

            IEnumerable enumerable = value as IEnumerable;
            if (enumerable == null)
            {
                return null;
            }

            StringBuilder text = new StringBuilder();
            foreach (object item in enumerable)
            {
                IDictionary<string, object> block = AsDictionary(item);
                if (block == null)
                {
                    continue;
                }

                string blockText = GetValue(block, "text") as string;
                if (!String.IsNullOrEmpty(blockText))
                {
                    if (text.Length > 0)
                    {
                        text.AppendLine();
                    }

                    text.Append(blockText);
                }
            }

            return text.ToString();
        }

        private static string ReadError(IDictionary<string, object> root)
        {
            IDictionary<string, object> error = AsDictionary(GetValue(root, "error"));
            if (error != null)
            {
                string message = GetValue(error, "message") as string;
                if (!String.IsNullOrWhiteSpace(message))
                {
                    return message;
                }
            }

            IDictionary<string, object> feedback = AsDictionary(GetValue(root, "promptFeedback"));
            if (feedback != null)
            {
                string reason = GetValue(feedback, "blockReason") as string;
                if (!String.IsNullOrWhiteSpace(reason))
                {
                    return "prompt bloccato: " + reason;
                }
            }

            return String.Empty;
        }

        private static IDictionary<string, object> AsDictionary(object value)
        {
            return value as IDictionary<string, object>;
        }

        private static object GetValue(IDictionary<string, object> source, string key)
        {
            if (source == null)
            {
                return null;
            }

            object value;
            return source.TryGetValue(key, out value) ? value : null;
        }

        private static List<object> ReadArrayValue(object value)
        {
            List<object> items = new List<object>();
            IEnumerable enumerable = value as IEnumerable;
            if (enumerable == null || value is string)
            {
                return items;
            }

            foreach (object item in enumerable)
            {
                items.Add(item);
            }

            return items;
        }

        private static string LimitText(string text)
        {
            if (String.IsNullOrWhiteSpace(text))
            {
                return "nessun dettaglio fornito dal server";
            }

            const int maximumLength = 4000;
            return text.Length <= maximumLength ? text : text.Substring(0, maximumLength) + "...";
        }
    }
}
