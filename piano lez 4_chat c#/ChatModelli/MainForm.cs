using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ChatModelli
{
    public sealed class MainForm : Form
    {
        private readonly ComboBox _providerCombo;
        private readonly ComboBox _modelCombo;
        private readonly RichTextBox _transcript;
        private readonly TextBox _promptBox;
        private readonly Button _sendButton;
        private readonly Button _newChatButton;
        private readonly Button _openSettingsButton;
        private readonly Label _statusLabel;
        private readonly List<ChatTurn> _history;
        private readonly bool _debugMode;

        private AppSettings _settings;
        private ChatClient _chatClient;
        private AppLogger _logger;
        private string _settingsPath;
        private bool _requestInProgress;
        private bool _loadingModelChoices;
        private bool _restoringModelSelection;
        private ModelChoice _lastAvailableModelChoice;

        public MainForm()
            : this(false)
        {
        }

        internal MainForm(bool debugMode)
        {
            _debugMode = debugMode;
            Text = "Chat con i modelli AI";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(760, 520);
            Size = new Size(1040, 720);
            Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);

            _history = new List<ChatTurn>();
            _providerCombo = new ComboBox();
            _modelCombo = new ComboBox();
            _transcript = new RichTextBox();
            _promptBox = new TextBox();
            _sendButton = new Button();
            _newChatButton = new Button();
            _openSettingsButton = new Button();
            _statusLabel = new Label();

            BuildInterface();
            LoadSettings();
        }

        private void BuildInterface()
        {
            FlowLayoutPanel toolbar = new FlowLayoutPanel();
            toolbar.Dock = DockStyle.Top;
            toolbar.Height = 56;
            toolbar.Padding = new Padding(12, 10, 12, 6);
            toolbar.WrapContents = false;
            toolbar.AutoScroll = true;

            Label providerLabel = new Label();
            providerLabel.Text = "Provider";
            providerLabel.AutoSize = true;
            providerLabel.Margin = new Padding(0, 8, 6, 0);

            _providerCombo.DropDownStyle = ComboBoxStyle.DropDownList;
            _providerCombo.Width = 175;
            _providerCombo.Margin = new Padding(0, 1, 14, 0);
            _providerCombo.SelectedIndexChanged += ProviderSelectionChanged;

            Label modelLabel = new Label();
            modelLabel.Text = "Modello";
            modelLabel.AutoSize = true;
            modelLabel.Margin = new Padding(0, 8, 6, 0);

            _modelCombo.DropDownStyle = ComboBoxStyle.DropDownList;
            _modelCombo.Width = 230;
            _modelCombo.Margin = new Padding(0, 1, 12, 0);
            _modelCombo.DrawMode = DrawMode.OwnerDrawFixed;
            _modelCombo.ItemHeight = 22;
            _modelCombo.DrawItem += DrawModelChoice;
            _modelCombo.SelectedIndexChanged += ModelSelectionChanged;
            _modelCombo.SelectionChangeCommitted += ModelSelectionCommitted;

            _newChatButton.Text = "Nuova chat";
            _newChatButton.AutoSize = true;
            _newChatButton.Margin = new Padding(0, 0, 8, 0);
            _newChatButton.Click += ClearConversation;

            _openSettingsButton.Text = "Apri settings.json";
            _openSettingsButton.AutoSize = true;
            _openSettingsButton.Margin = new Padding(0, 0, 10, 0);
            _openSettingsButton.Click += OpenSettings;

            _statusLabel.Text = "Pronto";
            _statusLabel.AutoSize = true;
            _statusLabel.Margin = new Padding(4, 8, 0, 0);

            toolbar.Controls.Add(providerLabel);
            toolbar.Controls.Add(_providerCombo);
            toolbar.Controls.Add(modelLabel);
            toolbar.Controls.Add(_modelCombo);
            toolbar.Controls.Add(_newChatButton);
            toolbar.Controls.Add(_openSettingsButton);
            toolbar.Controls.Add(_statusLabel);

            _transcript.Dock = DockStyle.Fill;
            _transcript.ReadOnly = true;
            _transcript.BackColor = Color.White;
            _transcript.BorderStyle = BorderStyle.FixedSingle;
            _transcript.DetectUrls = false;
            _transcript.Font = new Font("Segoe UI", 10F, FontStyle.Regular, GraphicsUnit.Point);
            _transcript.WordWrap = true;

            TableLayoutPanel composer = new TableLayoutPanel();
            composer.Dock = DockStyle.Bottom;
            composer.Height = 142;
            composer.Padding = new Padding(12, 8, 12, 12);
            composer.ColumnCount = 2;
            composer.RowCount = 1;
            composer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            composer.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 142F));

            _promptBox.Multiline = true;
            _promptBox.AcceptsReturn = true;
            _promptBox.ScrollBars = ScrollBars.Vertical;
            _promptBox.Dock = DockStyle.Fill;
            _promptBox.Font = new Font("Segoe UI", 10F, FontStyle.Regular, GraphicsUnit.Point);
            _promptBox.MaxLength = 1000000;
            _promptBox.KeyDown += PromptKeyDown;

            Panel sendPanel = new Panel();
            sendPanel.Dock = DockStyle.Fill;

            _sendButton.Text = "Invia";
            _sendButton.Width = 112;
            _sendButton.Height = 38;
            _sendButton.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            _sendButton.Location = new Point(12, 0);
            _sendButton.Click += async delegate(object sender, EventArgs eventArgs)
            {
                await SendPromptAsync();
            };

            Label keyboardHint = new Label();
            keyboardHint.Text = "Ctrl + Invio per inviare";
            keyboardHint.AutoSize = true;
            keyboardHint.Location = new Point(4, 48);
            keyboardHint.ForeColor = Color.DimGray;

            sendPanel.Controls.Add(_sendButton);
            sendPanel.Controls.Add(keyboardHint);
            composer.Controls.Add(_promptBox, 0, 0);
            composer.Controls.Add(sendPanel, 1, 0);

            Controls.Add(_transcript);
            Controls.Add(composer);
            Controls.Add(toolbar);

            FormClosing += MainFormClosing;
            AppendMessage("Chat", "Seleziona un provider e un modello, scrivi un messaggio e premi Invia. Le chiavi API sono lette dalle variabili d'ambiente indicate in settings.json.");
        }

        private void LoadSettings()
        {
            _settingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "settings.json");
            try
            {
                _settings = SettingsLoader.Load(_settingsPath);
                if (_debugMode)
                {
                    _settings.Log = true;
                    _settings.LogLevel = "debug";
                }

                _logger = new AppLogger(_settings, AppDomain.CurrentDomain.BaseDirectory);
                _logger.Write("debug", "Avvio applicazione. Debug=" + _debugMode + "; settings=" + _settingsPath + "; log=" + Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs", "chat.log") + ".");

                foreach (ProviderSettings provider in _settings.Providers)
                {
                    _logger.Write("debug", "Provider caricato. Nome=" + provider.Name + "; endpoint=" + provider.ApiBaseUrl + "; credenziale=" + provider.ApiKeyStatusMessage + "; modelli=" + String.Join(", ", provider.Models.ToArray()) + ".");
                }

                _chatClient = new ChatClient(_settings.ApiTimeoutMs, _logger);

                _providerCombo.DataSource = _settings.Providers;
                ShowCredentialSummary();
                if (_debugMode)
                {
                    AppendMessage("Diagnostica", "Debug attivo. Log: " + Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs", "chat.log"));
                }
            }
            catch (Exception exception)
            {
                _statusLabel.Text = "Configurazione non valida";
                AppendMessage("Errore di configurazione", exception.Message + Environment.NewLine + "Usa il pulsante Apri settings.json per controllare il file.");
                _providerCombo.Enabled = false;
                _modelCombo.Enabled = false;
                _sendButton.Enabled = false;
            }
        }

        private void ProviderSelectionChanged(object sender, EventArgs eventArgs)
        {
            ProviderSettings provider = _providerCombo.SelectedItem as ProviderSettings;
            _lastAvailableModelChoice = null;
            if (provider == null)
            {
                _modelCombo.DataSource = null;
                UpdateSendButtonState();
                return;
            }

            _loadingModelChoices = true;
            try
            {
                _modelCombo.DataSource = null;
                _modelCombo.DataSource = provider.CreateModelChoices();
                if (!provider.IsApiKeyAvailable)
                {
                    _modelCombo.SelectedIndex = -1;
                }
                else
                {
                    _lastAvailableModelChoice = _modelCombo.SelectedItem as ModelChoice;
                }
            }
            finally
            {
                _loadingModelChoices = false;
            }

            UpdateProviderStatus(provider);
        }

        private void ModelSelectionChanged(object sender, EventArgs eventArgs)
        {
            if (_loadingModelChoices || _restoringModelSelection)
            {
                return;
            }

            ModelChoice choice = _modelCombo.SelectedItem as ModelChoice;
            if (choice != null && choice.IsEnabled)
            {
                _lastAvailableModelChoice = choice;
            }

            UpdateSendButtonState();
        }

        private void ModelSelectionCommitted(object sender, EventArgs eventArgs)
        {
            ModelChoice choice = _modelCombo.SelectedItem as ModelChoice;
            if (choice != null && !choice.IsEnabled)
            {
                _restoringModelSelection = true;
                try
                {
                    if (_lastAvailableModelChoice == null)
                    {
                        _modelCombo.SelectedIndex = -1;
                    }
                    else
                    {
                        _modelCombo.SelectedItem = _lastAvailableModelChoice;
                    }
                }
                finally
                {
                    _restoringModelSelection = false;
                }

                ProviderSettings provider = _providerCombo.SelectedItem as ProviderSettings;
                if (provider != null)
                {
                    _statusLabel.Text = provider.Name + ": " + provider.ApiKeyStatusMessage;
                }
            }
            else if (choice != null)
            {
                _lastAvailableModelChoice = choice;
            }

            UpdateSendButtonState();
        }

        private void DrawModelChoice(object sender, DrawItemEventArgs eventArgs)
        {
            if (eventArgs.Index < 0)
            {
                return;
            }

            ModelChoice choice = _modelCombo.Items[eventArgs.Index] as ModelChoice;
            if (choice == null)
            {
                return;
            }

            eventArgs.DrawBackground();
            Color color = choice.IsEnabled ? _modelCombo.ForeColor : SystemColors.GrayText;
            TextRenderer.DrawText(
                eventArgs.Graphics,
                choice.DisplayText,
                eventArgs.Font,
                eventArgs.Bounds,
                color,
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            if ((eventArgs.State & DrawItemState.Focus) == DrawItemState.Focus)
            {
                eventArgs.DrawFocusRectangle();
            }
        }

        private void ShowCredentialSummary()
        {
            List<string> unavailableProviders = new List<string>();
            foreach (ProviderSettings provider in _settings.Providers)
            {
                if (!provider.IsApiKeyAvailable)
                {
                    unavailableProviders.Add(provider.Name + ": " + provider.ApiKeyStatusMessage);
                }
            }

            if (unavailableProviders.Count > 0)
            {
                AppendMessage(
                    "Credenziali mancanti",
                    String.Join(Environment.NewLine, unavailableProviders.ToArray()) + Environment.NewLine +
                    "I modelli di questi provider sono disabilitati. La presenza di una chiave non ne verifica la validità presso il servizio.");
            }
            else
            {
                _statusLabel.Text = "Credenziali presenti";
            }

            UpdateSendButtonState();
        }

        private void UpdateProviderStatus(ProviderSettings provider)
        {
            if (provider == null)
            {
                _statusLabel.Text = "Nessun provider selezionato";
            }
            else
            {
                _statusLabel.Text = provider.Name + ": " + provider.ApiKeyStatusMessage;
            }

            UpdateSendButtonState();
        }

        private void UpdateSendButtonState()
        {
            ModelChoice choice = _modelCombo.SelectedItem as ModelChoice;
            _sendButton.Enabled = _chatClient != null && choice != null && choice.IsEnabled;
        }

        private async Task SendPromptAsync()
        {
            if (_requestInProgress)
            {
                return;
            }

            ProviderSettings provider = _providerCombo.SelectedItem as ProviderSettings;
            ModelChoice modelChoice = _modelCombo.SelectedItem as ModelChoice;
            string model = modelChoice == null ? null : modelChoice.Name;
            string prompt = _promptBox.Text.Trim();
            
            if (provider == null || modelChoice == null || !modelChoice.IsEnabled || String.IsNullOrWhiteSpace(model))
            {
                MessageBox.Show(this, "Seleziona un provider e un modello.", "Chat", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            if (prompt.Length == 0)
            {
                _promptBox.Focus();
                return;
            }

            AppendMessage("Tu", prompt);

            prompt = @"Fingi di essere un centralinista di un hotel prestigioso: Radisson Collection Hotel, Roma Antica di cui puoi trovare informazioni su https://www.tripadvisor.it/Hotel_Review-g187791-d27095699-Reviews-Radisson_Collection_Hotel_Roma_Antica-Rome_Lazio.html. Sii sempre molto gentile e disponibile. Rispondi a tutte le domande di cui conosci la risposta se non la sai o non la recuperi invita l'utente a scrivere alla mail luxury@luxury.com" + Environment.NewLine + @"Il messaggio che scrive l'utente è: " + "\n\r" + prompt;

            _history.Add(new ChatTurn("user", prompt));

            _requestInProgress = true;
            SetRequestControls(false);
            _statusLabel.Text = "In attesa della risposta...";
            if (_logger != null)
            {
                _logger.Write("info", "Richiesta avviata. Provider=" + provider.Name + "; modello=" + model + ".");
            }

            try
            {
                string answer = await _chatClient.SendAsync(provider, model, _history);
                _history.Add(new ChatTurn("assistant", answer));
                AppendMessage(provider.Name + " / " + model, answer);
                _promptBox.Clear();
                _statusLabel.Text = "Risposta ricevuta";
                if (_logger != null)
                {
                    _logger.Write("info", "Risposta ricevuta. Provider=" + provider.Name + "; modello=" + model + ".");
                }
            }
            catch (Exception exception)
            {
                if (_history.Count > 0 && String.Equals(_history[_history.Count - 1].Role, "user", StringComparison.Ordinal))
                {
                    _history.RemoveAt(_history.Count - 1);
                }

                AppendMessage("Errore", exception.Message);
                _statusLabel.Text = "Richiesta non riuscita";
                if (_logger != null)
                {
                    _logger.Write("error", "Richiesta fallita. Provider=" + provider.Name + "; modello=" + model + "; tipo=" + exception.GetType().Name + ".");
                }
            }
            finally
            {
                _requestInProgress = false;
                SetRequestControls(true);
            }
        }

        private void SetRequestControls(bool enabled)
        {
            ModelChoice choice = _modelCombo.SelectedItem as ModelChoice;
            _sendButton.Enabled = enabled && _chatClient != null && choice != null && choice.IsEnabled;
            _promptBox.Enabled = enabled;
            _providerCombo.Enabled = enabled && _history.Count == 0 && _settings != null;
            _modelCombo.Enabled = enabled && _history.Count == 0 && _settings != null;
            _newChatButton.Enabled = enabled;
            _openSettingsButton.Enabled = enabled;
        }

        private async void PromptKeyDown(object sender, KeyEventArgs eventArgs)
        {
            if (eventArgs.Control && eventArgs.KeyCode == Keys.Enter)
            {
                eventArgs.SuppressKeyPress = true;
                await SendPromptAsync();
            }
        }

        private void ClearConversation(object sender, EventArgs eventArgs)
        {
            _history.Clear();
            _transcript.Clear();
            _promptBox.Clear();
            AppendMessage("Chat", "Nuova conversazione. Seleziona un provider e un modello oppure continua con la selezione corrente.");
            SetRequestControls(true);
            UpdateProviderStatus(_providerCombo.SelectedItem as ProviderSettings);
        }

        private void OpenSettings(object sender, EventArgs eventArgs)
        {
            try
            {
                if (!File.Exists(_settingsPath))
                {
                    throw new FileNotFoundException("settings.json non è stato trovato accanto all'applicazione.", _settingsPath);
                }

                Process.Start(new ProcessStartInfo
                {
                    FileName = _settingsPath,
                    UseShellExecute = true
                });
            }
            catch (Exception exception)
            {
                MessageBox.Show(this, exception.Message, "Impossibile aprire settings.json", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void AppendMessage(string speaker, string message)
        {
            _transcript.AppendText(speaker + Environment.NewLine + message + Environment.NewLine + Environment.NewLine);
            _transcript.SelectionStart = _transcript.TextLength;
            _transcript.SelectionLength = 0;
            _transcript.ScrollToCaret();
        }

        private void MainFormClosing(object sender, FormClosingEventArgs eventArgs)
        {
            if (_chatClient != null)
            {
                _chatClient.Dispose();
            }
        }

        private void InitializeComponent()
        {
            this.SuspendLayout();
            // 
            // MainForm
            // 
            this.ClientSize = new System.Drawing.Size(876, 442);
            this.Name = "MainForm";
            this.ResumeLayout(false);

        }
    }
}
