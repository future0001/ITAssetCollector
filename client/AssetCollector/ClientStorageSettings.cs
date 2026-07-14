using System;
using System.Configuration;
using System.IO;
using System.Web.Script.Serialization;

namespace AssetCollector
{
    public class ClientStorageSettings
    {
        private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer();

        public string offlineDirectory { get; set; }
        public string offlineFileName { get; set; }
        public string excelDirectory { get; set; }
        public string excelFileNameTemplate { get; set; }

        public static ClientStorageSettings Load()
        {
            ClientStorageSettings settings = Defaults();
            string path = SettingsPath();
            if (File.Exists(path))
            {
                try
                {
                    ClientStorageSettings saved = Serializer.Deserialize<ClientStorageSettings>(File.ReadAllText(path));
                    if (saved != null)
                    {
                        settings.offlineDirectory = SelectValue(saved.offlineDirectory, settings.offlineDirectory);
                        settings.offlineFileName = SelectValue(saved.offlineFileName, settings.offlineFileName);
                        settings.excelDirectory = SelectValue(saved.excelDirectory, settings.excelDirectory);
                        settings.excelFileNameTemplate = SelectValue(saved.excelFileNameTemplate, settings.excelFileNameTemplate);
                    }
                }
                catch
                {
                }
            }

            settings.Normalize();
            return settings;
        }

        public void Save()
        {
            Normalize();
            string path = SettingsPath();
            string dir = Path.GetDirectoryName(path);
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            File.WriteAllText(path, Serializer.Serialize(this));
        }

        public void Normalize()
        {
            offlineDirectory = NormalizeDirectory(offlineDirectory, DefaultDataDirectory());
            offlineFileName = NormalizeFileName(offlineFileName, "offline-assets.json", ".json");
            excelDirectory = NormalizeDirectory(excelDirectory, Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
            excelFileNameTemplate = NormalizeFileName(excelFileNameTemplate, "计算机信息核查-{timestamp}.xls", ".xls");
        }

        public string OfflineStorePath()
        {
            Normalize();
            return Path.Combine(offlineDirectory, offlineFileName);
        }

        public string ExcelDefaultPath(bool offlineOnly, AssetPayload payload)
        {
            Normalize();
            string fileName = ExpandTemplate(excelFileNameTemplate, offlineOnly, payload);
            fileName = NormalizeFileName(fileName, offlineOnly ? "计算机信息核查离线记录-{timestamp}.xls" : "计算机信息核查-{timestamp}.xls", ".xls");
            return Path.Combine(excelDirectory, fileName);
        }

        public static ClientStorageSettings Defaults()
        {
            var settings = new ClientStorageSettings();
            settings.offlineDirectory = SelectValue(ConfigurationManager.AppSettings["OfflineStoreDirectory"], DefaultDataDirectory());
            settings.offlineFileName = SelectValue(ConfigurationManager.AppSettings["OfflineStoreFileName"], "offline-assets.json");
            settings.excelDirectory = SelectValue(ConfigurationManager.AppSettings["ExcelExportDirectory"], Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
            settings.excelFileNameTemplate = SelectValue(ConfigurationManager.AppSettings["ExcelExportFileName"], "计算机信息核查-{timestamp}.xls");
            settings.Normalize();
            return settings;
        }

        public static string SettingsPath()
        {
            return Path.Combine(DefaultDataDirectory(), "client-settings.json");
        }

        public static string DefaultDataDirectory()
        {
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ITAssetCollector");
        }

        private static string ExpandTemplate(string template, bool offlineOnly, AssetPayload payload)
        {
            string value = string.IsNullOrWhiteSpace(template)
                ? (offlineOnly ? "计算机信息核查离线记录-{timestamp}.xls" : "计算机信息核查-{timestamp}.xls")
                : template.Trim();
            DateTime now = DateTime.Now;
            string computerName = payload != null && payload.system != null ? payload.system.computerName : Environment.MachineName;
            string userName = payload != null && payload.user != null ? payload.user.name : string.Empty;
            value = value.Replace("{timestamp}", now.ToString("yyyyMMdd-HHmmss"));
            value = value.Replace("{date}", now.ToString("yyyyMMdd"));
            value = value.Replace("{computer}", SafeFileNamePart(computerName));
            value = value.Replace("{name}", SafeFileNamePart(userName));
            value = value.Replace("{type}", offlineOnly ? "离线记录" : "当前采集");
            return value;
        }

        private static string NormalizeDirectory(string value, string fallback)
        {
            string dir = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
            return Environment.ExpandEnvironmentVariables(dir);
        }

        private static string NormalizeFileName(string value, string fallback, string extension)
        {
            string fileName = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
            fileName = Path.GetFileName(fileName);
            if (string.IsNullOrWhiteSpace(fileName)) fileName = fallback;

            foreach (char c in Path.GetInvalidFileNameChars())
            {
                fileName = fileName.Replace(c, '_');
            }

            if (!fileName.EndsWith(extension, StringComparison.OrdinalIgnoreCase))
            {
                fileName += extension;
            }
            return fileName;
        }

        private static string SelectValue(string value, string fallback)
        {
            return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
        }

        private static string SafeFileNamePart(string value)
        {
            string text = string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
            foreach (char c in Path.GetInvalidFileNameChars())
            {
                text = text.Replace(c, '_');
            }
            return text;
        }
    }
}
