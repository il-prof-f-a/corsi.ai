using System;
using System.Reflection;

internal static class DebugModeSmokeTest
{
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length != 1)
            {
                throw new InvalidOperationException("Passare il percorso di ChatModelli.exe.");
            }

            Assembly appAssembly = Assembly.LoadFrom(System.IO.Path.GetFullPath(args[0]));
            Type programType = appAssembly.GetType("ChatModelli.Program", true);
            MethodInfo isDebugMode = programType.GetMethod("IsDebugMode", BindingFlags.NonPublic | BindingFlags.Static);
            Assert(isDebugMode != null, "Program.IsDebugMode deve riconoscere l'opzione --debug.");
            Assert((bool)isDebugMode.Invoke(null, new object[] { new[] { "--debug" } }), "--debug deve attivare il debug.");
            Assert((bool)isDebugMode.Invoke(null, new object[] { new[] { "--DEBUG" } }), "--debug deve ignorare maiuscole e minuscole.");
            Assert(!(bool)isDebugMode.Invoke(null, new object[] { new[] { "--release" } }), "Un'opzione diversa non deve attivare il debug.");

            Type chatClientType = appAssembly.GetType("ChatModelli.ChatClient", true);
            MethodInfo buildSummary = chatClientType.GetMethod("BuildDebugRequestSummary", BindingFlags.NonPublic | BindingFlags.Static);
            Assert(buildSummary != null, "ChatClient deve produrre un riepilogo diagnostico senza contenuto sensibile.");
            string summary = (string)buildSummary.Invoke(null, new object[]
            {
                "anthropic",
                "https://api.anthropic.com/v1/messages",
                "claude-haiku-5-5",
                2,
                18
            });
            Assert(summary.Contains("model=claude-haiku-5-5"), "Il riepilogo deve indicare il modello.");
            Assert(summary.Contains("messages=2"), "Il riepilogo deve indicare il numero di messaggi.");
            Assert(summary.Contains("last_message_chars=18"), "Il riepilogo deve indicare la lunghezza dell'ultimo messaggio.");
            Assert(!summary.Contains("private prompt") && !summary.Contains("secret-key"), "Il riepilogo non deve contenere prompt o chiavi API.");

            MethodInfo buildErrorDiagnostic = chatClientType.GetMethod("BuildErrorDiagnostic", BindingFlags.NonPublic | BindingFlags.Static);
            Assert(buildErrorDiagnostic != null, "ChatClient deve estrarre un dettaglio HTTP utile per il log.");
            string errorDiagnostic = (string)buildErrorDiagnostic.Invoke(null, new object[]
            {
                "{\"type\":\"error\",\"error\":{\"type\":\"authentication_error\",\"message\":\"invalid x-api-key\"}}"
            });
            Assert(errorDiagnostic.Contains("authentication_error"), "Il log deve conservare il tipo d'errore HTTP.");
            Assert(errorDiagnostic.Contains("invalid x-api-key"), "Il log deve conservare il messaggio d'errore HTTP.");

            Console.WriteLine("DebugModeSmokeTest: OK");
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine("DebugModeSmokeTest: " + exception.GetBaseException().Message);
            return 1;
        }
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
