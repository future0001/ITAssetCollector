using System;
using System.Diagnostics;
using System.IO;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;
using System.Reflection;

[assembly: AssemblyVersion("1.1.5.0")]
[assembly: AssemblyFileVersion("1.1.5.0")]

namespace AssetCollector
{
    static class Program
    {
        private static Mutex trayMutex;
        private static Mutex mainMutex;
        private static EventWaitHandle mainShowEvent;
        private const string MainMutexName = "Global\\ITAssetCollectorMain";
        private const string MainShowEventName = "Global\\ITAssetCollectorShow";
        public const string InstallFolderName = "ITAssetCollector";

        [STAThread]
        static void Main(string[] args)
        {
            if (args != null && args.Length > 0)
            {
                string command = (args[0] ?? string.Empty).Trim().ToLowerInvariant();
                if (command == "/service" || command == "-service")
                {
                    ServiceBase.Run(new AgentService());
                    return;
                }
                if (command == "/tray" || command == "-tray")
                {
                    RunTray();
                    return;
                }
                if (command == "/install" || command == "-install")
                {
                    RunInstaller();
                    return;
                }
                if (command == "/install-service" || command == "-install-service")
                {
                    RunElevatedInstallCommand(args);
                    return;
                }
                if (command == "/uninstall-service" || command == "-uninstall-service")
                {
                    RunElevatedUninstallCommand();
                    return;
                }
                if (command == "/apply-update" || command == "-apply-update")
                {
                    ApplyUpdateCommand(args);
                    return;
                }
                if (command == "/uninstall" || command == "-uninstall")
                {
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    RequestUninstallClient(null);
                    return;
                }
            }

            if (ServiceNeedsInstallOrRepair())
            {
                RunInstaller();
                return;
            }

            if (!TryClaimMainInstance())
            {
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            try
            {
                Application.Run(new MainForm());
            }
            finally
            {
                if (mainShowEvent != null) mainShowEvent.Dispose();
                if (mainMutex != null) mainMutex.ReleaseMutex();
                if (mainMutex != null) mainMutex.Dispose();
            }
        }

        public static EventWaitHandle MainShowEvent
        {
            get { return mainShowEvent; }
        }

        private static bool TryClaimMainInstance()
        {
            bool created;
            mainMutex = new Mutex(true, MainMutexName, out created);
            if (created)
            {
                mainShowEvent = new EventWaitHandle(false, EventResetMode.AutoReset, MainShowEventName);
                return true;
            }

            SignalMainWindow();
            mainMutex.Close();
            mainMutex = null;
            return false;
        }

        private static void SignalMainWindow()
        {
            try
            {
                using (EventWaitHandle handle = EventWaitHandle.OpenExisting(MainShowEventName))
                {
                    handle.Set();
                }
            }
            catch
            {
            }
        }

        private static void RunTray()
        {
            bool created;
            trayMutex = new Mutex(true, "Global\\ITAssetCollectorTray", out created);
            if (!created) return;

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new AgentTrayContext());
        }

        private static void RunInstaller()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallForm());
        }

        public static bool IsAdministrator()
        {
            try
            {
                WindowsIdentity identity = WindowsIdentity.GetCurrent();
                WindowsPrincipal principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
            catch
            {
                return false;
            }
        }

        public static void RestartElevatedInstall(string serverUrl, string userName, string department)
        {
            var psi = new ProcessStartInfo();
            psi.FileName = Application.ExecutablePath;
            psi.Arguments = BuildArguments(new[] { "/install-service", serverUrl, userName, department });
            psi.UseShellExecute = true;
            psi.Verb = "runas";
            Process.Start(psi);
        }

        public static void RestartElevatedUninstall()
        {
            var psi = new ProcessStartInfo();
            psi.FileName = Application.ExecutablePath;
            psi.Arguments = "/uninstall-service";
            psi.UseShellExecute = true;
            psi.Verb = "runas";
            Process.Start(psi);
        }

        private static void RunElevatedInstallCommand(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                string serverUrl = args.Length > 1 ? args[1] : DiscoveryClient.FallbackServerUrl;
                string userName = args.Length > 2 ? args[2] : string.Empty;
                string department = args.Length > 3 ? args[3] : string.Empty;

                InstallClient(serverUrl, userName, department);
                MessageBox.Show("Client installed. Background service and tray have started.", "Install complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "安装失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static void RunElevatedUninstallCommand()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                UninstallService();
                MessageBox.Show("客户端后台服务和托盘自启动已卸载。", "卸载完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "卸载失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static bool ServiceNeedsInstallOrRepair()
        {
            ServiceController service = FindService();
            if (service == null) return true;
            try
            {
                service.Refresh();
                if (service.Status != ServiceControllerStatus.Running && service.Status != ServiceControllerStatus.StartPending)
                {
                    return true;
                }
            }
            catch
            {
                return true;
            }

            string binaryPath = QueryServiceBinaryPath();
            if (string.IsNullOrWhiteSpace(binaryPath)) return true;

            string currentExe = Path.GetFullPath(InstalledExecutablePath());
            string serviceExe = ExtractExePath(binaryPath);
            return !string.Equals(currentExe, serviceExe, StringComparison.OrdinalIgnoreCase);
        }

        private static ServiceController FindService()
        {
            try
            {
                ServiceController[] services = ServiceController.GetServices();
                foreach (ServiceController service in services)
                {
                    if (string.Equals(service.ServiceName, AgentService.ServiceNameValue, StringComparison.OrdinalIgnoreCase))
                    {
                        return service;
                    }
                }
            }
            catch
            {
            }

            return null;
        }

        private static string QueryServiceBinaryPath()
        {
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\" + AgentService.ServiceNameValue))
                {
                    return key == null ? string.Empty : Convert.ToString(key.GetValue("ImagePath"));
                }
            }
            catch
            {
                return string.Empty;
            }
        }

        private static string ExtractExePath(string binaryPath)
        {
            string value = (binaryPath ?? string.Empty).Trim();
            if (value.Length == 0) return string.Empty;

            if (value.StartsWith("\"", StringComparison.Ordinal))
            {
                int end = value.IndexOf('"', 1);
                return end > 1 ? Path.GetFullPath(value.Substring(1, end - 1)) : string.Empty;
            }

            int exeIndex = value.IndexOf(".exe", StringComparison.OrdinalIgnoreCase);
            if (exeIndex >= 0) return Path.GetFullPath(value.Substring(0, exeIndex + 4));
            return value;
        }

        public static string InstallDirectory()
        {
            string programFiles = Environment.GetEnvironmentVariable("ProgramW6432");
            if (string.IsNullOrWhiteSpace(programFiles))
            {
                programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            }
            if (string.IsNullOrWhiteSpace(programFiles))
            {
                programFiles = Path.Combine(Path.GetPathRoot(Environment.SystemDirectory), "Program Files");
            }

            return Path.Combine(programFiles, InstallFolderName);
        }

        public static string InstalledExecutablePath()
        {
            return Path.Combine(InstallDirectory(), Path.GetFileName(Application.ExecutablePath));
        }

        public static void InstallClient(string serverUrl, string userName, string department)
        {
            RemoveExistingService();
            StopInstalledTrayProcesses();

            string installedExe = InstallFiles();
            AgentSettings.SaveInstallSettings(installedExe, serverUrl, userName, department);
            InstallService(installedExe);
            CreateDesktopShortcut(installedExe);
        }

        public static string CurrentVersion()
        {
            try
            {
                string version = FileVersionInfo.GetVersionInfo(Application.ExecutablePath).FileVersion;
                return string.IsNullOrWhiteSpace(version) ? "1.0.0.0" : version;
            }
            catch
            {
                return "1.0.0.0";
            }
        }

        public static bool TryStartAutoUpdate(AgentSettings settings)
        {
            if (settings == null || string.IsNullOrWhiteSpace(settings.serverUrl)) return false;

            ClientUpdateInfo update = ApiClient.CheckClientUpdate(settings.serverUrl, CurrentVersion());
            if (update == null || !update.updateAvailable || string.IsNullOrWhiteSpace(update.exeUrl)) return false;
            if (!ApiClient.VerifyUpdateSignature(update))
            {
                throw new InvalidOperationException("Client update signature verification failed.");
            }

            string root = Path.Combine(Path.GetTempPath(), "ITAssetCollectorUpdate", DateTime.Now.ToString("yyyyMMddHHmmss"));
            Directory.CreateDirectory(root);
            string newExe = Path.Combine(root, Path.GetFileName(InstalledExecutablePath()));
            string newConfig = Path.Combine(root, Path.GetFileName(InstalledExecutablePath()) + ".config");
            string updaterExe = Path.Combine(root, "ITAssetCollectorUpdater.exe");

            ApiClient.DownloadFile(settings.serverUrl, update.exeUrl, newExe);
            if (!ApiClient.VerifySha256(newExe, update.sha256))
            {
                throw new InvalidOperationException("Client update package verification failed.");
            }
            if (!string.IsNullOrWhiteSpace(update.configUrl))
            {
                ApiClient.DownloadFile(settings.serverUrl, update.configUrl, newConfig);
            }

            File.Copy(Application.ExecutablePath, updaterExe, true);
            var psi = new ProcessStartInfo();
            psi.FileName = updaterExe;
            psi.Arguments = BuildArguments(new[] { "/apply-update", newExe, File.Exists(newConfig) ? newConfig : string.Empty, InstalledExecutablePath() });
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            Process.Start(psi);
            return true;
        }

        private static void ApplyUpdateCommand(string[] args)
        {
            if (args == null || args.Length < 4) return;
            string newExe = args[1];
            string newConfig = args[2];
            string targetExe = args[3];
            string targetConfig = targetExe + ".config";

            TryRunSc("stop", AgentService.ServiceNameValue);
            WaitForServiceStopped();
            StopInstalledTrayProcesses(targetExe);
            WaitForFileWritable(targetExe, 20);

            File.Copy(newExe, targetExe, true);
            if (!string.IsNullOrWhiteSpace(newConfig) && File.Exists(newConfig))
            {
                if (!File.Exists(targetConfig)) File.Copy(newConfig, targetConfig, true);
                else AgentSettings.MergeAppSettings(targetExe, newConfig);
            }

            TryRunSc("start", AgentService.ServiceNameValue);
            try { StartTrayProcess(targetExe); }
            catch { }
        }

        private static void WaitForServiceStopped()
        {
            DateTime deadline = DateTime.Now.AddSeconds(20);
            while (DateTime.Now < deadline)
            {
                try
                {
                    ServiceController service = FindService();
                    if (service == null) return;
                    service.Refresh();
                    if (service.Status == ServiceControllerStatus.Stopped) return;
                }
                catch
                {
                    return;
                }
                Thread.Sleep(500);
            }
        }

        private static void WaitForFileWritable(string path, int seconds)
        {
            DateTime deadline = DateTime.Now.AddSeconds(seconds);
            while (DateTime.Now < deadline)
            {
                try
                {
                    using (FileStream stream = new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None))
                    {
                    }
                    return;
                }
                catch
                {
                    Thread.Sleep(500);
                }
            }
        }

        public static void InstallService()
        {
            InstallService(InstalledExecutablePath());
        }

        private static void InstallService(string exe)
        {
            RemoveExistingService();

            RunSc("create", AgentService.ServiceNameValue, "binPath=", "\"" + exe + "\" /service", "start=", "auto", "DisplayName=", "IT Asset Collector Agent");
            RunSc("description", AgentService.ServiceNameValue, "IT asset background collection agent");
            RunSc("start", AgentService.ServiceNameValue);
            EnableTrayStartup(exe);
            StartTrayProcess(exe);
        }

        public static void UninstallService()
        {
            RemoveExistingService();
            DisableTrayStartup();
        }

        public static bool RequestUninstallClient(IWin32Window owner)
        {
            DialogResult result = MessageBox.Show(owner,
                "此操作会停止并删除客户端后台服务，并取消托盘自启动。\r\n\r\n服务端离线时也可以卸载，但需要本机管理员权限。是否继续？",
                "卸载客户端",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning);
            if (result != DialogResult.Yes) return false;

            if (!IsAdministrator())
            {
                RestartElevatedUninstall();
                return true;
            }

            UninstallService();
            MessageBox.Show(owner, "客户端后台服务和托盘自启动已卸载。", "卸载完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return true;
        }

        public static bool VerifySensitiveOperation(IWin32Window owner, string title)
        {
            return SecurityClient.PromptAndVerify(owner, AgentSettings.Load().serverUrl, title);
        }

        private static void RemoveExistingService()
        {
            if (FindService() == null) return;

            TryRunSc("stop", AgentService.ServiceNameValue);
            RunSc("delete", AgentService.ServiceNameValue);

            DateTime deadline = DateTime.Now.AddSeconds(8);
            while (DateTime.Now < deadline)
            {
                if (FindService() == null) return;
                Thread.Sleep(250);
            }
        }

        private static string InstallFiles()
        {
            string installDir = InstallDirectory();
            string installedExe = InstalledExecutablePath();
            Directory.CreateDirectory(installDir);

            string sourceExe = Path.GetFullPath(Application.ExecutablePath);
            if (!string.Equals(sourceExe, installedExe, StringComparison.OrdinalIgnoreCase))
            {
                File.Copy(sourceExe, installedExe, true);
            }

            string sourceConfig = sourceExe + ".config";
            string installedConfig = installedExe + ".config";
            if (File.Exists(sourceConfig) && !string.Equals(sourceConfig, installedConfig, StringComparison.OrdinalIgnoreCase))
            {
                if (!File.Exists(installedConfig))
                {
                    File.Copy(sourceConfig, installedConfig, true);
                }
                else
                {
                    AgentSettings.MergeAppSettings(installedExe, sourceConfig);
                }
            }
            else if (!File.Exists(installedConfig))
            {
                File.WriteAllText(installedConfig, DefaultConfigXml(), Encoding.UTF8);
            }

            return installedExe;
        }

        private static string DefaultConfigXml()
        {
            return "<?xml version=\"1.0\" encoding=\"utf-8\" ?>\r\n"
                + "<configuration>\r\n"
                + "  <appSettings>\r\n"
                + "    <add key=\"ServerUrl\" value=\"" + DiscoveryClient.FallbackServerUrl + "\" />\r\n"
                + "    <add key=\"UpdateSigningPublicKey\" value=\"\" />\r\n"
                + "    <add key=\"ClientFlavor\" value=\"win\" />\r\n"
                + "    <add key=\"DiscoveryPort\" value=\"33030\" />\r\n"
                + "    <add key=\"AgentPollSeconds\" value=\"30\" />\r\n"
                + "    <add key=\"AgentUserName\" value=\"\" />\r\n"
                + "    <add key=\"AgentDepartment\" value=\"\" />\r\n"
                + "  </appSettings>\r\n"
                + "  <startup>\r\n"
                + "    <supportedRuntime version=\"v4.0\" sku=\".NETFramework,Version=v4.0\" />\r\n"
                + "  </startup>\r\n"
                + "</configuration>\r\n";
        }

        private static void StopInstalledTrayProcesses()
        {
            StopInstalledTrayProcesses(InstalledExecutablePath());
        }

        private static void StopInstalledTrayProcesses(string exePath)
        {
            string installedExe = Path.GetFullPath(exePath);
            string processName = Path.GetFileNameWithoutExtension(installedExe);
            Process current = Process.GetCurrentProcess();

            foreach (Process process in Process.GetProcessesByName(processName))
            {
                try
                {
                    if (process.Id == current.Id) continue;
                    string path = Path.GetFullPath(process.MainModule.FileName);
                    if (!string.Equals(path, installedExe, StringComparison.OrdinalIgnoreCase)) continue;
                    process.Kill();
                    process.WaitForExit(5000);
                }
                catch
                {
                }
            }
        }

        private static void EnableTrayStartup(string exe)
        {
            using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
            {
                if (key != null) key.SetValue("ITAssetCollectorTray", "\"" + exe + "\" /tray");
            }
        }

        private static void StartTrayProcess(string exe)
        {
            var psi = new ProcessStartInfo();
            psi.FileName = exe;
            psi.Arguments = "/tray";
            psi.UseShellExecute = true;
            Process.Start(psi);
        }

        private static void CreateDesktopShortcut(string exe)
        {
            try
            {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                if (string.IsNullOrWhiteSpace(desktop)) return;

                string shortcutPath = Path.Combine(desktop, "计算机信息核查.lnk");
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return;

                object shell = Activator.CreateInstance(shellType);
                object shortcut = shellType.InvokeMember("CreateShortcut", System.Reflection.BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
                Type shortcutType = shortcut.GetType();
                shortcutType.InvokeMember("TargetPath", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { exe });
                shortcutType.InvokeMember("WorkingDirectory", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { Path.GetDirectoryName(exe) });
                shortcutType.InvokeMember("IconLocation", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { exe + ",0" });
                shortcutType.InvokeMember("Save", System.Reflection.BindingFlags.InvokeMethod, null, shortcut, null);
            }
            catch
            {
            }
        }

        private static void DisableTrayStartup()
        {
            using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
            {
                if (key != null) key.DeleteValue("ITAssetCollectorTray", false);
            }
        }

        private static void RunSc(params string[] args)
        {
            var psi = new ProcessStartInfo();
            psi.FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "sc.exe");
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.Arguments = BuildArguments(args);
            using (var process = Process.Start(psi))
            {
                string output = process.StandardOutput.ReadToEnd();
                string error = process.StandardError.ReadToEnd();
                process.WaitForExit();
                if (process.ExitCode != 0)
                {
                    throw new InvalidOperationException("服务命令执行失败：sc.exe " + psi.Arguments + Environment.NewLine + output + error);
                }
            }
        }

        private static void TryRunSc(params string[] args)
        {
            try { RunSc(args); }
            catch { }
        }

        private static string BuildArguments(string[] args)
        {
            string text = string.Empty;
            foreach (string arg in args)
            {
                if (text.Length > 0) text += " ";
                text += Quote(arg);
            }
            return text;
        }

        private static string Quote(string value)
        {
            value = value ?? string.Empty;
            return value.IndexOfAny(new[] { ' ', '\t', '"' }) >= 0 ? "\"" + value.Replace("\"", "\\\"") + "\"" : value;
        }
    }
}

