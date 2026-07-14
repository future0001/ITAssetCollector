using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace AssetCollector
{
    public class MainForm : Form
    {
        private TextBox serverUrlBox;
        private TextBox nameBox;
        private ComboBox departmentBox;
        private TextBox employeeIdBox;
        private ComboBox locationBox;
        private TextBox phoneBox;
        private TextBox noteBox;
        private TextBox computerCodeBox;
        private TextBox diskSerialOverridesBox;
        private TextBox offlineDirectoryBox;
        private TextBox offlineFileNameBox;
        private TextBox excelDirectoryBox;
        private TextBox excelFileNameBox;
        private TextBox previewBox;
        private Label offlineCountLabel;
        private Label statusLabel;
        private Button collectButton;
        private Button saveOfflineButton;
        private Button exportExcelButton;
        private Button submitOfflineButton;
        private Button submitButton;
        private Button detectServerButton;
        private Button editUserButton;
        private Button updateButton;
        private ToolTip buttonToolTip;
        private NotifyIcon trayIcon;
        private System.Windows.Forms.Timer trayStatusTimer;
        private MenuItem trayStatusItem;
        private RegisteredWaitHandle showWindowRegistration;
        private Mutex trayMutex;
        private AssetPayload currentPayload;
        private ClientStorageSettings storageSettings;
        private bool trayBalloonShown;
        private bool userInfoUnlocked;
        private bool startupSubmitStarted;
        private Dictionary<string, string> organizationEmployeeDepartments = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private bool organizationLoadInProgress;
        private DateTime lastOrganizationLoadUtc = DateTime.MinValue;
        private Dictionary<int, string> automaticDiskSerials = new Dictionary<int, string>();
        private static readonly string[] DepartmentOptions = new string[0];
        private static readonly string[] LocationOptions = new string[0];

        public MainForm()
        {
            Text = "计算机信息核查";
            TryUseApplicationIcon();
            Width = 1040;
            Height = 860;
            MinimumSize = new Size(900, 720);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Microsoft YaHei UI", 9F);

            storageSettings = ClientStorageSettings.Load();
            OfflineStore.Configure(storageSettings.OfflineStorePath());
            BuildUi();
            LoadAgentSettingsToUi();
            LockInstalledUserInfo();
            nameBox.TextChanged += delegate { ApplyDepartmentFromOrganization(); };
            nameBox.Leave += delegate { ApplyDepartmentFromOrganization(); };
            serverUrlBox.Leave += delegate { BeginLoadOrganizationDepartments(); };
            Activated += delegate { RefreshOrganizationDirectoryIfStale(); };
            UpdateOfflineCount();
            SetStatus("就绪");
            InitializeTraySupport();
            Shown += delegate
            {
                BeginStartupCollectAndSubmit();
                BeginLoadOrganizationDepartments();
            };
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                HideToTray();
                return;
            }

            base.OnFormClosing(e);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (showWindowRegistration != null) showWindowRegistration.Unregister(null);
                if (trayStatusTimer != null)
                {
                    trayStatusTimer.Stop();
                    trayStatusTimer.Dispose();
                }
                if (trayIcon != null)
                {
                    trayIcon.Visible = false;
                    trayIcon.Dispose();
                }
                if (trayMutex != null)
                {
                    trayMutex.ReleaseMutex();
                    trayMutex.Dispose();
                }
            }
            base.Dispose(disposing);
        }

        private void InitializeTraySupport()
        {
            bool created;
            trayMutex = new Mutex(true, "Global\\ITAssetCollectorTray", out created);
            if (!created)
            {
                trayMutex.Close();
                trayMutex = null;
                RegisterShowWindowSignal();
                return;
            }

            trayStatusItem = new MenuItem("服务状态：检测中") { Enabled = false };
            var menu = new ContextMenu(new[]
            {
                trayStatusItem,
                new MenuItem("-"),
                new MenuItem("打开客户端", delegate { ShowFromTray(); }),
                new MenuItem("启动服务", delegate { StartService(); }),
                new MenuItem("停止服务", delegate { StopService(); }),
                new MenuItem("重启服务", delegate { RestartService(); }),
                new MenuItem("-"),
                new MenuItem("安装服务", delegate { Program.InstallService(); RefreshTrayStatus(); }),
                new MenuItem("卸载服务", delegate { if (Program.VerifySensitiveOperation(this, "卸载服务")) { Program.UninstallService(); RefreshTrayStatus(); } })
            });

            trayIcon = new NotifyIcon
            {
                Text = "计算机信息核查",
                Icon = Icon ?? SystemIcons.Application,
                ContextMenu = menu,
                Visible = true
            };
            trayIcon.DoubleClick += delegate { ShowFromTray(); };

            trayStatusTimer = new System.Windows.Forms.Timer { Interval = 5000 };
            trayStatusTimer.Tick += delegate { RefreshTrayStatus(); };
            trayStatusTimer.Start();
            RefreshTrayStatus();

            RegisterShowWindowSignal();
        }

        private void RegisterShowWindowSignal()
        {
            IntPtr handle = Handle;
            EventWaitHandle showEvent = Program.MainShowEvent;
            if (showEvent != null)
            {
                showWindowRegistration = ThreadPool.RegisterWaitForSingleObject(
                    showEvent,
                    delegate { RunOnUi(ShowFromTray); },
                    null,
                    -1,
                    false);
            }
        }

        private void HideToTray()
        {
            Hide();
            if (!trayBalloonShown && trayIcon != null)
            {
                trayBalloonShown = true;
                trayIcon.BalloonTipTitle = "计算机信息核查仍在运行";
                trayIcon.BalloonTipText = "可从任务栏托盘图标重新打开或管理后台服务。";
                trayIcon.ShowBalloonTip(2500);
            }
        }

        private void ShowFromTray()
        {
            if (IsDisposed) return;
            Show();
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            Activate();
            BringToFront();
        }

        private void RefreshTrayStatus()
        {
            string status = ServiceStatusText();
            if (trayStatusItem != null) trayStatusItem.Text = "服务状态：" + status;
            if (trayIcon != null)
            {
                string text = "计算机信息核查 - " + status;
                trayIcon.Text = text.Length > 63 ? "计算机信息核查" : text;
            }
        }

        private string ServiceStatusText()
        {
            try
            {
                using (var service = new ServiceController(AgentService.ServiceNameValue))
                {
                    return ServiceStatusName(service.Status);
                }
            }
            catch
            {
                return "未安装";
            }
        }

        private static string ServiceStatusName(ServiceControllerStatus status)
        {
            if (status == ServiceControllerStatus.Running) return "运行中";
            if (status == ServiceControllerStatus.Stopped) return "已停止";
            if (status == ServiceControllerStatus.StartPending) return "正在启动";
            if (status == ServiceControllerStatus.StopPending) return "正在停止";
            return status.ToString();
        }

        private void StartService()
        {
            ControlService(delegate(ServiceController service) {
                if (service.Status == ServiceControllerStatus.Stopped) service.Start();
            });
        }

        private void StopService()
        {
            if (!Program.VerifySensitiveOperation(this, "停止服务")) return;
            ControlService(delegate(ServiceController service) {
                if (service.CanStop && service.Status != ServiceControllerStatus.Stopped) service.Stop();
            });
        }

        private void RestartService()
        {
            if (!Program.VerifySensitiveOperation(this, "重启服务")) return;
            ControlService(delegate(ServiceController service) {
                if (service.CanStop && service.Status != ServiceControllerStatus.Stopped)
                {
                    service.Stop();
                    service.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(15));
                }
                service.Start();
            });
        }

        private void ControlService(Action<ServiceController> action)
        {
            try
            {
                using (var service = new ServiceController(AgentService.ServiceNameValue))
                {
                    action(service);
                    service.Refresh();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, "服务操作失败", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            RefreshTrayStatus();
        }

        private void LoadAgentSettingsToUi()
        {
            AgentSettings settings = AgentSettings.Load();
            serverUrlBox.Text = settings.serverUrl;
            nameBox.Text = settings.userName;
            departmentBox.Text = settings.department;
            employeeIdBox.Text = settings.employeeId;
            locationBox.Text = settings.location;
            phoneBox.Text = settings.phone;
            noteBox.Text = settings.note;
        }

        private void LockInstalledUserInfo()
        {
            bool locked = !string.IsNullOrWhiteSpace(nameBox.Text) && !string.IsNullOrWhiteSpace(departmentBox.Text);
            userInfoUnlocked = !locked;
            nameBox.ReadOnly = locked;
            departmentBox.Enabled = !locked;
            if (editUserButton != null)
            {
                editUserButton.Enabled = locked;
                editUserButton.Text = locked ? "修改用户" : "保存用户";
            }
        }

        private void TryUseApplicationIcon()
        {
            try
            {
                Icon icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (icon != null) Icon = icon;
            }
            catch
            {
            }
        }

        private void BuildUi()
        {
            var root = new TableLayoutPanel();
            root.Dock = DockStyle.Fill;
            root.ColumnCount = 1;
            root.RowCount = 7;
            root.Padding = new Padding(12);
            root.BackColor = Color.FromArgb(245, 247, 250);
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            Controls.Add(root);

            root.Controls.Add(BuildServerGroup(), 0, 0);
            root.Controls.Add(BuildUserGroup(), 0, 1);
            root.Controls.Add(BuildStorageGroup(), 0, 2);
            root.Controls.Add(BuildQuickGuidePanel(), 0, 3);
            root.Controls.Add(BuildPreviewGroup(), 0, 4);
            root.Controls.Add(BuildButtonPanel(), 0, 5);
            root.Controls.Add(BuildStatusPanel(), 0, 6);
        }

        private Control BuildQuickGuidePanel()
        {
            var panel = new Panel();
            panel.Dock = DockStyle.Top;
            panel.Height = 42;
            panel.Margin = new Padding(0, 0, 0, 8);
            panel.Padding = new Padding(12, 8, 12, 8);
            panel.BackColor = Color.FromArgb(232, 244, 255);
            panel.BorderStyle = BorderStyle.FixedSingle;

            var label = new Label();
            label.Dock = DockStyle.Fill;
            label.AutoEllipsis = true;
            label.TextAlign = ContentAlignment.MiddleLeft;
            label.ForeColor = Color.FromArgb(36, 67, 96);
            label.Text = "建议流程：自动检测服务端 -> 一键获取信息 -> 提交到服务器。关闭窗口后客户端仍会在后台托盘运行。";
            panel.Controls.Add(label);

            return panel;
        }

        private Control BuildServerGroup()
        {
            var group = new GroupBox();
            group.Text = "服务器";
            group.Dock = DockStyle.Top;
            group.Padding = new Padding(12, 10, 12, 12);
            group.Height = 76;

            var panel = new TableLayoutPanel();
            panel.Dock = DockStyle.Fill;
            panel.ColumnCount = 3;
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 90));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110));
            group.Controls.Add(panel);

            panel.Controls.Add(new Label { Text = "地址", AutoSize = true, Anchor = AnchorStyles.Left }, 0, 0);
            serverUrlBox = new TextBox { Dock = DockStyle.Fill, Text = ApiClient.DefaultServerUrl() };
            panel.Controls.Add(serverUrlBox, 1, 0);
            detectServerButton = CreateButton("自动检测", 96, true, DetectServerButton_Click);
            panel.Controls.Add(detectServerButton, 2, 0);

            return group;
        }

        private Control BuildUserGroup()
        {
            var group = new GroupBox();
            group.Text = "使用人信息";
            group.Dock = DockStyle.Top;
            group.Padding = new Padding(12, 10, 12, 12);
            group.Height = 160;

            var panel = new TableLayoutPanel();
            panel.Dock = DockStyle.Fill;
            panel.ColumnCount = 4;
            panel.RowCount = 4;
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 90));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 90));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            group.Controls.Add(panel);

            nameBox = AddField(panel, "姓名", 0);
            departmentBox = AddComboField(panel, "部门", 1, DepartmentOptions);
            employeeIdBox = AddField(panel, "工号", 2);
            locationBox = AddComboField(panel, "存放位置", 3, LocationOptions);
            phoneBox = AddField(panel, "电话", 4);
            computerCodeBox = AddField(panel, "计算机编号", 5);
            noteBox = AddField(panel, "备注", 6);
            diskSerialOverridesBox = AddField(panel, "硬盘SN修正", 7);
            diskSerialOverridesBox.TextChanged += delegate { RefreshPreviewWithManualDiskSerials(); };
            var diskSerialTip = new ToolTip();
            diskSerialTip.SetToolTip(diskSerialOverridesBox, "留空则全部使用自动采集；多个硬盘用 ; 分隔；支持：旧序列号=新序列号、型号:序列号");

            return group;
        }

        private Control BuildStorageGroup()
        {
            var group = new GroupBox();
            group.Text = "文件设置";
            group.Dock = DockStyle.Top;
            group.Padding = new Padding(12, 10, 12, 12);
            group.Height = 116;

            var panel = new TableLayoutPanel();
            panel.Dock = DockStyle.Fill;
            panel.ColumnCount = 5;
            panel.RowCount = 2;
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 100));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 92));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 100));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            group.Controls.Add(panel);

            panel.Controls.Add(new Label { Text = "离线保存目录", AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 7, 8, 7) }, 0, 0);
            offlineDirectoryBox = new TextBox { Dock = DockStyle.Fill, Margin = new Padding(0, 4, 8, 4), Text = storageSettings.offlineDirectory };
            offlineDirectoryBox.Leave += delegate { SaveStorageSettingsFromUi(); };
            panel.Controls.Add(offlineDirectoryBox, 1, 0);
            panel.Controls.Add(CreateButton("选择目录", 84, true, delegate { BrowseDirectory(offlineDirectoryBox); }), 2, 0);

            panel.Controls.Add(new Label { Text = "离线文件名", AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 7, 8, 7) }, 3, 0);
            offlineFileNameBox = new TextBox { Dock = DockStyle.Fill, Margin = new Padding(0, 4, 8, 4), Text = storageSettings.offlineFileName };
            offlineFileNameBox.Leave += delegate { SaveStorageSettingsFromUi(); };
            panel.Controls.Add(offlineFileNameBox, 4, 0);

            panel.Controls.Add(new Label { Text = "Excel目录", AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 7, 8, 7) }, 0, 1);
            excelDirectoryBox = new TextBox { Dock = DockStyle.Fill, Margin = new Padding(0, 4, 8, 4), Text = storageSettings.excelDirectory };
            excelDirectoryBox.Leave += delegate { SaveStorageSettingsFromUi(); };
            panel.Controls.Add(excelDirectoryBox, 1, 1);
            panel.Controls.Add(CreateButton("选择目录", 84, true, delegate { BrowseDirectory(excelDirectoryBox); }), 2, 1);

            panel.Controls.Add(new Label { Text = "Excel文件名", AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 7, 8, 7) }, 3, 1);
            excelFileNameBox = new TextBox { Dock = DockStyle.Fill, Margin = new Padding(0, 4, 8, 4), Text = storageSettings.excelFileNameTemplate };
            excelFileNameBox.Leave += delegate { SaveStorageSettingsFromUi(); };
            panel.Controls.Add(excelFileNameBox, 4, 1);

            var tip = new ToolTip();
            tip.SetToolTip(offlineFileNameBox, "例如 offline-assets.json；未写 .json 会自动补上。");
            tip.SetToolTip(excelFileNameBox, "支持 {timestamp}、{date}、{computer}、{name}、{type}。例如：资产核查-{computer}-{timestamp}.xls");
            tip.SetToolTip(excelDirectoryBox, "导出 Excel 时默认打开这个目录，仍可在保存窗口临时改位置。");
            tip.SetToolTip(offlineDirectoryBox, "离线记录 JSON 文件保存目录。");

            return group;
        }

        private Control BuildPreviewGroup()
        {
            var group = new GroupBox();
            group.Text = "采集预览";
            group.Dock = DockStyle.Fill;
            group.Padding = new Padding(12, 10, 12, 12);

            previewBox = new TextBox();
            previewBox.Dock = DockStyle.Fill;
            previewBox.Multiline = true;
            previewBox.ScrollBars = ScrollBars.Both;
            previewBox.ReadOnly = true;
            previewBox.WordWrap = false;
            previewBox.BackColor = Color.White;
            previewBox.Font = new Font("Consolas", 10F);
            group.Controls.Add(previewBox);

            return group;
        }

        private Control BuildButtonPanel()
        {
            var panel = new FlowLayoutPanel();
            panel.Dock = DockStyle.Fill;
            panel.FlowDirection = FlowDirection.RightToLeft;
            panel.Padding = new Padding(0, 10, 0, 4);
            panel.Height = 54;

            submitButton = CreateButton("提交到服务器", 130, false, SubmitButton_Click);
            submitOfflineButton = CreateButton("提交离线记录", 130, true, SubmitOfflineButton_Click);
            saveOfflineButton = CreateButton("保存离线记录", 130, false, SaveOfflineButton_Click);
            collectButton = CreateButton("一键获取信息", 130, true, CollectButton_Click);
            exportExcelButton = CreateButton("导出Excel", 110, true, ExportExcelButton_Click);
            updateButton = CreateButton("检查升级", 96, true, CheckUpdateButton_Click);
            editUserButton = CreateButton("修改用户", 96, true, EditUserButton_Click);

            panel.Controls.Add(submitButton);
            panel.Controls.Add(submitOfflineButton);
            panel.Controls.Add(saveOfflineButton);
            panel.Controls.Add(exportExcelButton);
            panel.Controls.Add(collectButton);
            panel.Controls.Add(editUserButton);
            panel.Controls.Add(updateButton);

            StylePrimaryButton(collectButton);
            StylePrimaryButton(submitButton);
            AddButtonTips();

            return panel;
        }

        private void StylePrimaryButton(Button button)
        {
            if (button == null) return;
            button.BackColor = Color.FromArgb(222, 241, 252);
            button.ForeColor = Color.FromArgb(16, 53, 84);
            button.FlatStyle = FlatStyle.Standard;
            button.UseVisualStyleBackColor = false;
        }

        private void AddButtonTips()
        {
            buttonToolTip = new ToolTip();
            buttonToolTip.SetToolTip(collectButton, "重新读取本机硬件、网卡、硬盘和系统信息。");
            buttonToolTip.SetToolTip(submitButton, "把当前预览信息提交到服务端。");
            buttonToolTip.SetToolTip(saveOfflineButton, "网络不可用时先保存本地记录，之后可再提交。");
            buttonToolTip.SetToolTip(submitOfflineButton, "提交之前保存的本地离线记录。");
            buttonToolTip.SetToolTip(exportExcelButton, "把当前采集结果导出为 Excel 文件。");
            buttonToolTip.SetToolTip(editUserButton, "修改姓名、部门等使用人信息。");
            buttonToolTip.SetToolTip(updateButton, "检查并安装服务端发布的客户端升级包。");
        }

        private void CheckUpdateButton_Click(object sender, EventArgs e)
        {
            try
            {
                AgentSettings settings = AgentSettings.Load();
                ClientUpdateInfo update = ApiClient.CheckClientUpdate(settings.serverUrl, Program.CurrentVersion());
                if (update == null || !update.updateAvailable)
                {
                    MessageBox.Show(this, "当前已是最新版本：" + Program.CurrentVersion(), "检查升级", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }

                DialogResult result = MessageBox.Show(this,
                    "检测到新版本：" + update.version + "\r\n当前版本：" + Program.CurrentVersion() + "\r\n\r\n是否立即下载并启动升级？",
                    "检查升级",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question);
                if (result != DialogResult.Yes) return;

                if (Program.TryStartAutoUpdate(settings))
                {
                    MessageBox.Show(this, "已启动升级，客户端将在后台替换并重启服务。", "检查升级", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, "检查升级失败", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private Control BuildStatusPanel()
        {
            var panel = new TableLayoutPanel();
            panel.Dock = DockStyle.Fill;
            panel.ColumnCount = 2;
            panel.Height = 28;
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));

            offlineCountLabel = new Label { AutoSize = true, Anchor = AnchorStyles.Left };
            statusLabel = new Label { AutoSize = true, Anchor = AnchorStyles.Right };
            offlineCountLabel.ForeColor = Color.FromArgb(71, 84, 103);
            statusLabel.ForeColor = Color.FromArgb(20, 122, 99);
            panel.Controls.Add(offlineCountLabel, 0, 0);
            panel.Controls.Add(statusLabel, 1, 0);

            return panel;
        }

        private Button CreateButton(string text, int width, bool enabled, EventHandler handler)
        {
            var button = new Button { Text = text, Width = width, Height = 34, Enabled = enabled, Margin = new Padding(6, 0, 0, 0) };
            button.Click += handler;
            return button;
        }

        private void BrowseDirectory(TextBox target)
        {
            if (target == null) return;
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "选择文件保存目录";
                string current = Environment.ExpandEnvironmentVariables(target.Text.Trim());
                if (Directory.Exists(current)) dialog.SelectedPath = current;
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                target.Text = dialog.SelectedPath;
                SaveStorageSettingsFromUi();
            }
        }

        private void SaveStorageSettingsFromUi()
        {
            if (storageSettings == null) storageSettings = ClientStorageSettings.Load();
            if (offlineDirectoryBox != null) storageSettings.offlineDirectory = offlineDirectoryBox.Text.Trim();
            if (offlineFileNameBox != null) storageSettings.offlineFileName = offlineFileNameBox.Text.Trim();
            if (excelDirectoryBox != null) storageSettings.excelDirectory = excelDirectoryBox.Text.Trim();
            if (excelFileNameBox != null) storageSettings.excelFileNameTemplate = excelFileNameBox.Text.Trim();
            storageSettings.Normalize();

            if (offlineDirectoryBox != null) offlineDirectoryBox.Text = storageSettings.offlineDirectory;
            if (offlineFileNameBox != null) offlineFileNameBox.Text = storageSettings.offlineFileName;
            if (excelDirectoryBox != null) excelDirectoryBox.Text = storageSettings.excelDirectory;
            if (excelFileNameBox != null) excelFileNameBox.Text = storageSettings.excelFileNameTemplate;

            storageSettings.Save();
            OfflineStore.Configure(storageSettings.OfflineStorePath());
            UpdateOfflineCount();
        }

        private TextBox AddField(TableLayoutPanel panel, string label, int index)
        {
            int row = index / 2;
            int labelCol = (index % 2) * 2;
            int inputCol = labelCol + 1;

            panel.Controls.Add(new Label { Text = label, AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 7, 8, 7) }, labelCol, row);
            var box = new TextBox { Dock = DockStyle.Fill, Margin = new Padding(0, 4, 16, 4) };
            panel.Controls.Add(box, inputCol, row);
            return box;
        }

        private ComboBox AddComboField(TableLayoutPanel panel, string label, int index, string[] items)
        {
            int row = index / 2;
            int labelCol = (index % 2) * 2;
            int inputCol = labelCol + 1;

            panel.Controls.Add(new Label { Text = label, AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 7, 8, 7) }, labelCol, row);
            var box = new ComboBox { Dock = DockStyle.Fill, Margin = new Padding(0, 4, 16, 4), DropDownStyle = ComboBoxStyle.DropDown };
            box.AutoCompleteMode = AutoCompleteMode.SuggestAppend;
            box.AutoCompleteSource = AutoCompleteSource.ListItems;
            box.Items.AddRange(items);
            panel.Controls.Add(box, inputCol, row);
            return box;
        }

        private void DetectServerButton_Click(object sender, EventArgs e)
        {
            BeginDiscoverServer(true);
        }

        private void BeginDiscoverServer(bool showResult)
        {
            if (detectServerButton != null) detectServerButton.Enabled = false;
            SetStatus("正在自动检测服务端...");

            ThreadPool.QueueUserWorkItem(delegate
            {
                string url = string.Empty;
                Exception error = null;

                try { url = DiscoveryClient.DiscoverServerUrl(1800, serverUrlBox.Text.Trim()); }
                catch (Exception ex) { error = ex; }

                RunOnUi(delegate
                {
                    if (detectServerButton != null) detectServerButton.Enabled = true;

                    if (!string.IsNullOrWhiteSpace(url))
                    {
                        serverUrlBox.Text = url;
                        SetStatus("已检测到服务端：" + url);
                        BeginLoadOrganizationDepartments();
                        if (showResult) MessageBox.Show(this, "已检测到服务端：\r\n" + url, "自动检测", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    else
                    {
                        SetStatus("未检测到服务端，可手动填写地址");
                        if (showResult)
                        {
                            string message = error == null ? "未检测到服务端。请确认服务端已启动，并且防火墙允许 UDP " + DiscoveryClient.DiscoveryPort() + "。" : error.Message;
                            MessageBox.Show(this, message, "自动检测失败", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        }
                    }
                });
            });
        }

        private void BeginLoadOrganizationDepartments()
        {
            if (departmentBox == null || serverUrlBox == null) return;
            if (organizationLoadInProgress) return;
            organizationLoadInProgress = true;
            lastOrganizationLoadUtc = DateTime.UtcNow;
            string serverUrl = serverUrlBox.Text.Trim();

            ThreadPool.QueueUserWorkItem(delegate
            {
                OrganizationDirectory directory = null;
                try { directory = ApiClient.GetOrganizationDirectory(serverUrl); }
                catch
                {
                    RunOnUi(delegate { organizationLoadInProgress = false; });
                    return;
                }

                RunOnUi(delegate
                {
                    organizationLoadInProgress = false;
                    if (directory == null || ((directory.Departments == null || directory.Departments.Length == 0) && directory.EmployeeDepartments.Count == 0)) return;
                    ApplyOrganizationDirectory(directory);
                });
            });
        }

        private void RefreshOrganizationDirectoryIfStale()
        {
            if ((DateTime.UtcNow - lastOrganizationLoadUtc) < TimeSpan.FromMinutes(5)) return;
            BeginLoadOrganizationDepartments();
        }

        private void ApplyOrganizationDirectory(OrganizationDirectory directory)
        {
            if (directory == null) return;
            organizationEmployeeDepartments = directory.EmployeeDepartments ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            ApplyDepartmentOptions(directory.Departments ?? new string[0]);
            ApplyDepartmentFromOrganization();
        }

        private void ApplyDepartmentOptions(string[] departments)
        {
            string current = departmentBox.Text;
            var names = new List<string>();
            names.AddRange(departments);

            departmentBox.BeginUpdate();
            departmentBox.Items.Clear();
            foreach (string name in UniqueNonEmpty(names))
            {
                departmentBox.Items.Add(name);
            }
            departmentBox.EndUpdate();
            departmentBox.Text = current;
        }

        private void ApplyDepartmentFromOrganization()
        {
            if (nameBox == null || departmentBox == null || organizationEmployeeDepartments == null) return;

            string userName = nameBox.Text.Trim();
            if (userName.Length == 0) return;

            string department;
            if (!organizationEmployeeDepartments.TryGetValue(userName, out department)) return;
            if (string.IsNullOrWhiteSpace(department)) return;

            departmentBox.Text = department.Trim();
        }

        private List<string> UniqueNonEmpty(IEnumerable<string> values)
        {
            var result = new List<string>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (string value in values)
            {
                string name = (value ?? string.Empty).Trim();
                if (name.Length == 0 || seen.Contains(name)) continue;
                seen.Add(name);
                result.Add(name);
            }

            return result;
        }

        private void CollectButton_Click(object sender, EventArgs e)
        {
            BeginCollectHardware(true);
        }

        private void BeginStartupCollectAndSubmit()
        {
            if (startupSubmitStarted) return;
            startupSubmitStarted = true;
            ToggleBusy(true, "正在检测服务端并自动采集提交...");

            string preferredUrl = serverUrlBox.Text.Trim();
            ThreadPool.QueueUserWorkItem(delegate
            {
                string serverUrl = preferredUrl;
                AssetPayload payload = null;
                string result = null;
                Exception error = null;
                bool savedOffline = false;

                try
                {
                    serverUrl = DiscoveryClient.DiscoverServerUrl(1200, preferredUrl);
                    payload = HardwareCollector.Collect();
                    ApplySavedUserInfo(payload);
                    result = ApiClient.Submit(serverUrl, payload);
                    AgentSettings.SaveInstallSettings(serverUrl, payload.user.name, payload.user.department);
                }
                catch (Exception ex)
                {
                    error = ex;
                    if (payload != null)
                    {
                        try
                        {
                            OfflineStore.Save(payload);
                            savedOffline = true;
                        }
                        catch
                        {
                        }
                    }
                }

                RunOnUi(delegate
                {
                    try
                    {
                        if (!string.IsNullOrWhiteSpace(serverUrl)) serverUrlBox.Text = serverUrl;
                        if (payload != null)
                        {
                            currentPayload = payload;
                            CaptureAutomaticDiskSerials(currentPayload);
                            ApplyUserInfo(currentPayload);
                            ApplyManualDiskSerialOverrides(currentPayload);
                            previewBox.Text = BuildPreview(currentPayload);
                            saveOfflineButton.Enabled = true;
                            submitButton.Enabled = true;
                        }

                        if (error == null)
                        {
                            SetStatus("已自动采集并提交到服务端");
                        }
                        else if (savedOffline)
                        {
                            UpdateOfflineCount();
                            SetStatus("自动提交失败，已保存离线记录：" + error.Message);
                        }
                        else
                        {
                            SetStatus("自动采集提交失败：" + error.Message);
                        }

                        BeginLoadOrganizationDepartments();
                    }
                    finally
                    {
                        ToggleBusy(false, null);
                    }
                });
            });
        }

        private void ApplySavedUserInfo(AssetPayload payload)
        {
            if (payload == null) return;
            var settings = AgentSettings.Load();
            settings.ApplyTo(payload);
        }

        private void EditUserButton_Click(object sender, EventArgs e)
        {
            if (!userInfoUnlocked)
            {
                if (!SecurityClient.PromptAndVerify(this, serverUrlBox.Text.Trim(), "修改用户信息")) return;
                userInfoUnlocked = true;
                nameBox.ReadOnly = false;
                departmentBox.Enabled = true;
                editUserButton.Text = "保存用户";
                nameBox.Focus();
                return;
            }

            if (!EnsureRequiredUserInfo()) return;
            AgentSettings.SaveInstallSettings(serverUrlBox.Text.Trim(), nameBox.Text.Trim(), departmentBox.Text.Trim());
            userInfoUnlocked = false;
            nameBox.ReadOnly = true;
            departmentBox.Enabled = false;
            editUserButton.Text = "修改用户";
            MessageBox.Show(this, "用户信息已保存。", "完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
            if (currentPayload != null)
            {
                ApplyUserInfo(currentPayload);
                previewBox.Text = BuildPreview(currentPayload);
            }
        }

        private void BeginCollectHardware(bool showErrors)
        {
            ToggleBusy(true, "正在采集硬件信息...");

            ThreadPool.QueueUserWorkItem(delegate
            {
                AssetPayload payload = null;
                Exception error = null;

                try { payload = HardwareCollector.Collect(); }
                catch (Exception ex) { error = ex; }

                RunOnUi(delegate
                {
                    try
                    {
                        if (error != null)
                        {
                            if (!showErrors)
                            {
                                SetStatus("自动采集失败，可手动点击一键获取信息重试");
                                return;
                            }
                            MessageBox.Show(this, error.Message, "采集失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
                            SetStatus("采集失败");
                            return;
                        }

                        currentPayload = payload;
                        CaptureAutomaticDiskSerials(currentPayload);
                        ApplyUserInfo(currentPayload);
                        ApplyManualDiskSerialOverrides(currentPayload);
                        previewBox.Text = BuildPreview(currentPayload);
                        saveOfflineButton.Enabled = true;
                        submitButton.Enabled = true;
                        SetStatus("采集完成：网卡 " + currentPayload.networkAdapters.Count + "，硬盘 " + currentPayload.disks.Count);
                    }
                    finally
                    {
                        ToggleBusy(false, null);
                    }
                });
            });
        }

        private void SaveOfflineButton_Click(object sender, EventArgs e)
        {
            if (!EnsureCurrentPayload()) return;
            if (!EnsureRequiredUserInfo()) return;

            ApplyUserInfo(currentPayload);
            ApplyManualDiskSerialOverrides(currentPayload);
            previewBox.Text = BuildPreview(currentPayload);
            SaveStorageSettingsFromUi();
            OfflineStore.Save(currentPayload);
            UpdateOfflineCount();
            SetStatus("已保存离线记录");
            MessageBox.Show(this, "已保存到本地离线记录，网络恢复后可点击提交离线记录。", "已保存", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private void SubmitButton_Click(object sender, EventArgs e)
        {
            if (!EnsureCurrentPayload()) return;
            if (!EnsureRequiredUserInfo()) return;

            ApplyUserInfo(currentPayload);
            ApplyManualDiskSerialOverrides(currentPayload);
            previewBox.Text = BuildPreview(currentPayload);

            AssetPayload payload = currentPayload;
            string serverUrl = serverUrlBox.Text.Trim();

            ToggleBusy(true, "正在提交到服务端...");
            ThreadPool.QueueUserWorkItem(delegate
            {
                string result = null;
                Exception error = null;

                try { result = ApiClient.Submit(serverUrl, payload); }
                catch (Exception ex) { error = ex; }

                RunOnUi(delegate
                {
                    try
                    {
                        if (error == null)
                        {
                            SetStatus("提交成功");
                            MessageBox.Show(this, "提交成功。\r\n" + result, "完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
                            return;
                        }

                        DialogResult choice = MessageBox.Show(
                            this,
                            "提交失败，可能当前没有网络或服务端不可达。\r\n\r\n" + error.Message + "\r\n\r\n是否保存为离线记录？",
                            "提交失败",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Warning);
                        if (choice == DialogResult.Yes)
                        {
                            SaveStorageSettingsFromUi();
                            OfflineStore.Save(payload);
                            UpdateOfflineCount();
                            SetStatus("提交失败，已保存离线记录");
                            MessageBox.Show(this, "已保存到本地离线记录。", "已保存", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                        else
                        {
                            SetStatus("提交失败");
                        }
                    }
                    finally
                    {
                        ToggleBusy(false, null);
                    }
                });
            });
        }

        private void ExportExcelButton_Click(object sender, EventArgs e)
        {
            SaveStorageSettingsFromUi();
            var assets = new List<AssetPayload>();
            string defaultName = "计算机信息核查-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".xls";

            if (currentPayload != null)
            {
                ApplyUserInfo(currentPayload);
                ApplyManualDiskSerialOverrides(currentPayload);
                previewBox.Text = BuildPreview(currentPayload);
                assets.Add(currentPayload);
            }
            else
            {
                foreach (var record in OfflineStore.Load())
                {
                    if (record.payload != null) assets.Add(record.payload);
                }
                defaultName = "计算机信息核查离线记录-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".xls";
            }

            if (assets.Count == 0)
            {
                MessageBox.Show(this, "没有可导出的数据。请先采集信息，或保存离线记录后再导出。", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            using (var dialog = new SaveFileDialog())
            {
                dialog.Title = "瀵煎嚭 Excel";
                dialog.Filter = "Excel 文件 (*.xls)|*.xls";
                AssetPayload namePayload = currentPayload;
                bool offlineOnly = currentPayload == null;
                string defaultPath = storageSettings.ExcelDefaultPath(offlineOnly, namePayload);
                string defaultDir = Path.GetDirectoryName(defaultPath);
                if (Directory.Exists(defaultDir)) dialog.InitialDirectory = defaultDir;
                dialog.FileName = Path.GetFileName(defaultPath);
                dialog.OverwritePrompt = true;

                if (dialog.ShowDialog(this) != DialogResult.OK) return;

                try
                {
                    AssetExcelExporter.Export(dialog.FileName, assets);
                    SetStatus("Excel 已导出");
                    MessageBox.Show(this, "Excel 已导出：\r\n" + dialog.FileName, "导出完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show(this, ex.Message, "导出失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }

        private void SubmitOfflineButton_Click(object sender, EventArgs e)
        {
            var records = OfflineStore.Load();
            if (records.Count > 0 && !EnsureOfflineRecordsHaveRequiredUserInfo(records)) return;
            if (records.Count == 0)
            {
                MessageBox.Show(this, "当前没有待提交的离线记录。", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            ToggleBusy(true, "正在提交离线记录...");
            string serverUrl = serverUrlBox.Text.Trim();

            ThreadPool.QueueUserWorkItem(delegate
            {
                int success = 0;
                var failed = new List<OfflineAssetRecord>();
                var errors = new StringBuilder();

                foreach (var record in records)
                {
                    try
                    {
                        ApiClient.Submit(serverUrl, record.payload);
                        success++;
                    }
                    catch (Exception ex)
                    {
                        failed.Add(record);
                        if (errors.Length < 1200) errors.AppendLine(record.savedAt + " " + ex.Message);
                    }
                }

                RunOnUi(delegate
                {
                    try
                    {
                        OfflineStore.SaveAll(failed);
                        UpdateOfflineCount();
                        SetStatus("离线提交完成：成功 " + success + "，失败 " + failed.Count);

                        string message = "离线记录提交完成。\r\n成功：" + success + " 条\r\n失败：" + failed.Count + " 条";
                        if (errors.Length > 0) message += "\r\n\r\n失败原因：\r\n" + errors;
                        MessageBox.Show(this, message, "完成", MessageBoxButtons.OK, failed.Count == 0 ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
                    }
                    finally
                    {
                        ToggleBusy(false, null);
                    }
                });
            });
        }

        private bool EnsureCurrentPayload()
        {
            if (currentPayload != null) return true;
            MessageBox.Show(this, "请先点击一键获取信息。", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return false;
        }

        private bool EnsureRequiredUserInfo()
        {
            if (string.IsNullOrWhiteSpace(nameBox.Text))
            {
                MessageBox.Show(this, "提交前请填写使用者姓名。", "必填项", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                nameBox.Focus();
                return false;
            }

            if (string.IsNullOrWhiteSpace(departmentBox.Text))
            {
                MessageBox.Show(this, "提交前请选择或填写部门。", "必填项", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                departmentBox.Focus();
                return false;
            }

            return true;
        }

        private bool EnsureOfflineRecordsHaveRequiredUserInfo(List<OfflineAssetRecord> records)
        {
            for (int i = 0; i < records.Count; i++)
            {
                AssetPayload payload = records[i].payload;
                if (payload == null || payload.user == null || string.IsNullOrWhiteSpace(payload.user.name) || string.IsNullOrWhiteSpace(payload.user.department))
                {
                    MessageBox.Show(this, "离线记录中存在未填写姓名或部门的记录，请先重新采集并保存完整信息后再提交。", "必填项", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return false;
                }
            }

            return true;
        }

        private void ApplyUserInfo(AssetPayload payload)
        {
            payload.user.name = nameBox.Text.Trim();
            payload.user.department = departmentBox.Text.Trim();
            payload.user.employeeId = employeeIdBox.Text.Trim();
            payload.user.location = locationBox.Text.Trim();
            payload.user.phone = phoneBox.Text.Trim();
            payload.user.note = noteBox.Text.Trim();
            payload.system.computerCode = computerCodeBox.Text.Trim();
        }

        private void RefreshPreviewWithManualDiskSerials()
        {
            if (currentPayload == null || previewBox == null) return;
            ApplyManualDiskSerialOverrides(currentPayload);
            previewBox.Text = BuildPreview(currentPayload);
        }

        private void CaptureAutomaticDiskSerials(AssetPayload payload)
        {
            automaticDiskSerials.Clear();
            if (payload == null || payload.disks == null) return;

            for (int i = 0; i < payload.disks.Count; i++)
            {
                DiskInfo disk = payload.disks[i];
                automaticDiskSerials[i] = disk == null ? string.Empty : (disk.serialNumber ?? string.Empty);
            }
        }

        private void ApplyManualDiskSerialOverrides(AssetPayload payload)
        {
            if (payload == null || payload.disks == null || diskSerialOverridesBox == null) return;

            List<ManualDiskSerialRule> rules = ParseManualDiskSerialRules(diskSerialOverridesBox.Text);

            for (int i = 0; i < payload.disks.Count; i++)
            {
                DiskInfo disk = payload.disks[i];
                if (disk == null) continue;

                string automaticSerial = automaticDiskSerials.ContainsKey(i) ? automaticDiskSerials[i] : (disk.serialNumber ?? string.Empty);
                if (IsUsefulDiskSerial(automaticSerial))
                {
                    disk.serialNumber = automaticSerial.Trim();
                    continue;
                }

                disk.serialNumber = automaticSerial ?? string.Empty;
                if (rules.Count == 0) continue;

                string manual = FindManualDiskSerial(rules, i, disk.model);
                if (!string.IsNullOrWhiteSpace(manual))
                {
                    disk.serialNumber = manual.Trim();
                }
            }
        }

        private List<ManualDiskSerialRule> ParseManualDiskSerialRules(string value)
        {
            var rules = new List<ManualDiskSerialRule>();
            if (string.IsNullOrWhiteSpace(value)) return rules;

            string[] parts = value.Split(new[] { ';', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            int nextIndex = 0;
            foreach (string rawPart in parts)
            {
                string part = rawPart.Trim();
                if (part.Length == 0) continue;

                string selector = string.Empty;
                string serial = part;
                int equals = part.IndexOf('=');
                if (equals > 0)
                {
                    selector = part.Substring(0, equals).Trim();
                    serial = part.Substring(equals + 1).Trim();
                }

                if (!IsUsefulDiskSerial(serial)) continue;

                int index = -1;
                if (selector.Length == 0)
                {
                    index = nextIndex;
                    nextIndex++;
                }
                else
                {
                    int parsed;
                    if (int.TryParse(selector, out parsed)) index = parsed > 0 ? parsed - 1 : parsed;
                }

                rules.Add(new ManualDiskSerialRule
                {
                    Index = index,
                    ModelKey = index < 0 ? NormalizeManualDiskText(selector) : string.Empty,
                    SerialNumber = serial
                });
            }

            return rules;
        }

        private string FindManualDiskSerial(List<ManualDiskSerialRule> rules, int index, string model)
        {
            string normalizedModel = NormalizeManualDiskText(model);

            foreach (ManualDiskSerialRule rule in rules)
            {
                if (rule.Index == index) return rule.SerialNumber;
            }

            foreach (ManualDiskSerialRule rule in rules)
            {
                if (rule.ModelKey.Length > 0
                    && normalizedModel.Length > 0
                    && (normalizedModel.Contains(rule.ModelKey) || rule.ModelKey.Contains(normalizedModel)))
                {
                    return rule.SerialNumber;
                }
            }

            return string.Empty;
        }

        private bool IsUsefulDiskSerial(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;

            string serial = value.Trim().Trim('.');
            string normalized = NormalizeManualDiskText(serial);
            if (normalized.Length < 5) return false;
            if (normalized == "none" || normalized == "unknown" || normalized == "na" || normalized == "null") return false;

            Guid guid;
            if (Guid.TryParse(serial, out guid)) return false;

            int alphaNumericCount = 0;
            int hexCount = 0;
            int zeroOrFCount = 0;
            int separatorCount = 0;
            foreach (char c in serial)
            {
                if (char.IsLetterOrDigit(c))
                {
                    alphaNumericCount++;
                    if (Uri.IsHexDigit(c)) hexCount++;
                    char lower = char.ToLowerInvariant(c);
                    if (lower == '0' || lower == 'f') zeroOrFCount++;
                }
                else if (c == '_' || c == '-' || c == ':' || c == ' ')
                {
                    separatorCount++;
                }
            }

            if (alphaNumericCount > 0 && zeroOrFCount == alphaNumericCount) return false;
            if (serial.IndexOf('-') >= 0 && separatorCount >= 4 && alphaNumericCount >= 24 && hexCount == alphaNumericCount) return false;
            if (serial.IndexOf('_') >= 0 && separatorCount >= 4 && alphaNumericCount >= 24 && hexCount >= 24) return false;
            if (separatorCount == 0 && alphaNumericCount >= 24 && hexCount >= 24) return false;

            return alphaNumericCount >= 5;
        }

        private string NormalizeManualDiskText(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;

            var sb = new StringBuilder();
            foreach (char c in value.ToLowerInvariant())
            {
                if (char.IsLetterOrDigit(c)) sb.Append(c);
            }
            return sb.ToString();
        }

        private void UpdateOfflineCount()
        {
            int count = OfflineStore.Count();
            offlineCountLabel.Text = "本地离线待提交记录：" + count + " 条   保存位置：" + OfflineStore.StorePath();
            submitOfflineButton.Enabled = count > 0;
        }

        private string BuildPreview(AssetPayload payload)
        {
            var sb = new StringBuilder();
            AppendSection(sb, "使用人信息");
            AppendLine(sb, "姓名", payload.user.name);
            AppendLine(sb, "部门", payload.user.department);
            AppendLine(sb, "工号", payload.user.employeeId);
            AppendLine(sb, "位置", payload.user.location);
            AppendLine(sb, "电话", payload.user.phone);
            AppendLine(sb, "备注", payload.user.note);

            AppendSection(sb, "系统信息");
            AppendLine(sb, "计算机编号", payload.system.computerCode);
            AppendLine(sb, "计算机名", payload.system.computerName);
            AppendLine(sb, "系统版本", (payload.system.osCaption + " " + payload.system.osVersion).Trim());
            AppendLine(sb, "安装时间", payload.system.installDate);

            AppendSection(sb, "主板信息");
            AppendLine(sb, "厂商", payload.baseBoard.manufacturer);
            AppendLine(sb, "型号", payload.baseBoard.product);
            AppendLine(sb, "序列号", payload.baseBoard.serialNumber);

            AppendSection(sb, "物理网卡（仅 IPv4）");
            if (payload.networkAdapters.Count == 0)
            {
                sb.AppendLine("  未检测到物理网卡");
            }
            for (int i = 0; i < payload.networkAdapters.Count; i++)
            {
                var nic = payload.networkAdapters[i];
                sb.AppendLine("  网卡 " + (i + 1));
                AppendLine(sb, "名称", nic.name, 4);
                AppendLine(sb, "MAC", nic.macAddress, 4);
                AppendLine(sb, "IPv4", nic.ipAddresses.Count == 0 ? "未获取到" : string.Join(", ", nic.ipAddresses.ToArray()), 4);
            }

            AppendSection(sb, "物理硬盘");
            if (payload.disks.Count == 0)
            {
                sb.AppendLine("  未检测到物理硬盘");
            }
            for (int i = 0; i < payload.disks.Count; i++)
            {
                var disk = payload.disks[i];
                sb.AppendLine("  硬盘 " + (i + 1));
                AppendLine(sb, "型号", disk.model, 4);
                AppendLine(sb, "序列号", disk.serialNumber, 4);
                AppendLine(sb, "容量", disk.sizeText, 4);
            }

            return sb.ToString();
        }

        private void AppendSection(StringBuilder sb, string title)
        {
            if (sb.Length > 0) sb.AppendLine();
            sb.AppendLine("==== " + title + " ====");
        }

        private void AppendLine(StringBuilder sb, string label, string value)
        {
            AppendLine(sb, label, value, 2);
        }

        private void AppendLine(StringBuilder sb, string label, string value, int indent)
        {
            sb.Append(new string(' ', indent));
            sb.Append(label.PadRight(8, ' '));
            sb.Append(": ");
            sb.AppendLine(string.IsNullOrEmpty(value) ? "-" : value);
        }

        private void ToggleBusy(bool busy, string text)
        {
            if (collectButton != null) collectButton.Enabled = !busy;
            if (saveOfflineButton != null) saveOfflineButton.Enabled = !busy && currentPayload != null;
            if (exportExcelButton != null) exportExcelButton.Enabled = !busy;
            if (updateButton != null) updateButton.Enabled = !busy;
            if (submitButton != null) submitButton.Enabled = !busy && currentPayload != null;
            if (submitOfflineButton != null) submitOfflineButton.Enabled = !busy && OfflineStore.Count() > 0;
            if (!string.IsNullOrEmpty(text))
            {
                previewBox.Text = text;
                SetStatus(text);
            }
            Cursor = busy ? Cursors.WaitCursor : Cursors.Default;
        }

        private void SetStatus(string text)
        {
            if (statusLabel != null) statusLabel.Text = text;
        }

        private void RunOnUi(MethodInvoker action)
        {
            if (IsDisposed) return;
            if (InvokeRequired) BeginInvoke(action);
            else action();
        }

        private class ManualDiskSerialRule
        {
            public int Index;
            public string ModelKey;
            public string SerialNumber;
        }
    }
}

