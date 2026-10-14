using System;
using System.Collections;
using System.IO;
using System.Reflection;

internal static class SettingsSmokeTest
{
    private const string MissingKeyJson = @"{
      ""Providers"": [
        {
          ""name"": ""missing-provider"",
          ""api_base_url"": ""http://localhost/test"",
          ""api_key"": ""$CHATMODELLI_SMOKE_UNSET_KEY"",
          ""models"": [""unavailable-model""]
        }
      ]
    }";

    private const string LiteralKeyJson = @"{
      ""Providers"": [
        {
          ""name"": ""ollama"",
          ""api_base_url"": ""http://localhost:11434/v1/chat/completions"",
          ""api_key"": ""ollama"",
          ""models"": [""local-model""]
        }
      ]
    }";

    private const string SampleJson = @"{
      ""LOG"": true,
      ""LOG_LEVEL"": ""info"",
      ""API_TIMEOUT_MS"": 600000,
      ""NON_INTERACTIVE_MODE"": false,
      ""Providers"": [
        {
          ""name"": ""smoke-provider"",
          ""api_base_url"": ""http://localhost/test"",
          ""api_key"": ""$CHATMODELLI_SMOKE_KEY"",
          ""models"": [""model-a"", ""model-b""]
        }
      ]
    }";

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length != 1)
            {
                throw new InvalidOperationException("Passare il percorso di ChatModelli.exe.");
            }

            string assemblyPath = Path.GetFullPath(args[0]);
            if (!File.Exists(assemblyPath))
            {
                throw new InvalidOperationException("ChatModelli.exe non esiste ancora: SettingsSmokeTest ha rilevato la funzionalità mancante.");
            }

            Assembly appAssembly = Assembly.LoadFrom(assemblyPath);
            Type loaderType = appAssembly.GetType("ChatModelli.SettingsLoader", false);
            Assert(loaderType != null, "Deve esistere ChatModelli.SettingsLoader.");

            MethodInfo loadMethod = loaderType.GetMethod("LoadFromJson", BindingFlags.Public | BindingFlags.Static);
            Assert(loadMethod != null, "Deve esistere SettingsLoader.LoadFromJson(string).");

            Environment.SetEnvironmentVariable("CHATMODELLI_SMOKE_KEY", "smoke-secret");
            Environment.SetEnvironmentVariable("CHATMODELLI_SMOKE_UNSET_KEY", null);
            object settings = loadMethod.Invoke(null, new object[] { SampleJson });

            Assert(ReadProperty(settings, "ApiTimeoutMs").Equals(600000), "Il timeout deve essere letto dal JSON.");

            IEnumerable providers = (IEnumerable)ReadProperty(settings, "Providers");
            IEnumerator providerEnumerator = providers.GetEnumerator();
            Assert(providerEnumerator.MoveNext(), "Deve essere caricato almeno un provider.");
            object provider = providerEnumerator.Current;

            Assert(ReadProperty(provider, "Name").Equals("smoke-provider"), "Il nome provider deve essere caricato.");
            Assert(ReadProperty(provider, "ApiBaseUrl").Equals("http://localhost/test"), "L'URL API deve essere caricato.");
            Assert(InvokeMethod(provider, "ResolveApiKey").Equals("smoke-secret"), "La chiave $VAR deve essere risolta da una variabile d'ambiente.");
            Assert(ReadProperty(provider, "IsApiKeyAvailable").Equals(true), "Una variabile d'ambiente valorizzata deve rendere disponibile il provider.");
            Assert(ReadProperty(provider, "MissingApiKeyEnvironmentVariable") == null, "Una chiave presente non deve avere una variabile mancante.");
            object availableModel = FirstModelChoice(provider);
            Assert(ReadProperty(availableModel, "IsEnabled").Equals(true), "I modelli con credenziale disponibile devono essere selezionabili.");
            VerifyUserScopeEnvironmentVariable(loadMethod);

            IEnumerable models = (IEnumerable)ReadProperty(provider, "Models");
            IEnumerator modelEnumerator = models.GetEnumerator();
            Assert(modelEnumerator.MoveNext() && modelEnumerator.Current.Equals("model-a"), "Il primo modello deve essere caricato.");
            Assert(modelEnumerator.MoveNext() && modelEnumerator.Current.Equals("model-b"), "Il secondo modello deve essere caricato.");
            Assert(!modelEnumerator.MoveNext(), "Non devono esserci modelli aggiuntivi.");

            string distributedSettingsPath = Path.Combine(Path.GetDirectoryName(assemblyPath), "settings.json");
            Assert(File.Exists(distributedSettingsPath), "settings.json deve essere copiato accanto all'eseguibile.");
            object distributedSettings = loadMethod.Invoke(null, new object[] { File.ReadAllText(distributedSettingsPath) });
            IEnumerable distributedProviders = (IEnumerable)ReadProperty(distributedSettings, "Providers");
            int providerCount = 0;
            foreach (object ignoredProvider in distributedProviders)
            {
                providerCount++;
            }

            Assert(providerCount == 4, "La configurazione distribuita deve contenere i quattro provider attivi dell'esempio.");
            Assert(HasModel(distributedSettings, "openai", "gpt-6-luna"), "Deve essere disponibile GPT-6 Luna.");
            Assert(HasModel(distributedSettings, "anthropic", "claude-opus-5-5"), "Deve essere disponibile Claude Opus 5.5.");
            Assert(HasModel(distributedSettings, "anthropic", "claude-sonnet-5-5"), "Deve essere disponibile Claude Sonnet 5.5.");
            Assert(HasModel(distributedSettings, "anthropic", "claude-fable-5-1"), "Deve essere disponibile Claude Fable 5.1.");
            Assert(HasModel(distributedSettings, "anthropic", "claude-haiku-5-5"), "Deve essere disponibile Claude Haiku 5.5.");
            Assert(HasModel(distributedSettings, "ollama", "SparkLLM/Spark-X2.5-4B"), "Deve essere disponibile Spark-X2.5-4B su Ollama.");
            Assert(HasModel(distributedSettings, "gemini", "gemini-4-argon"), "Deve essere disponibile il modello Gemini aggiornato.");

            object missingSettings = loadMethod.Invoke(null, new object[] { MissingKeyJson });
            object missingProvider = FirstItem((IEnumerable)ReadProperty(missingSettings, "Providers"));
            Assert(ReadProperty(missingProvider, "IsApiKeyAvailable").Equals(false), "Una variabile d'ambiente assente deve rendere il provider non disponibile.");
            Assert(ReadProperty(missingProvider, "MissingApiKeyEnvironmentVariable").Equals("CHATMODELLI_SMOKE_UNSET_KEY"), "Deve essere indicato il nome della variabile d'ambiente mancante.");
            object unavailableModel = FirstModelChoice(missingProvider);
            Assert(ReadProperty(unavailableModel, "IsEnabled").Equals(false), "I modelli senza credenziale devono essere disabilitati.");
            Assert(ReadProperty(unavailableModel, "DisplayText").ToString().Contains("CHATMODELLI_SMOKE_UNSET_KEY"), "La voce disabilitata deve spiegare quale variabile manca.");

            object literalSettings = loadMethod.Invoke(null, new object[] { LiteralKeyJson });
            object literalProvider = FirstItem((IEnumerable)ReadProperty(literalSettings, "Providers"));
            Assert(ReadProperty(literalProvider, "IsApiKeyAvailable").Equals(true), "Una chiave letterale come quella di Ollama deve lasciare disponibile il provider.");
            Assert(InvokeMethod(literalProvider, "ResolveApiKey").Equals("ollama"), "La chiave letterale di Ollama deve restare invariata.");

            VerifyFormAvailability(appAssembly, loadMethod, MissingKeyJson, false);
            VerifyFormAvailability(appAssembly, loadMethod, SampleJson, true);

            Console.WriteLine("PASS: configurazione, disponibilità delle credenziali e stato dei modelli.");
            return 0;
        }
        catch (Exception exception)
        {
            Exception cause = exception is TargetInvocationException && exception.InnerException != null
                ? exception.InnerException
                : exception;
            Console.Error.WriteLine("FAIL: " + cause.Message);
            return 1;
        }
    }

    private static object ReadProperty(object instance, string name)
    {
        PropertyInfo property = instance.GetType().GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
        if (property == null)
        {
            throw new InvalidOperationException("Manca la proprietà " + name + ".");
        }

        return property.GetValue(instance, null);
    }

    private static bool HasModel(object settings, string providerName, string modelName)
    {
        IEnumerable providers = (IEnumerable)ReadProperty(settings, "Providers");
        foreach (object provider in providers)
        {
            if (!ReadProperty(provider, "Name").Equals(providerName))
            {
                continue;
            }

            IEnumerable models = (IEnumerable)ReadProperty(provider, "Models");
            foreach (object model in models)
            {
                if (model.Equals(modelName))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static object FirstModelChoice(object provider)
    {
        return FirstItem((IEnumerable)InvokeMethod(provider, "CreateModelChoices"));
    }

    private static object FirstItem(IEnumerable items)
    {
        IEnumerator enumerator = items.GetEnumerator();
        if (!enumerator.MoveNext())
        {
            throw new InvalidOperationException("La sequenza attesa è vuota.");
        }

        return enumerator.Current;
    }

    private static void VerifyFormAvailability(Assembly appAssembly, MethodInfo loadMethod, string json, bool expectedAvailable)
    {
        Type formType = appAssembly.GetType("ChatModelli.MainForm", true);
        object form = Activator.CreateInstance(formType);
        IDisposable disposableForm = form as IDisposable;

        try
        {
            object settings = loadMethod.Invoke(null, new object[] { json });
            SetField(form, "_settings", settings);
            SetProperty(ReadField(form, "_providerCombo"), "Enabled", true);
            SetProperty(ReadField(form, "_modelCombo"), "Enabled", true);

            if (expectedAvailable)
            {
                Type chatClientType = appAssembly.GetType("ChatModelli.ChatClient", true);
                object chatClient = Activator.CreateInstance(chatClientType, new object[] { 600000 });
                SetField(form, "_chatClient", chatClient);
            }

            object providerCombo = ReadField(form, "_providerCombo");
            SetProperty(providerCombo, "DataSource", ReadProperty(settings, "Providers"));

            object modelCombo = ReadField(form, "_modelCombo");
            object sendButton = ReadField(form, "_sendButton");
            int selectedIndex = (int)ReadProperty(modelCombo, "SelectedIndex");

            if (expectedAvailable)
            {
                Assert(selectedIndex == 0, "Il provider configurato deve selezionare il primo modello all'avvio.");
                Assert(ReadProperty(sendButton, "Enabled").Equals(true), "Il pulsante Invia deve essere attivo con un modello configurato.");
            }
            else
            {
                Assert(selectedIndex == -1, "Il provider senza chiave non deve selezionare un modello all'avvio.");
                Assert(ReadProperty(modelCombo, "Enabled").Equals(true), "La lista dei modelli disabilitati deve restare consultabile.");
                Assert(ReadProperty(sendButton, "Enabled").Equals(false), "Il pulsante Invia deve essere disattivato senza chiave.");

                SetProperty(modelCombo, "SelectedIndex", 0);
                MethodInfo selectionCommitted = formType.GetMethod("ModelSelectionCommitted", BindingFlags.NonPublic | BindingFlags.Instance);
                Assert(selectionCommitted != null, "Deve esistere la protezione della selezione dei modelli disabilitati.");
                selectionCommitted.Invoke(form, new object[] { modelCombo, EventArgs.Empty });
                Assert(ReadProperty(modelCombo, "SelectedIndex").Equals(-1), "Un modello disabilitato non deve poter restare selezionato.");
                Assert(ReadProperty(sendButton, "Enabled").Equals(false), "Il pulsante Invia deve restare disattivato dopo il tentativo di selezione.");
            }
        }
        finally
        {
            if (disposableForm != null)
            {
                disposableForm.Dispose();
            }
        }
    }

    private static void VerifyUserScopeEnvironmentVariable(MethodInfo loadMethod)
    {
        string variableName = "CHATMODELLI_SMOKE_USER_KEY_" + Guid.NewGuid().ToString("N");
        string previousProcessValue = Environment.GetEnvironmentVariable(variableName, EnvironmentVariableTarget.Process);
        string previousUserValue = Environment.GetEnvironmentVariable(variableName, EnvironmentVariableTarget.User);

        try
        {
            Environment.SetEnvironmentVariable(variableName, null, EnvironmentVariableTarget.Process);
            Environment.SetEnvironmentVariable(variableName, "user-scope-secret", EnvironmentVariableTarget.User);

            string json = @"{
              ""Providers"": [
                {
                  ""name"": ""user-scope-provider"",
                  ""api_base_url"": ""http://localhost/test"",
                  ""api_key"": ""$" + variableName + @""",
                  ""models"": [""user-scope-model""]
                }
              ]
            }";

            object settings = loadMethod.Invoke(null, new object[] { json });
            object provider = FirstItem((IEnumerable)ReadProperty(settings, "Providers"));

            Assert(ReadProperty(provider, "IsApiKeyAvailable").Equals(true), "Una variabile d'ambiente impostata a livello Utente deve rendere disponibile il provider.");
            Assert(InvokeMethod(provider, "ResolveApiKey").Equals("user-scope-secret"), "La chiave impostata a livello Utente deve essere risolta.");
            Assert(ReadProperty(provider, "ApiKeyStatusMessage").ToString().Contains("User"), "Lo stato deve indicare che la chiave proviene dall'ambito Utente.");
        }
        finally
        {
            Environment.SetEnvironmentVariable(variableName, previousProcessValue, EnvironmentVariableTarget.Process);
            Environment.SetEnvironmentVariable(variableName, previousUserValue, EnvironmentVariableTarget.User);
        }
    }

    private static object ReadField(object instance, string name)
    {
        FieldInfo field = instance.GetType().GetField(name, BindingFlags.NonPublic | BindingFlags.Instance);
        if (field == null)
        {
            throw new InvalidOperationException("Manca il campo " + name + ".");
        }

        return field.GetValue(instance);
    }

    private static void SetField(object instance, string name, object value)
    {
        FieldInfo field = instance.GetType().GetField(name, BindingFlags.NonPublic | BindingFlags.Instance);
        if (field == null)
        {
            throw new InvalidOperationException("Manca il campo " + name + ".");
        }

        field.SetValue(instance, value);
    }

    private static void SetProperty(object instance, string name, object value)
    {
        PropertyInfo property = instance.GetType().GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
        if (property == null)
        {
            throw new InvalidOperationException("Manca la proprietà " + name + ".");
        }

        property.SetValue(instance, value, null);
    }

    private static object InvokeMethod(object instance, string name)
    {
        MethodInfo method = instance.GetType().GetMethod(name, BindingFlags.Public | BindingFlags.Instance);
        if (method == null)
        {
            throw new InvalidOperationException("Manca il metodo " + name + ".");
        }

        return method.Invoke(instance, null);
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
