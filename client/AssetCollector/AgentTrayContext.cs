using System;
using System.Diagnostics;
using System.Drawing;
using System.ServiceProcess;
using System.Windows.Forms;

namespace AssetCollector
{
    public class AgentTrayContext : ApplicationContext
    {
        private readonly NotifyIcon notifyIcon;
        private readonly Timer refreshTimer;
        private readonly MenuItem statusItem;

        public AgentTrayContext()
        {
            statusItem = new MenuItem("服务状态：检测中") { Enabled = false };
            var menu = new ContextMenu(new[]
            {
                statusItem,
                new MenuItem("-"),
                new MenuItem("打开客户端", delegate { OpenMainApp(); }),
                new MenuItem("启动服务", delegate { StartService(); }),
                new MenuItem("停止服务", delegate { StopService(); }),
                new MenuItem("重启服务", delegate { RestartService(); }),
                new MenuItem("-"),
                new MenuItem("安装服务", delegate { Program.InstallService(); }),
                new MenuItem("卸载服务", delegate { if (Program.VerifySensitiveOperation(null, "卸载服务")) Program.UninstallService(); })
            });

            notifyIcon = new NotifyIcon
            {
                Text = "IT 资产采集客户端",
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application,
                ContextMenu = menu,
                Visible = true
            };
            notifyIcon.DoubleClick += delegate { OpenMainApp(); };

            refreshTimer = new Timer { Interval = 5000 };
            refreshTimer.Tick += delegate { RefreshStatus(); };
            refreshTimer.Start();
            RefreshStatus();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                refreshTimer.Stop();
                refreshTimer.Dispose();
                notifyIcon.Visible = false;
                notifyIcon.Dispose();
            }
            base.Dispose(disposing);
        }

        private void RefreshStatus()
        {
            string status = ServiceStatusText();
            statusItem.Text = "服务状态：" + status;
            notifyIcon.Text = ("IT 资产采集客户端 - " + status).Length > 63
                ? "IT 资产采集客户端"
                : "IT 资产采集客户端 - " + status;
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

        private void OpenMainApp()
        {
            Process.Start(Application.ExecutablePath);
        }

        private void StartService()
        {
            ControlService(delegate(ServiceController service) {
                if (service.Status == ServiceControllerStatus.Stopped) service.Start();
            });
        }

        private void StopService()
        {
            if (!Program.VerifySensitiveOperation(null, "停止服务")) return;
            ControlService(delegate(ServiceController service) {
                if (service.CanStop && service.Status != ServiceControllerStatus.Stopped) service.Stop();
            });
        }

        private void RestartService()
        {
            if (!Program.VerifySensitiveOperation(null, "重启服务")) return;
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
                MessageBox.Show(ex.Message, "服务操作失败", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            RefreshStatus();
        }
    }
}
