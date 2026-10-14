using System;
using System.IO;
using System.Text;

namespace ChatModelli
{
    public sealed class AppLogger
    {
        private readonly bool _enabled;
        private readonly int _minimumLevel;
        private readonly string _logPath;

        public AppLogger(AppSettings settings, string applicationDirectory)
        {
            _enabled = settings != null && settings.Log;
            _minimumLevel = GetLevel(settings == null ? null : settings.LogLevel);
            _logPath = Path.Combine(applicationDirectory, "logs", "chat.log");
        }

        public void Write(string level, string message)
        {
            if (!_enabled || GetLevel(level) < _minimumLevel)
            {
                return;
            }

            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_logPath));
                string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " [" + level.ToUpperInvariant() + "] " + message + Environment.NewLine;
                File.AppendAllText(_logPath, line, new UTF8Encoding(false));
            }
            catch (IOException)
            {
                // La scrittura del log non deve interrompere la chat.
            }
            catch (UnauthorizedAccessException)
            {
                // La scrittura del log non deve interrompere la chat.
            }
        }

        private static int GetLevel(string level)
        {
            if (String.Equals(level, "debug", StringComparison.OrdinalIgnoreCase))
            {
                return 0;
            }

            if (String.Equals(level, "warn", StringComparison.OrdinalIgnoreCase) ||
                String.Equals(level, "warning", StringComparison.OrdinalIgnoreCase))
            {
                return 2;
            }

            if (String.Equals(level, "error", StringComparison.OrdinalIgnoreCase))
            {
                return 3;
            }

            return 1;
        }
    }
}
