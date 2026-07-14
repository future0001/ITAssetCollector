using System;
using System.Drawing;
using System.Windows.Forms;

namespace AssetCollector
{
    public class PasswordPromptForm : Form
    {
        private TextBox passwordBox;

        public string Password
        {
            get { return passwordBox == null ? string.Empty : passwordBox.Text; }
        }

        public PasswordPromptForm(string title)
        {
            Text = string.IsNullOrWhiteSpace(title) ? "请输入密钥" : title;
            Width = 380;
            Height = 160;
            StartPosition = FormStartPosition.CenterParent;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            Font = new Font("Microsoft YaHei UI", 9F);
            BuildUi();
        }

        private void BuildUi()
        {
            var root = new TableLayoutPanel();
            root.Dock = DockStyle.Fill;
            root.Padding = new Padding(14);
            root.ColumnCount = 1;
            root.RowCount = 3;
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            Controls.Add(root);

            root.Controls.Add(new Label { Text = "请输入密钥以继续操作：", AutoSize = true, Margin = new Padding(0, 0, 0, 8) }, 0, 0);
            passwordBox = new TextBox { Dock = DockStyle.Top, UseSystemPasswordChar = true };
            passwordBox.KeyDown += delegate(object sender, KeyEventArgs e)
            {
                if (e.KeyCode == Keys.Enter)
                {
                    DialogResult = DialogResult.OK;
                    Close();
                }
            };
            root.Controls.Add(passwordBox, 0, 1);

            var buttons = new FlowLayoutPanel();
            buttons.Dock = DockStyle.Bottom;
            buttons.FlowDirection = FlowDirection.RightToLeft;
            buttons.Height = 38;
            buttons.Margin = new Padding(0, 14, 0, 0);
            root.Controls.Add(buttons, 0, 2);

            var okButton = new Button { Text = "确定", Width = 82, Height = 30 };
            okButton.Click += delegate { DialogResult = DialogResult.OK; Close(); };
            buttons.Controls.Add(okButton);

            var cancelButton = new Button { Text = "取消", Width = 82, Height = 30, Margin = new Padding(8, 0, 0, 0) };
            cancelButton.Click += delegate { DialogResult = DialogResult.Cancel; Close(); };
            buttons.Controls.Add(cancelButton);

            AcceptButton = okButton;
            CancelButton = cancelButton;
        }
    }
}
