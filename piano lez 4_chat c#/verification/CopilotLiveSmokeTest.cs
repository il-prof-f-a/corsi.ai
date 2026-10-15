using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;

internal static class CopilotLiveSmokeTest
{
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length != 1)
            {
                throw new InvalidOperationException("Passare il percorso di ChatModelli.exe.");
            }

            string assemblyPath = Path.GetFullPath(args[0]);
            Assembly assembly = Assembly.LoadFrom(assemblyPath);
            Type loaderType = assembly.GetType("ChatModelli.SettingsLoader", true);
            object settings = loaderType.GetMethod("Load", BindingFlags.Public | BindingFlags.Static)
                .Invoke(null, new object[] { Path.Combine(Path.GetDirectoryName(assemblyPath), "settings.json") });
            object provider = FindProvider(settings, "github-copilot");
            Assert(ReadProperty(provider, "IsApiKeyAvailable").Equals(true), "GITHUB_TOKEN non è disponibile nell'ambiente.");

            Type clientType = assembly.GetType("ChatModelli.ChatClient", true);
            object client = Activator.CreateInstance(clientType, new object[] { 600000 });
            try
            {
                MethodInfo listMethod = clientType.GetMethod("LoadCopilotModelsAsync", BindingFlags.Public | BindingFlags.Instance);
                Assert(listMethod != null, "ChatClient deve esporre LoadCopilotModelsAsync per interrogare Copilot e caricare i modelli.");
                Task listTask = (Task)listMethod.Invoke(client, new[] { provider });
                listTask.GetAwaiter().GetResult();
                IList<string> models = (IList<string>)listTask.GetType().GetProperty("Result").GetValue(listTask, null);
                Assert(models != null && models.Count > 0, "GitHub Copilot non ha restituito modelli disponibili per la chiave configurata.");

                Type turnType = assembly.GetType("ChatModelli.ChatTurn", true);
                Type historyType = typeof(List<>).MakeGenericType(turnType);
                IList history = (IList)Activator.CreateInstance(historyType);
                history.Add(Activator.CreateInstance(turnType, new object[] { "user", "Come ti chiami? Rispondi con una frase breve." }));
                string modelToTest = null;
                foreach (string model in models)
                {
                    if (!String.Equals(model, "auto", StringComparison.OrdinalIgnoreCase))
                    {
                        modelToTest = model;
                        break;
                    }
                }

                if (String.IsNullOrWhiteSpace(modelToTest))
                {
                    modelToTest = models[0];
                }

                MethodInfo sendMethod = clientType.GetMethod("SendAsync", BindingFlags.Public | BindingFlags.Instance);
                Task<string> sendTask = (Task<string>)sendMethod.Invoke(client, new object[] { provider, modelToTest, history });
                string answer = sendTask.GetAwaiter().GetResult();
                Assert(!String.IsNullOrWhiteSpace(answer), "GitHub Copilot non ha restituito una risposta testuale.");

                Console.WriteLine("PASS: autenticazione riuscita; modelli Copilot caricati=" + models.Count + "; modello testato=" + modelToTest + ".");
                Console.WriteLine("Risposta: " + answer);
            }
            finally
            {
                IDisposable disposable = client as IDisposable;
                if (disposable != null)
                {
                    disposable.Dispose();
                }
            }

            return 0;
        }
        catch (Exception exception)
        {
            Exception cause = exception;
            while (cause is TargetInvocationException && cause.InnerException != null)
            {
                cause = cause.InnerException;
            }

            Console.Error.WriteLine("FAIL: " + cause.GetType().Name + ": " + Redact(cause.Message));
            return 1;
        }
    }

    private static object FindProvider(object settings, string name)
    {
        foreach (object provider in (IEnumerable)ReadProperty(settings, "Providers"))
        {
            if (String.Equals(Convert.ToString(ReadProperty(provider, "Name")), name, StringComparison.OrdinalIgnoreCase))
            {
                return provider;
            }
        }

        throw new InvalidOperationException("Il provider " + name + " non è presente in settings.json.");
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

    private static string Redact(string message)
    {
        string[] scopes = { "Process", "User", "Machine" };
        foreach (string scope in scopes)
        {
            string token = Environment.GetEnvironmentVariable("GITHUB_TOKEN", (EnvironmentVariableTarget)Enum.Parse(typeof(EnvironmentVariableTarget), scope));
            if (!String.IsNullOrEmpty(token))
            {
                message = message.Replace(token, "[redacted]");
            }
        }

        return message;
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
