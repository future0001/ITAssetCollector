using System;
using System.Collections.Generic;
using System.IO;
using System.Web.Script.Serialization;

namespace AssetCollector
{
    public static class OfflineStore
    {
        private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 * 16 };
        private static string customStorePath;

        public static void Configure(string path)
        {
            customStorePath = string.IsNullOrWhiteSpace(path) ? null : path.Trim();
        }

        public static string StorePath()
        {
            if (!string.IsNullOrWhiteSpace(customStorePath)) return customStorePath;
            return ClientStorageSettings.Defaults().OfflineStorePath();
        }

        private static string DefaultStorePath()
        {
            return Path.Combine(ClientStorageSettings.DefaultDataDirectory(), "offline-assets.json");
        }

        private static string LegacyStorePath()
        {
            string dir = AppDomain.CurrentDomain.BaseDirectory;
            return Path.Combine(dir, "offline-assets.json");
        }

        public static List<OfflineAssetRecord> Load()
        {
            string path = StorePath();
            var records = ReadRecords(path);
            string defaultPath = DefaultStorePath();
            if (!string.Equals(path, defaultPath, StringComparison.OrdinalIgnoreCase))
            {
                var defaultRecords = ReadRecords(defaultPath);
                if (defaultRecords.Count > 0)
                {
                    records = MergeRecords(records, defaultRecords);
                    SaveAll(records);
                    TryDelete(defaultPath);
                }
            }

            string legacyPath = LegacyStorePath();
            if (!string.Equals(path, legacyPath, StringComparison.OrdinalIgnoreCase))
            {
                var legacyRecords = ReadRecords(legacyPath);
                if (legacyRecords.Count > 0)
                {
                    records = MergeRecords(records, legacyRecords);
                    SaveAll(records);
                    TryDelete(legacyPath);
                }
            }

            return records;
        }

        private static void TryDelete(string path)
        {
            try
            {
                if (File.Exists(path)) File.Delete(path);
            }
            catch
            {
            }
        }

        private static List<OfflineAssetRecord> ReadRecords(string path)
        {
            if (!File.Exists(path)) return new List<OfflineAssetRecord>();
            try
            {
                string json = File.ReadAllText(path);
                var records = Serializer.Deserialize<List<OfflineAssetRecord>>(json);
                return records ?? new List<OfflineAssetRecord>();
            }
            catch
            {
                return new List<OfflineAssetRecord>();
            }
        }

        private static List<OfflineAssetRecord> MergeRecords(List<OfflineAssetRecord> current, List<OfflineAssetRecord> incoming)
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var merged = new List<OfflineAssetRecord>();
            foreach (var record in current)
            {
                if (record == null) continue;
                string id = string.IsNullOrEmpty(record.id) ? Guid.NewGuid().ToString("N") : record.id;
                record.id = id;
                if (seen.Add(id)) merged.Add(record);
            }
            foreach (var record in incoming)
            {
                if (record == null) continue;
                string id = string.IsNullOrEmpty(record.id) ? Guid.NewGuid().ToString("N") : record.id;
                record.id = id;
                if (seen.Add(id)) merged.Add(record);
            }
            return merged;
        }

        public static OfflineAssetRecord Save(AssetPayload payload)
        {
            var records = Load();
            var record = new OfflineAssetRecord
            {
                id = Guid.NewGuid().ToString("N"),
                savedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                payload = payload
            };
            records.Add(record);
            SaveAll(records);
            return record;
        }

        public static void SaveAll(List<OfflineAssetRecord> records)
        {
            string path = StorePath();
            string dir = Path.GetDirectoryName(path);
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

            string tmp = path + ".tmp";
            File.WriteAllText(tmp, Serializer.Serialize(records));
            if (File.Exists(path)) File.Delete(path);
            File.Move(tmp, path);
        }

        public static int Count()
        {
            return Load().Count;
        }
    }
}
