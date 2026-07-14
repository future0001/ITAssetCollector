using System;
using System.Configuration;

namespace AssetCollector
{
    public class AgentSettings
    {
        public string serverUrl { get; set; }
        public string userName { get; set; }
        public string department { get; set; }
        public string employeeId { get; set; }
        public string location { get; set; }
        public string phone { get; set; }
        public string note { get; set; }
        public int pollSeconds { get; set; }

        public static AgentSettings Load()
        {
            return new AgentSettings
            {
                serverUrl = ApiClient.DefaultServerUrl(),
                userName = Value("AgentUserName"),
                department = Value("AgentDepartment"),
                employeeId = Value("AgentEmployeeId"),
                location = Value("AgentLocation"),
                phone = Value("AgentPhone"),
                note = Value("AgentNote"),
                pollSeconds = Math.Max(10, IntValue("AgentPollSeconds", 30))
            };
        }

        public static AgentSettings LoadFromExe(string exePath)
        {
            if (string.IsNullOrWhiteSpace(exePath)) return new AgentSettings { serverUrl = string.Empty };
            try
            {
                ExeConfigurationFileMap map = new ExeConfigurationFileMap();
                map.ExeConfigFilename = exePath + ".config";
                Configuration config = ConfigurationManager.OpenMappedExeConfiguration(map, ConfigurationUserLevel.None);
                return FromConfiguration(config);
            }
            catch
            {
                return new AgentSettings { serverUrl = string.Empty };
            }
        }

        private static AgentSettings FromConfiguration(Configuration config)
        {
            return new AgentSettings
            {
                serverUrl = ConfigValue(config, "ServerUrl"),
                userName = ConfigValue(config, "AgentUserName"),
                department = ConfigValue(config, "AgentDepartment"),
                employeeId = ConfigValue(config, "AgentEmployeeId"),
                location = ConfigValue(config, "AgentLocation"),
                phone = ConfigValue(config, "AgentPhone"),
                note = ConfigValue(config, "AgentNote"),
                pollSeconds = Math.Max(10, ConfigIntValue(config, "AgentPollSeconds", 30))
            };
        }

        public void ApplyTo(AssetPayload payload)
        {
            if (payload == null) return;
            payload.user.name = userName;
            payload.user.department = department;
            payload.user.employeeId = employeeId;
            payload.user.location = location;
            payload.user.phone = phone;
            payload.user.note = note;
        }

        public static void SaveInstallSettings(string serverUrl, string userName, string department)
        {
            Configuration config = ConfigurationManager.OpenExeConfiguration(ConfigurationUserLevel.None);
            SaveInstallSettings(config, serverUrl, userName, department);
        }

        public static void SaveInstallSettings(string exePath, string serverUrl, string userName, string department)
        {
            ExeConfigurationFileMap map = new ExeConfigurationFileMap();
            map.ExeConfigFilename = exePath + ".config";
            Configuration config = ConfigurationManager.OpenMappedExeConfiguration(map, ConfigurationUserLevel.None);
            SaveInstallSettings(config, serverUrl, userName, department);
        }

        private static void SaveInstallSettings(Configuration config, string serverUrl, string userName, string department)
        {
            Set(config, "ServerUrl", serverUrl);
            Set(config, "AgentUserName", userName);
            Set(config, "AgentDepartment", department);
            config.Save(ConfigurationSaveMode.Modified);
            ConfigurationManager.RefreshSection("appSettings");
        }

        private static void Set(Configuration config, string key, string value)
        {
            if (config.AppSettings.Settings[key] == null)
            {
                config.AppSettings.Settings.Add(key, value ?? string.Empty);
            }
            else
            {
                config.AppSettings.Settings[key].Value = value ?? string.Empty;
            }
        }

        public static void MergeAppSettings(string targetExePath, string defaultConfigPath)
        {
            if (string.IsNullOrWhiteSpace(targetExePath) || !System.IO.File.Exists(defaultConfigPath)) return;

            ExeConfigurationFileMap targetMap = new ExeConfigurationFileMap();
            targetMap.ExeConfigFilename = targetExePath + ".config";
            Configuration target = ConfigurationManager.OpenMappedExeConfiguration(targetMap, ConfigurationUserLevel.None);

            ExeConfigurationFileMap sourceMap = new ExeConfigurationFileMap();
            sourceMap.ExeConfigFilename = defaultConfigPath;
            Configuration source = ConfigurationManager.OpenMappedExeConfiguration(sourceMap, ConfigurationUserLevel.None);

            foreach (string key in source.AppSettings.Settings.AllKeys)
            {
                if (target.AppSettings.Settings[key] == null)
                {
                    target.AppSettings.Settings.Add(key, source.AppSettings.Settings[key].Value ?? string.Empty);
                }
            }

            target.Save(ConfigurationSaveMode.Modified);
        }

        private static string Value(string key)
        {
            return (ConfigurationManager.AppSettings[key] ?? string.Empty).Trim();
        }

        private static string ConfigValue(Configuration config, string key)
        {
            return config != null && config.AppSettings.Settings[key] != null
                ? (config.AppSettings.Settings[key].Value ?? string.Empty).Trim()
                : string.Empty;
        }

        private static int IntValue(string key, int fallback)
        {
            int value;
            return int.TryParse(Value(key), out value) ? value : fallback;
        }

        private static int ConfigIntValue(Configuration config, string key, int fallback)
        {
            int value;
            return int.TryParse(ConfigValue(config, key), out value) ? value : fallback;
        }
    }
}
