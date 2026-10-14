using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Web.Script.Serialization;

namespace ChatModelli
{
    public sealed class AppSettings
    {
        public bool Log { get; internal set; }
        public string LogLevel { get; internal set; }
        public int ApiTimeoutMs { get; internal set; }
        public bool NonInteractiveMode { get; internal set; }
        public List<ProviderSettings> Providers { get; internal set; }
    }

    public sealed class ProviderSettings
    {
        public string Name { get; internal set; }
        public string ApiBaseUrl { get; internal set; }
        public string ApiKeyTemplate { get; internal set; }
        public List<string> Models { get; internal set; }
        public List<string> Transformers { get; internal set; }
        public bool IsApiKeyAvailable { get; private set; }
        public string MissingApiKeyEnvironmentVariable { get; private set; }
        public string ApiKeyStatusMessage { get; private set; }

        public void CheckApiKeyAvailability()
        {
            MissingApiKeyEnvironmentVariable = null;

            if (String.IsNullOrWhiteSpace(ApiKeyTemplate))
            {
                IsApiKeyAvailable = false;
                ApiKeyStatusMessage = "chiave API non configurata";
                return;
            }

            if (!ApiKeyTemplate.StartsWith("$", StringComparison.Ordinal))
            {
                IsApiKeyAvailable = true;
                ApiKeyStatusMessage = "chiave API configurata";
                return;
            }

            string variableName = ApiKeyTemplate.Substring(1).Trim();
            if (variableName.Length == 0)
            {
                IsApiKeyAvailable = false;
                ApiKeyStatusMessage = "riferimento alla variabile d'ambiente non valido";
                return;
            }

            string value;
            string source;
            if (TryGetEnvironmentVariable(variableName, out value, out source))
            {
                IsApiKeyAvailable = true;
                ApiKeyStatusMessage = "chiave API presente (ambito " + source + ")";
                return;
            }

            IsApiKeyAvailable = false;
            MissingApiKeyEnvironmentVariable = variableName;
            ApiKeyStatusMessage = "variabile d'ambiente mancante: " + variableName;
        }

        public List<ModelChoice> CreateModelChoices()
        {
            List<ModelChoice> choices = new List<ModelChoice>();
            foreach (string model in Models)
            {
                string reason = IsApiKeyAvailable ? String.Empty : ApiKeyStatusMessage;
                choices.Add(new ModelChoice(model, IsApiKeyAvailable, reason));
            }

            return choices;
        }

        public string ResolveApiKey()
        {
            if (String.IsNullOrWhiteSpace(ApiKeyTemplate))
            {
                return String.Empty;
            }

            if (!ApiKeyTemplate.StartsWith("$", StringComparison.Ordinal))
            {
                return ApiKeyTemplate;
            }

            string variableName = ApiKeyTemplate.Substring(1);
            if (String.IsNullOrWhiteSpace(variableName))
            {
                throw new InvalidOperationException("Il riferimento alla variabile d'ambiente della chiave API è vuoto per il provider " + Name + ".");
            }

            string value;
            string source;
            if (!TryGetEnvironmentVariable(variableName, out value, out source))
            {
                throw new InvalidOperationException("La variabile d'ambiente " + variableName + " non è impostata. Impostala e riavvia l'applicazione.");
            }

            return value;
        }

        private static bool TryGetEnvironmentVariable(string variableName, out string value, out string source)
        {
            EnvironmentVariableTarget[] targets =
            {
                EnvironmentVariableTarget.Process,
                EnvironmentVariableTarget.User,
                EnvironmentVariableTarget.Machine
            };

            foreach (EnvironmentVariableTarget target in targets)
            {
                string candidate = Environment.GetEnvironmentVariable(variableName, target);
                if (!String.IsNullOrWhiteSpace(candidate))
                {
                    value = candidate.Trim();
                    source = target.ToString();
                    return true;
                }
            }

            value = null;
            source = null;
            return false;
        }

        public bool UsesTransformer(string transformerName)
        {
            foreach (string transformer in Transformers)
            {
                if (String.Equals(transformer, transformerName, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        public override string ToString()
        {
            return Name;
        }
    }

    public sealed class ModelChoice
    {
        public ModelChoice(string name, bool isEnabled, string disabledReason)
        {
            Name = name;
            IsEnabled = isEnabled;
            DisabledReason = disabledReason ?? String.Empty;
        }

        public string Name { get; private set; }
        public bool IsEnabled { get; private set; }
        public string DisabledReason { get; private set; }

        public string DisplayText
        {
            get
            {
                return IsEnabled ? Name : Name + "  (" + DisabledReason + ")";
            }
        }

        public override string ToString()
        {
            return DisplayText;
        }
    }

    public static class SettingsLoader
    {
        public static AppSettings Load(string path)
        {
            if (String.IsNullOrWhiteSpace(path))
            {
                throw new ArgumentException("Il percorso di settings.json è vuoto.", "path");
            }

            if (!File.Exists(path))
            {
                throw new FileNotFoundException("settings.json non è stato trovato.", path);
            }

            return LoadFromJson(File.ReadAllText(path));
        }

        public static AppSettings LoadFromJson(string json)
        {
            if (String.IsNullOrWhiteSpace(json))
            {
                throw new InvalidDataException("settings.json è vuoto.");
            }

            JavaScriptSerializer serializer = new JavaScriptSerializer();
            serializer.MaxJsonLength = Int32.MaxValue;

            IDictionary<string, object> root;
            try
            {
                root = serializer.DeserializeObject(json) as IDictionary<string, object>;
            }
            catch (InvalidOperationException exception)
            {
                throw new InvalidDataException("settings.json non contiene JSON valido: " + exception.Message, exception);
            }

            if (root == null)
            {
                throw new InvalidDataException("settings.json deve contenere un oggetto JSON.");
            }

            int timeout = ReadInt(root, "API_TIMEOUT_MS", 600000);
            if (timeout <= 0)
            {
                throw new InvalidDataException("API_TIMEOUT_MS deve essere maggiore di zero.");
            }

            List<ProviderSettings> providers = ReadProviders(root);
            if (providers.Count == 0)
            {
                throw new InvalidDataException("settings.json deve contenere almeno un provider in Providers.");
            }

            return new AppSettings
            {
                Log = ReadBool(root, "LOG", false),
                LogLevel = ReadString(root, "LOG_LEVEL", "info").ToLowerInvariant(),
                ApiTimeoutMs = timeout,
                NonInteractiveMode = ReadBool(root, "NON_INTERACTIVE_MODE", false),
                Providers = providers
            };
        }

        private static List<ProviderSettings> ReadProviders(IDictionary<string, object> root)
        {
            object providersValue;
            if (!root.TryGetValue("Providers", out providersValue) || providersValue == null)
            {
                throw new InvalidDataException("Manca la proprietà Providers in settings.json.");
            }

            List<object> values = ReadArray(providersValue, "Providers");
            List<ProviderSettings> providers = new List<ProviderSettings>();

            foreach (object value in values)
            {
                IDictionary<string, object> provider = value as IDictionary<string, object>;
                if (provider == null)
                {
                    throw new InvalidDataException("Ogni elemento di Providers deve essere un oggetto JSON.");
                }

                string name = ReadString(provider, "name", String.Empty).Trim();
                string baseUrl = ReadString(provider, "api_base_url", String.Empty).Trim();
                string keyTemplate = ReadString(provider, "api_key", String.Empty).Trim();
                if (name.Length == 0)
                {
                    throw new InvalidDataException("Ogni provider deve avere un name.");
                }

                Uri apiUri;
                if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out apiUri) ||
                    (apiUri.Scheme != Uri.UriSchemeHttp && apiUri.Scheme != Uri.UriSchemeHttps))
                {
                    throw new InvalidDataException("api_base_url non è un URL HTTP/HTTPS valido per il provider " + name + ".");
                }

                List<string> models = ReadStringArray(provider, "models", name);
                if (models.Count == 0)
                {
                    throw new InvalidDataException("Il provider " + name + " deve avere almeno un modello.");
                }

                ProviderSettings providerSettings = new ProviderSettings
                {
                    Name = name,
                    ApiBaseUrl = baseUrl,
                    ApiKeyTemplate = keyTemplate,
                    Models = models,
                    Transformers = ReadTransformers(provider)
                };
                providerSettings.CheckApiKeyAvailability();
                providers.Add(providerSettings);
            }

            return providers;
        }

        private static List<string> ReadStringArray(IDictionary<string, object> source, string key, string providerName)
        {
            object value;
            if (!source.TryGetValue(key, out value) || value == null)
            {
                throw new InvalidDataException("Manca models per il provider " + providerName + ".");
            }

            List<object> values = ReadArray(value, key + " del provider " + providerName);
            List<string> strings = new List<string>();
            foreach (object item in values)
            {
                string text = item as string;
                if (String.IsNullOrWhiteSpace(text))
                {
                    throw new InvalidDataException("models contiene un valore vuoto per il provider " + providerName + ".");
                }

                strings.Add(text.Trim());
            }

            return strings;
        }

        private static List<string> ReadTransformers(IDictionary<string, object> provider)
        {
            List<string> transformers = new List<string>();
            object transformerValue;
            if (!provider.TryGetValue("transformer", out transformerValue) || transformerValue == null)
            {
                return transformers;
            }

            IDictionary<string, object> transformer = transformerValue as IDictionary<string, object>;
            if (transformer == null)
            {
                throw new InvalidDataException("transformer deve essere un oggetto JSON.");
            }

            object usesValue;
            if (!transformer.TryGetValue("use", out usesValue) || usesValue == null)
            {
                return transformers;
            }

            List<object> values = ReadArray(usesValue, "transformer.use");
            foreach (object value in values)
            {
                string name = value as string;
                if (!String.IsNullOrWhiteSpace(name))
                {
                    transformers.Add(name.Trim());
                }
            }

            return transformers;
        }

        private static List<object> ReadArray(object value, string propertyName)
        {
            IEnumerable enumerable = value as IEnumerable;
            if (enumerable == null || value is string)
            {
                throw new InvalidDataException(propertyName + " deve essere un array JSON.");
            }

            List<object> values = new List<object>();
            foreach (object item in enumerable)
            {
                values.Add(item);
            }

            return values;
        }

        private static string ReadString(IDictionary<string, object> source, string key, string fallback)
        {
            object value;
            if (!source.TryGetValue(key, out value) || value == null)
            {
                return fallback;
            }

            string text = value as string;
            return text ?? Convert.ToString(value);
        }

        private static int ReadInt(IDictionary<string, object> source, string key, int fallback)
        {
            object value;
            if (!source.TryGetValue(key, out value) || value == null)
            {
                return fallback;
            }

            try
            {
                return Convert.ToInt32(value);
            }
            catch (Exception exception)
            {
                throw new InvalidDataException(key + " deve essere un numero intero.", exception);
            }
        }

        private static bool ReadBool(IDictionary<string, object> source, string key, bool fallback)
        {
            object value;
            if (!source.TryGetValue(key, out value) || value == null)
            {
                return fallback;
            }

            try
            {
                return Convert.ToBoolean(value);
            }
            catch (Exception exception)
            {
                throw new InvalidDataException(key + " deve essere true o false.", exception);
            }
        }
    }
}
