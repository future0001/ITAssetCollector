using System;
using System.Collections.Generic;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;

namespace AssetCollector
{
    public class InstallForm : Form
    {
        private TextBox serverUrlBox;
        private TextBox nameBox;
        private ComboBox departmentBox;
        private Label statusLabel;
        private Button installButton;
        private Button detectButton;
        private Button cancelButton;
        private ToolTip uiToolTip;
        private Dictionary<string, string> organizationEmployeeDepartments = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private bool organizationLoadInProgress;
        private static readonly Color AppBackColor = Color.FromArgb(238, 246, 252);
        private static readonly Color TextColor = Color.FromArgb(16, 32, 51);
        private static readonly Color MutedTextColor = Color.FromArgb(70, 87, 107);
        private static readonly Color PanelBorderColor = Color.FromArgb(199, 216, 230);
        private static readonly Color AccentBackColor = Color.FromArgb(222, 241, 252);
        private static readonly Color AccentBorderColor = Color.FromArgb(105, 173, 216);
        private static readonly Color AccentTextColor = Color.FromArgb(15, 53, 84);

        public InstallForm()
        {
            Text = "\u8ba1\u7b97\u673a\u4fe1\u606f\u6838\u67e5\u5ba2\u6237\u7aef\u5b89\u88c5";
            TryUseApplicationIcon();
            Width = 520;
            Height = 330;
            MinimumSize = new Size(480, 320);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Microsoft YaHei UI", 9F);
            BackColor = AppBackColor;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;

            BuildUi();
            LoadExistingSettings();
            nameBox.TextChanged += delegate { ApplyDepartmentFromOrganization(); };
            nameBox.Leave += delegate { ApplyDepartmentFromOrganization(); };
            serverUrlBox.Leave += delegate { BeginLoadOrganizationDepartments(); };
            Shown += delegate { BeginDiscoverServer(false); };
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
            root.RowCount = 4;
            root.Padding = new Padding(18);
            root.BackColor = AppBackColor;
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            Controls.Add(root);

            var title = new Label();
            title.Text = "\u5b89\u88c5\u524d\u8bf7\u586b\u5199\u4f7f\u7528\u4eba\u4fe1\u606f";
            title.Font = new Font(Font.FontFamily, 12F, FontStyle.Bold);
            title.ForeColor = TextColor;
            title.AutoSize = true;
            title.Margin = new Padding(0, 0, 0, 14);
            root.Controls.Add(title, 0, 0);

            root.Controls.Add(BuildFields(), 0, 1);
            root.Controls.Add(BuildButtons(), 0, 2);

            statusLabel = new Label();
            statusLabel.AutoSize = true;
            statusLabel.Margin = new Padding(0, 12, 0, 0);
            statusLabel.ForeColor = MutedTextColor;
            statusLabel.Text = "\u6b63\u5728\u81ea\u52a8\u63a2\u6d4b\u670d\u52a1\u5668...";
            root.Controls.Add(statusLabel, 0, 3);
        }

        private Control BuildFields()
        {
            var panel = new TableLayoutPanel();
            panel.Dock = DockStyle.Top;
            panel.ColumnCount = 3;
            panel.RowCount = 3;
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 88));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 96));

            panel.Controls.Add(Label("\u670d\u52a1\u5668\u5730\u5740"), 0, 0);
            serverUrlBox = new TextBox { Dock = DockStyle.Fill, Margin = new Padding(0, 4, 8, 4), Text = ApiClient.DefaultServerUrl() };
            StyleTextBox(serverUrlBox);
            panel.Controls.Add(serverUrlBox, 1, 0);
            detectButton = new Button { Text = "\u91cd\u65b0\u63a2\u6d4b", Dock = DockStyle.Fill, Height = 30, Margin = new Padding(0, 3, 0, 3) };
            StyleSecondaryButton(detectButton);
            detectButton.Click += delegate { BeginDiscoverServer(true); };
            panel.Controls.Add(detectButton, 2, 0);

            panel.Controls.Add(Label("\u5458\u5de5\u59d3\u540d *"), 0, 1);
            nameBox = new TextBox { Dock = DockStyle.Fill, Margin = new Padding(0, 4, 8, 4) };
            StyleTextBox(nameBox);
            panel.Controls.Add(nameBox, 1, 1);
            panel.SetColumnSpan(nameBox, 2);

            panel.Controls.Add(Label("\u90e8\u95e8 *"), 0, 2);
            departmentBox = new ComboBox { Dock = DockStyle.Fill, Margin = new Padding(0, 4, 8, 4), DropDownStyle = ComboBoxStyle.DropDown };
            StyleComboBox(departmentBox);
            departmentBox.AutoCompleteMode = AutoCompleteMode.SuggestAppend;
            departmentBox.AutoCompleteSource = AutoCompleteSource.ListItems;
            panel.Controls.Add(departmentBox, 1, 2);
            panel.SetColumnSpan(departmentBox, 2);

            return panel;
        }

        private void LoadExistingSettings()
        {
            AgentSettings settings = AgentSettings.Load();
            if (!string.IsNullOrWhiteSpace(settings.serverUrl)) serverUrlBox.Text = settings.serverUrl;
            nameBox.Text = settings.userName;
            departmentBox.Text = settings.department;
        }

        private Label Label(string text)
        {
            return new Label { Text = text, AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 9, 8, 7), ForeColor = TextColor };
        }

        private Control BuildButtons()
        {
            var panel = new FlowLayoutPanel();
            panel.Dock = DockStyle.Fill;
            panel.FlowDirection = FlowDirection.RightToLeft;
            panel.Height = 42;
            panel.Margin = new Padding(0, 14, 0, 0);

            installButton = new Button { Text = "\u5b89\u88c5", Width = 92, Height = 34, Margin = new Padding(8, 0, 0, 0) };
            StylePrimaryButton(installButton);
            installButton.Click += InstallButton_Click;
            panel.Controls.Add(installButton);

            cancelButton = new Button { Text = "\u53d6\u6d88", Width = 92, Height = 34, Margin = new Padding(8, 0, 0, 0) };
            StyleSecondaryButton(cancelButton);
            cancelButton.Click += delegate { Close(); };
            panel.Controls.Add(cancelButton);

            return panel;
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            uiToolTip = new ToolTip();
            uiToolTip.SetToolTip(serverUrlBox, "可自动检测，也可手动填写服务端地址。");
            uiToolTip.SetToolTip(nameBox, "填写后会尝试按组织架构自动匹配部门。");
            uiToolTip.SetToolTip(departmentBox, "可从组织架构下拉选择，也可手动输入。");
            uiToolTip.SetToolTip(installButton, "安装后后台服务和托盘会自动启动，桌面快捷方式可重新打开客户端。");
        }

        private void StylePrimaryButton(Button button)
        {
            if (button == null) return;
            button.BackColor = AccentBackColor;
            button.ForeColor = AccentTextColor;
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderColor = AccentBorderColor;
            button.FlatAppearance.MouseOverBackColor = Color.FromArgb(209, 234, 250);
            button.FlatAppearance.MouseDownBackColor = Color.FromArgb(190, 222, 244);
            button.UseVisualStyleBackColor = false;
        }

        private void StyleSecondaryButton(Button button)
        {
            if (button == null) return;
            button.BackColor = Color.White;
            button.ForeColor = TextColor;
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderColor = PanelBorderColor;
            button.FlatAppearance.MouseOverBackColor = Color.FromArgb(245, 250, 255);
            button.FlatAppearance.MouseDownBackColor = Color.FromArgb(232, 244, 255);
            button.UseVisualStyleBackColor = false;
        }

        private void StyleTextBox(TextBox box)
        {
            if (box == null) return;
            box.BorderStyle = BorderStyle.FixedSingle;
            box.BackColor = Color.White;
            box.ForeColor = TextColor;
        }

        private void StyleComboBox(ComboBox box)
        {
            if (box == null) return;
            box.BackColor = Color.White;
            box.ForeColor = TextColor;
            box.FlatStyle = FlatStyle.Standard;
        }

        private void BeginDiscoverServer(bool showResult)
        {
            string preferredUrl = serverUrlBox.Text.Trim();
            ToggleBusy(true, "\u6b63\u5728\u81ea\u52a8\u63a2\u6d4b\u670d\u52a1\u5668...");

            ThreadPool.QueueUserWorkItem(delegate
            {
                string url = DiscoveryClient.FallbackServerUrl;
                Exception error = null;

                try { url = DiscoveryClient.DiscoverServerUrl(1800, preferredUrl); }
                catch (Exception ex) { error = ex; }

                RunOnUi(delegate
                {
                    serverUrlBox.Text = url;
                    ToggleBusy(false, "\u670d\u52a1\u5668\u5730\u5740\uff1a" + url + (string.Equals(url, DiscoveryClient.FallbackServerUrl, StringComparison.OrdinalIgnoreCase) ? " \uff08\u515c\u5e95\uff09" : string.Empty));
                    BeginLoadOrganizationDepartments();
                    if (showResult)
                    {
                        string message = error == null ? "\u5df2\u8bbe\u7f6e\u670d\u52a1\u5668\u5730\u5740\uff1a\r\n" + url : error.Message + "\r\n\r\n\u5df2\u4f7f\u7528\u515c\u5e95\u5730\u5740\uff1a\r\n" + url;
                        MessageBox.Show(this, message, "\u81ea\u52a8\u63a2\u6d4b", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                });
            });
        }

        private void BeginLoadOrganizationDepartments()
        {
            if (departmentBox == null || serverUrlBox == null || organizationLoadInProgress) return;
            organizationLoadInProgress = true;
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
                    if (directory == null) return;
                    organizationEmployeeDepartments = directory.EmployeeDepartments ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    string current = departmentBox.Text;
                    departmentBox.BeginUpdate();
                    departmentBox.Items.Clear();
                    foreach (string department in UniqueNonEmpty(directory.Departments))
                    {
                        departmentBox.Items.Add(department);
                    }
                    departmentBox.EndUpdate();
                    departmentBox.Text = current;
                    ApplyDepartmentFromOrganization();
                });
            });
        }

        private IEnumerable<string> UniqueNonEmpty(IEnumerable<string> values)
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (string value in values ?? new string[0])
            {
                string name = (value ?? string.Empty).Trim();
                if (name.Length == 0 || seen.Contains(name)) continue;
                seen.Add(name);
                yield return name;
            }
        }

        private void ApplyDepartmentFromOrganization()
        {
            if (nameBox == null || departmentBox == null || organizationEmployeeDepartments == null) return;
            string userName = nameBox.Text.Trim();
            if (userName.Length == 0) return;

            string department;
            if (!organizationEmployeeDepartments.TryGetValue(userName, out department)) return;
            if (!string.IsNullOrWhiteSpace(department)) departmentBox.Text = department.Trim();
        }

        private void InstallButton_Click(object sender, EventArgs e)
        {
            string serverUrl = serverUrlBox.Text.Trim();
            string userName = nameBox.Text.Trim();
            string department = departmentBox.Text.Trim();
            AgentSettings existing = AgentSettings.LoadFromExe(Program.InstalledExecutablePath());
            if (userName.Length == 0) userName = existing.userName;
            if (department.Length == 0) department = existing.department;
            if (serverUrl.Length == 0) serverUrl = existing.serverUrl;

            if (serverUrl.Length == 0) serverUrl = DiscoveryClient.FallbackServerUrl;
            if (userName.Length == 0)
            {
                MessageBox.Show(this, "\u8bf7\u586b\u5199\u5458\u5de5\u59d3\u540d\u3002", "\u5fc5\u586b\u9879", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                nameBox.Focus();
                return;
            }
            if (department.Length == 0)
            {
                MessageBox.Show(this, "\u8bf7\u586b\u5199\u90e8\u95e8\u3002", "\u5fc5\u586b\u9879", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                departmentBox.Focus();
                return;
            }

            ToggleBusy(true, "\u6b63\u5728\u5199\u5165\u914d\u7f6e\u5e76\u5b89\u88c5\u670d\u52a1...");
            try
            {
                if (!Program.IsAdministrator())
                {
                    Program.RestartElevatedInstall(serverUrl, userName, department);
                    MessageBox.Show(this, "\u8bf7\u5728\u5f39\u51fa\u7684\u7ba1\u7406\u5458\u6743\u9650\u7a97\u53e3\u4e2d\u70b9\u51fb\u5141\u8bb8\uff0c\u5b89\u88c5\u5c06\u81ea\u52a8\u7ee7\u7eed\u3002", "\u9700\u8981\u7ba1\u7406\u5458\u6743\u9650", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    Close();
                    return;
                }

                Program.InstallClient(serverUrl, userName, department);
                MessageBox.Show(this, "\u5ba2\u6237\u7aef\u5b89\u88c5\u5b8c\u6210\uff0c\u540e\u53f0\u670d\u52a1\u548c\u6258\u76d8\u5df2\u542f\u52a8\u3002\r\n\r\n\u5b89\u88c5\u76ee\u5f55\uff1a" + Program.InstallDirectory(), "\u5b89\u88c5\u5b8c\u6210", MessageBoxButtons.OK, MessageBoxIcon.Information);
                Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, "\u5b89\u88c5\u5931\u8d25", MessageBoxButtons.OK, MessageBoxIcon.Error);
                ToggleBusy(false, "\u5b89\u88c5\u5931\u8d25");
            }
        }

        private void ToggleBusy(bool busy, string text)
        {
            if (detectButton != null) detectButton.Enabled = !busy;
            if (installButton != null) installButton.Enabled = !busy;
            if (cancelButton != null) cancelButton.Enabled = !busy;
            if (statusLabel != null) statusLabel.Text = text;
            Cursor = busy ? Cursors.WaitCursor : Cursors.Default;
        }

        private void RunOnUi(MethodInvoker action)
        {
            if (IsDisposed) return;
            if (InvokeRequired) BeginInvoke(action);
            else action();
        }
    }
}
