using System;
using System.Collections;
using System.Reflection;

internal static class CopilotProviderSmokeTest
{
    private const string CopilotJson = @"{
      ""Providers"": [
        {
          ""name"": ""github-copilot"",
          ""type"": ""copilot"",
          ""api_key"": ""$CHATMODELLI_COPILOT_SMOKE_KEY"",
          ""models"": []
        }
      ]
    }";

    private static int Main(string[] args)
    {
        try
        {
            if (args.Length != 1)
            {
                throw new InvalidOperationException("Passare il percorso di ChatModelli.exe.");
            }

            Environment.SetEnvironmentVariable("CHATMODELLI_COPILOT_SMOKE_KEY", "smoke-secret");
            Assembly assembly = Assembly.LoadFrom(args[0]);
            Type loaderType = assembly.GetType("ChatModelli.SettingsLoader", true);
            MethodInfo load = loaderType.GetMethod("LoadFromJson", BindingFlags.Public | BindingFlags.Static);
            object settings = load.Invoke(null, new object[] { CopilotJson });
            object provider = First((IEnumerable)ReadProperty(settings, "Providers"));

            Assert(ReadProperty(provider, "Name").Equals("github-copilot"), "Il provider Copilot deve essere riconosciuto.");
            Assert(ReadProperty(provider, "Type").Equals("copilot"), "Il tipo copilot deve essere conservato dalla configurazione.");
            Assert(ReadProperty(provider, "ApiBaseUrl").Equals(String.Empty), "Copilot SDK non deve richiedere un endpoint HTTP.");
            Assert(ReadProperty(provider, "IsApiKeyAvailable").Equals(true), "La chiave d'ambiente deve abilitare il provider Copilot.");
            Assert(ReadProperty(provider, "Models") != null && !((IEnumerable)ReadProperty(provider, "Models")).GetEnumerator().MoveNext(), "I modelli Copilot devono poter essere caricati dinamicamente.");

            Console.WriteLine("CopilotProviderSmokeTest: OK");
            return 0;
        }
        catch (Exception exception)
        {
            Exception cause = exception is TargetInvocationException && exception.InnerException != null
                ? exception.InnerException
                : exception;
            Console.Error.WriteLine("CopilotProviderSmokeTest: FAIL: " + cause.Message);
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

    private static object First(IEnumerable values)
    {
        IEnumerator enumerator = values.GetEnumerator();
        if (!enumerator.MoveNext())
        {
            throw new InvalidOperationException("Nessun provider caricato.");
        }

        return enumerator.Current;
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
