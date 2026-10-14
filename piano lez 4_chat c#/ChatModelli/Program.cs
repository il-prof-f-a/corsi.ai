using System;
using System.Windows.Forms;

namespace ChatModelli
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm(IsDebugMode(args)));
        }

        internal static bool IsDebugMode(string[] args)
        {
            if (args == null)
            {
                return false;
            }

            foreach (string argument in args)
            {
                if (String.Equals(argument, "--debug", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }
    }
}
