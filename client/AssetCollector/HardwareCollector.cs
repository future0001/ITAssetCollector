using System;
using System.Collections.Generic;
using System.Configuration;
using System.Globalization;
using System.Management;
using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.Win32;

namespace AssetCollector
{
    public static class HardwareCollector
    {
        public static AssetPayload Collect()
        {
            var payload = new AssetPayload();
            payload.system = GetSystemInfo();
            payload.baseBoard = GetBaseBoardInfo();
            payload.networkAdapters = GetPhysicalNetworkAdapters();
            payload.disks = GetPhysicalDisks();
            return payload;
        }

        private static SystemInfo GetSystemInfo()
        {
            var info = new SystemInfo();
            info.computerName = Environment.MachineName;

            foreach (ManagementObject obj in Query("SELECT Caption, Version, InstallDate FROM Win32_OperatingSystem"))
            {
                info.osCaption = ReadString(obj, "Caption");
                info.osVersion = ReadString(obj, "Version");
                info.installDate = FormatWmiDate(ReadString(obj, "InstallDate"));
                break;
            }

            return info;
        }

        private static BaseBoardInfo GetBaseBoardInfo()
        {
            var info = new BaseBoardInfo();

            foreach (ManagementObject obj in Query("SELECT Manufacturer, Product, SerialNumber, Version FROM Win32_BaseBoard"))
            {
                info.manufacturer = SelectBestTextValue(info.manufacturer, ReadString(obj, "Manufacturer"));
                info.product = SelectBestTextValue(info.product, ReadString(obj, "Product"));
                info.serialNumber = SelectBestBoardSerial(info.serialNumber, ReadString(obj, "SerialNumber"));
                break;
            }

            ApplyRegistryBaseBoardInfo(info);
            ApplyComputerSystemProductFallback(info);
            ApplyBaseBoardSerialOverride(info);
            ClearInvalidBaseBoardInfo(info);

            return info;
        }

        private static void ApplyRegistryBaseBoardInfo(BaseBoardInfo info)
        {
            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\BIOS"))
                {
                    if (key == null) return;

                    info.manufacturer = SelectBestTextValue(info.manufacturer, ReadRegistryString(key, "BaseBoardManufacturer"));
                    info.product = SelectBestTextValue(info.product, ReadRegistryString(key, "BaseBoardProduct"));
                    info.serialNumber = SelectBestBoardSerial(info.serialNumber, ReadRegistryString(key, "BaseBoardSerialNumber"));
                }
            }
            catch
            {
            }
        }

        private static void ApplyComputerSystemProductFallback(BaseBoardInfo info)
        {
            try
            {
                foreach (ManagementObject obj in Query("SELECT Vendor, Name, IdentifyingNumber FROM Win32_ComputerSystemProduct"))
                {
                    if (!IsUsefulBoardText(info.manufacturer))
                    {
                        info.manufacturer = SelectBestTextValue(info.manufacturer, ReadString(obj, "Vendor"));
                    }

                    if (!IsUsefulBoardText(info.product))
                    {
                        info.product = SelectBestTextValue(info.product, ReadString(obj, "Name"));
                    }

                    if (!IsValidBoardSerial(info.serialNumber))
                    {
                        info.serialNumber = SelectBestBoardSerial(info.serialNumber, ReadString(obj, "IdentifyingNumber"));
                    }
                    break;
                }
            }
            catch
            {
            }
        }

        private static void ClearInvalidBaseBoardInfo(BaseBoardInfo info)
        {
            if (!IsUsefulBoardText(info.manufacturer)) info.manufacturer = string.Empty;
            if (!IsUsefulBoardText(info.product)) info.product = string.Empty;
            if (!IsValidBoardSerial(info.serialNumber)) info.serialNumber = string.Empty;
        }

        private static void ApplyBaseBoardSerialOverride(BaseBoardInfo info)
        {
            string configured = ConfigurationManager.AppSettings["BaseBoardSerialOverrides"];
            if (string.IsNullOrWhiteSpace(configured)) return;

            string normalizedManufacturer = NormalizeModel(info.manufacturer);
            string normalizedProduct = NormalizeModel(info.product);
            string normalizedSerial = NormalizeBoardText(info.serialNumber);

            string[] rules = configured.Split(new[] { ';', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (string rawRule in rules)
            {
                string rule = rawRule.Trim();
                int equals = rule.IndexOf('=');
                if (equals <= 0) continue;

                string left = rule.Substring(0, equals).Trim();
                string right = NormalizeBoardText(rule.Substring(equals + 1));
                if (!IsValidBoardSerial(right)) continue;

                if (left.StartsWith("product:", StringComparison.OrdinalIgnoreCase))
                {
                    string expectedProduct = NormalizeModel(left.Substring(8));
                    if (expectedProduct.Length > 0 && normalizedProduct.Contains(expectedProduct))
                    {
                        info.serialNumber = right;
                        return;
                    }
                }
                else if (left.StartsWith("manufacturer:", StringComparison.OrdinalIgnoreCase))
                {
                    string expectedManufacturer = NormalizeModel(left.Substring(13));
                    if (expectedManufacturer.Length > 0 && normalizedManufacturer.Contains(expectedManufacturer))
                    {
                        info.serialNumber = right;
                        return;
                    }
                }
                else
                {
                    string expected = NormalizeModel(left);
                    if (expected.Length > 0
                        && (normalizedProduct.Contains(expected)
                            || normalizedManufacturer.Contains(expected)
                            || string.Equals(NormalizeModel(normalizedSerial), expected, StringComparison.OrdinalIgnoreCase)))
                    {
                        info.serialNumber = right;
                        return;
                    }
                }
            }
        }

        private static string ReadRegistryString(RegistryKey key, string name)
        {
            object value = key.GetValue(name);
            return value == null ? string.Empty : Convert.ToString(value).Trim();
        }

        private static string SelectBestTextValue(string current, string candidate)
        {
            string normalizedCurrent = NormalizeBoardText(current);
            string normalizedCandidate = NormalizeBoardText(candidate);

            if (string.IsNullOrEmpty(normalizedCandidate)) return normalizedCurrent;
            if (string.IsNullOrEmpty(normalizedCurrent)) return normalizedCandidate;
            if (IsBoardPlaceholder(normalizedCurrent) && !IsBoardPlaceholder(normalizedCandidate)) return normalizedCandidate;
            if (normalizedCandidate.Length > normalizedCurrent.Length && !IsBoardPlaceholder(normalizedCandidate)) return normalizedCandidate;

            return normalizedCurrent;
        }

        private static bool IsUsefulBoardText(string value)
        {
            string text = NormalizeBoardText(value);
            return !string.IsNullOrEmpty(text) && !IsBoardPlaceholder(text);
        }

        private static string SelectBestBoardSerial(string current, string candidate)
        {
            string normalizedCurrent = NormalizeBoardText(current);
            string normalizedCandidate = NormalizeBoardText(candidate);

            if (!IsValidBoardSerial(normalizedCandidate)) return IsValidBoardSerial(normalizedCurrent) ? normalizedCurrent : string.Empty;
            if (!IsValidBoardSerial(normalizedCurrent)) return normalizedCandidate;
            if (ScoreBoardSerial(normalizedCandidate) > ScoreBoardSerial(normalizedCurrent)) return normalizedCandidate;

            return normalizedCurrent;
        }

        private static int ScoreBoardSerial(string serial)
        {
            if (!IsValidBoardSerial(serial)) return 0;

            int score = 10;
            bool hasLetter = false;
            bool hasDigit = false;

            foreach (char c in serial)
            {
                if (char.IsLetter(c)) hasLetter = true;
                if (char.IsDigit(c)) hasDigit = true;
            }

            if (hasLetter && hasDigit) score += 10;
            if (serial.Length >= 8) score += 5;
            if (serial.Length >= 12) score += 3;
            return score;
        }

        private static bool IsValidBoardSerial(string value)
        {
            string serial = NormalizeBoardText(value);
            if (string.IsNullOrEmpty(serial)) return false;
            if (IsBoardPlaceholder(serial)) return false;

            int alphaNumericCount = 0;
            foreach (char c in serial)
            {
                if (char.IsLetterOrDigit(c)) alphaNumericCount++;
            }

            return alphaNumericCount >= 4;
        }

        private static string NormalizeBoardText(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;

            string result = value.Trim().Trim('.');
            result = result.Replace("\0", string.Empty).Trim();
            while (result.IndexOf("  ", StringComparison.Ordinal) >= 0)
            {
                result = result.Replace("  ", " ");
            }
            return result;
        }

        private static bool IsBoardPlaceholder(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return true;

            string normalized = NormalizeModel(value);
            if (normalized.Length == 0) return true;

            string[] placeholders = new[] {
                "defaultstring", "tobefilledbyoem", "tobefilledbyoem", "tobefilled",
                "none", "unknown", "notavailable", "notapplicable", "notspecified",
                "systemserialnumber", "serialnumber", "baseserialnumber", "baseboardserialnumber",
                "baseboardversion", "systemproductname", "systemmanufacturer",
                "oem", "oemstring", "invalid", "null", "na"
            };

            foreach (string placeholder in placeholders)
            {
                if (normalized == placeholder) return true;
            }

            bool allSame = true;
            for (int i = 1; i < normalized.Length; i++)
            {
                if (normalized[i] != normalized[0])
                {
                    allSame = false;
                    break;
                }
            }

            if (allSame && normalized.Length >= 4) return true;
            if (normalized == "123456789" || normalized == "1234567890") return true;

            return false;
        }

        private static List<NetworkAdapterInfo> GetPhysicalNetworkAdapters()
        {
            var list = new List<NetworkAdapterInfo>();
            NetworkConfigMaps configs = GetNetworkConfigMaps();

            foreach (ManagementObject obj in Query("SELECT * FROM Win32_NetworkAdapter WHERE MACAddress IS NOT NULL"))
            {
                string name = ReadString(obj, "Name");
                string mac = FormatMacAddress(ReadString(obj, "MACAddress"));
                int index = ReadInt(obj, "Index");
                if (string.IsNullOrEmpty(mac)) continue;
                if (!IsPhysicalAdapter(obj, name)) continue;

                var item = new NetworkAdapterInfo();
                item.name = name;
                item.macAddress = mac;
                if (configs.ByIndex.ContainsKey(index))
                {
                    AddUniqueIps(item.ipAddresses, configs.ByIndex[index]);
                }

                if (configs.ByMac.ContainsKey(item.macAddress))
                {
                    AddUniqueIps(item.ipAddresses, configs.ByMac[item.macAddress]);
                }
                list.Add(item);
            }

            return list;
        }

        private static NetworkConfigMaps GetNetworkConfigMaps()
        {
            var result = new NetworkConfigMaps();
            foreach (ManagementObject obj in Query("SELECT Index, MACAddress, IPAddress, IPEnabled FROM Win32_NetworkAdapterConfiguration"))
            {
                int index = ReadInt(obj, "Index");
                string mac = FormatMacAddress(ReadString(obj, "MACAddress"));
                var ips = ReadIpv4Addresses(obj, "IPAddress");

                if (ips.Count == 0) continue;
                if (index >= 0) result.ByIndex[index] = ips;
                if (!string.IsNullOrEmpty(mac)) result.ByMac[mac] = ips;
            }
            return result;
        }

        private static List<string> ReadIpv4Addresses(ManagementObject obj, string name)
        {
            var result = new List<string>();
            object value = SafeGet(obj, name);
            if (value == null) return result;

            string[] strings = value as string[];
            if (strings != null)
            {
                foreach (string ip in strings)
                {
                    AddUniqueIp(result, ip);
                }
                return result;
            }

            Array array = value as Array;
            if (array != null)
            {
                foreach (object item in array)
                {
                    AddUniqueIp(result, Convert.ToString(item));
                }
                return result;
            }

            AddUniqueIp(result, Convert.ToString(value));
            return result;
        }

        private static void AddUniqueIps(List<string> target, List<string> values)
        {
            if (target == null || values == null) return;
            foreach (string value in values)
            {
                AddUniqueIp(target, value);
            }
        }

        private static void AddUniqueIp(List<string> target, string value)
        {
            if (target == null || !IsIpv4(value)) return;
            string ip = value.Trim();
            foreach (string existing in target)
            {
                if (string.Equals(existing, ip, StringComparison.OrdinalIgnoreCase)) return;
            }
            target.Add(ip);
        }

        private static bool IsIpv4(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;

            IPAddress address;
            return IPAddress.TryParse(value.Trim(), out address)
                && address.AddressFamily == AddressFamily.InterNetwork;
        }

        private static string FormatMacAddress(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;

            var hex = new StringBuilder();
            foreach (char c in value)
            {
                if (Uri.IsHexDigit(c)) hex.Append(char.ToLowerInvariant(c));
            }

            if (hex.Length != 12) return value.Trim().ToLowerInvariant();
            return hex.ToString(0, 4) + "-" + hex.ToString(4, 4) + "-" + hex.ToString(8, 4);
        }

        private static bool IsPhysicalAdapter(ManagementObject obj, string name)
        {
            object physical = SafeGet(obj, "PhysicalAdapter");
            if (physical is bool && !(bool)physical) return false;

            string adapterText = string.Join(" ", new[] {
                name,
                ReadString(obj, "ProductName"),
                ReadString(obj, "Description"),
                ReadString(obj, "ServiceName"),
                ReadString(obj, "AdapterType"),
                ReadString(obj, "NetConnectionID"),
                ReadString(obj, "PNPDeviceID")
            });
            string n = (adapterText ?? string.Empty).ToLowerInvariant();
            string[] virtualHints = new[] {
                "virtual", "vmware", "virtualbox", "hyper-v", "vpn", "tap", "tunnel",
                "teredo", "isatap", "bluetooth", "loopback", "wan miniport", "miniport",
                "pptp", "pppoe", "ppp", "ras async", "ndiswan", "ms_ndiswan",
                "packet scheduler miniport", "psched", "pseudo",
                "wan 微型端口", "微型端口", "数据包计划程序"
            };

            foreach (string hint in virtualHints)
            {
                if (n.Contains(hint)) return false;
            }

            string pnp = ReadString(obj, "PNPDeviceID").ToUpperInvariant();
            if (pnp.StartsWith("ROOT\\") || pnp.StartsWith("SW\\") || pnp.StartsWith("HTREE\\"))
            {
                return false;
            }

            if (IsWindowsXpOrOlder() && pnp.Length > 0 && !pnp.StartsWith("PCI\\"))
            {
                return false;
            }

            return true;
        }

        private static List<DiskInfo> GetPhysicalDisks()
        {
            var list = new List<DiskInfo>();
            var mediaSerials = GetPhysicalMediaSerials();
            var storageDisks = IsWindows8OrNewer() ? GetStoragePhysicalDisks() : new List<StorageDiskCandidate>();
            var storageApiDisks = IsWindows8OrNewer() ? GetStorageApiDisks() : new List<StorageDiskCandidate>();
            var smartDisks = GetWmiSmartDiskCandidates();
            var pnpDisks = GetPnpDiskCandidates();

            foreach (ManagementObject obj in Query("SELECT Index, DeviceID, PNPDeviceID, Model, SerialNumber, Size, MediaType, InterfaceType FROM Win32_DiskDrive"))
            {
                int index = ReadInt(obj, "Index");
                long size = ReadLong(obj, "Size");
                string model = ReadString(obj, "Model");
                string pnpDeviceId = ReadString(obj, "PNPDeviceID");
                string serial = SelectBestDiskSerial(
                    ReadString(obj, "SerialNumber"),
                    index,
                    model,
                    pnpDeviceId,
                    size,
                    mediaSerials,
                    storageDisks,
                    storageApiDisks,
                    smartDisks,
                    pnpDisks);

                var item = new DiskInfo();
                item.model = model;
                item.serialNumber = serial;
                item.sizeBytes = size;
                item.sizeText = FormatBytes(size);
                list.Add(item);
            }
            return list;
        }

        private static Dictionary<int, string> GetPhysicalMediaSerials()
        {
            var result = new Dictionary<int, string>();

            try
            {
                foreach (ManagementObject obj in Query("SELECT Tag, SerialNumber FROM Win32_PhysicalMedia"))
                {
                    int index = ParsePhysicalDriveIndex(ReadString(obj, "Tag"));
                    string serial = ApplyDiskSerialOverride(string.Empty, ReadString(obj, "SerialNumber"));
                    if (index >= 0 && IsLikelyVendorSerial(serial))
                    {
                        result[index] = serial;
                    }
                }
            }
            catch
            {
            }

            return result;
        }

        private static List<StorageDiskCandidate> GetStoragePhysicalDisks()
        {
            var result = new List<StorageDiskCandidate>();

            try
            {
                var scope = CreateManagementScope(@"\\.\root\Microsoft\Windows\Storage");
                scope.Connect();
                var query = new ObjectQuery("SELECT FriendlyName, SerialNumber, Size, MediaType, BusType, UniqueId, DeviceId, ObjectId FROM MSFT_PhysicalDisk");
                using (var searcher = new ManagementObjectSearcher(scope, query))
                {
                    searcher.Options = WmiQueryOptions();
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        string friendlyName = ReadString(obj, "FriendlyName");
                        string serial = SelectBestStorageSerial(friendlyName,
                            ReadString(obj, "SerialNumber"),
                            ReadString(obj, "UniqueId"),
                            ReadString(obj, "DeviceId"),
                            ReadString(obj, "ObjectId"));
                        if (!IsLikelyVendorSerial(serial)) continue;

                        result.Add(new StorageDiskCandidate
                        {
                            FriendlyName = friendlyName,
                            SerialNumber = serial,
                            SizeBytes = ReadLong(obj, "Size")
                        });
                    }
                }
            }
            catch
            {
            }

            return result;
        }

        private static List<StorageDiskCandidate> GetStorageApiDisks()
        {
            var result = new List<StorageDiskCandidate>();

            try
            {
                var scope = CreateManagementScope(@"\\.\root\Microsoft\Windows\Storage");
                scope.Connect();
                var query = new ObjectQuery("SELECT FriendlyName, SerialNumber, Size, Number, UniqueId, Path, Location FROM MSFT_Disk");
                using (var searcher = new ManagementObjectSearcher(scope, query))
                {
                    searcher.Options = WmiQueryOptions();
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        string friendlyName = ReadString(obj, "FriendlyName");
                        string serial = SelectBestStorageSerial(friendlyName,
                            ReadString(obj, "SerialNumber"),
                            ReadString(obj, "UniqueId"),
                            ReadString(obj, "Path"),
                            ReadString(obj, "Location"));
                        if (!IsLikelyVendorSerial(serial)) continue;

                        result.Add(new StorageDiskCandidate
                        {
                            FriendlyName = friendlyName,
                            SerialNumber = serial,
                            SizeBytes = ReadLong(obj, "Size"),
                            Index = ReadInt(obj, "Number")
                        });
                    }
                }
            }
            catch
            {
            }

            return result;
        }

        private static List<StorageDiskCandidate> GetPnpDiskCandidates()
        {
            var result = new List<StorageDiskCandidate>();

            try
            {
                foreach (ManagementObject obj in Query("SELECT Name, DeviceID, PNPClass, HardwareID, CompatibleID FROM Win32_PnPEntity WHERE DeviceID IS NOT NULL"))
                {
                    string name = ReadString(obj, "Name");
                    string deviceId = ReadString(obj, "DeviceID");
                    string normalized = NormalizeModel(deviceId + " " + name);
                    if (normalized.Length == 0) continue;
                    if (!(normalized.Contains("disk") || normalized.Contains("nvme") || normalized.Contains("scsi") || normalized.Contains("stor"))) continue;

                    string serial = SelectBestStorageSerial(name,
                        ExtractSerialFromPnpDeviceId(deviceId),
                        ReadStringArrayText(obj, "HardwareID"),
                        ReadStringArrayText(obj, "CompatibleID"),
                        deviceId);
                    if (!IsLikelyVendorSerial(serial)) continue;

                    result.Add(new StorageDiskCandidate
                    {
                        FriendlyName = name,
                        SerialNumber = serial,
                        SizeBytes = 0
                    });
                }
            }
            catch
            {
            }

            return result;
        }

        private static string SelectBestDiskSerial(
            string win32Serial,
            int index,
            string model,
            string pnpDeviceId,
            long sizeBytes,
            Dictionary<int, string> mediaSerials,
            List<StorageDiskCandidate> storageDisks,
            List<StorageDiskCandidate> storageApiDisks,
            List<StorageDiskCandidate> smartDisks,
            List<StorageDiskCandidate> pnpDisks)
        {
            var candidates = new List<DiskSerialCandidate>();

            if (IsWindowsXpOrOlder())
            {
                AddDiskSerialCandidate(candidates, model, NativeDiskSerialReader.ReadAtaIdentifyDeviceSerial(index), 170, "ata-identify");
                AddDiskSerialCandidate(candidates, model, NativeDiskSerialReader.ReadStorageDeviceSerial(index), 120, "storage-descriptor");
            }
            else
            {
                AddDiskSerialCandidate(candidates, model, NativeDiskSerialReader.ReadNvmeIdentifyControllerSerial(index), 180, "nvme-identify");
                AddDiskSerialCandidate(candidates, model, NativeDiskSerialReader.ReadAtaIdentifyDeviceSerial(index), 170, "ata-identify");
                AddDiskSerialCandidate(candidates, model, NativeDiskSerialReader.ReadStorageDeviceSerial(index), 120, "storage-descriptor");
            }

            StorageDiskCandidate smart = FindStorageDiskCandidate(smartDisks, model, sizeBytes);
            if (smart != null) AddDiskSerialCandidate(candidates, model, smart.SerialNumber, 140, "smart");

            StorageDiskCandidate pnp = FindStorageDiskCandidate(pnpDisks, model, sizeBytes);
            if (pnp != null) AddDiskSerialCandidate(candidates, model, pnp.SerialNumber, 125, "pnp");

            StorageDiskCandidate storage = FindStorageDiskCandidate(storageDisks, model, sizeBytes);
            if (storage != null) AddDiskSerialCandidate(candidates, model, storage.SerialNumber, 110, "msft-physicaldisk");

            if (mediaSerials.ContainsKey(index)) AddDiskSerialCandidate(candidates, model, mediaSerials[index], 100, "physicalmedia");

            StorageDiskCandidate storageApi = FindStorageDiskCandidate(storageApiDisks, index, model, sizeBytes);
            if (storageApi != null) AddDiskSerialCandidate(candidates, model, storageApi.SerialNumber, 95, "msft-disk");

            AddDiskSerialCandidate(candidates, model, SelectBestStorageSerial(model, pnpDeviceId), 90, "diskdrive-pnp");
            AddDiskSerialCandidate(candidates, model, FindRegistryDiskSerial(model, pnpDeviceId), 80, "registry");
            AddDiskSerialCandidate(candidates, model, win32Serial, 70, "win32-diskdrive");

            DiskSerialCandidate best = SelectBestDiskSerialCandidate(candidates);
            if (best != null) return best.SerialNumber;

            return string.Empty;
        }

        private static void AddDiskSerialCandidate(List<DiskSerialCandidate> candidates, string model, string serial, int sourceScore, string source)
        {
            string prepared = PrepareDiskSerial(model, serial);
            if (!IsLikelyVendorSerial(prepared)) return;
            if (LooksLikeModelToken(model, prepared)) return;

            int score = sourceScore + ScoreDiskSerial(prepared) + ScoreDiskSerialForModel(model, prepared);
            DiskSerialCandidate existing = FindDiskSerialCandidate(candidates, prepared);
            if (existing != null)
            {
                existing.Score += Math.Max(10, sourceScore / 4);
                if (score > existing.Score) existing.Score = score;
                existing.Source = existing.Source + "," + source;
                return;
            }

            candidates.Add(new DiskSerialCandidate
            {
                SerialNumber = prepared,
                Score = score,
                Source = source
            });
        }

        private static DiskSerialCandidate FindDiskSerialCandidate(List<DiskSerialCandidate> candidates, string serial)
        {
            string normalized = NormalizeDiskSerial(serial);
            foreach (DiskSerialCandidate candidate in candidates)
            {
                if (string.Equals(NormalizeDiskSerial(candidate.SerialNumber), normalized, StringComparison.OrdinalIgnoreCase))
                {
                    return candidate;
                }
            }

            return null;
        }

        private static DiskSerialCandidate SelectBestDiskSerialCandidate(List<DiskSerialCandidate> candidates)
        {
            DiskSerialCandidate best = null;
            foreach (DiskSerialCandidate candidate in candidates)
            {
                if (!IsLikelyVendorSerial(candidate.SerialNumber)) continue;
                if (best == null || candidate.Score > best.Score)
                {
                    best = candidate;
                }
            }

            return best;
        }

        private static string PrepareDiskSerial(string model, string serial)
        {
            string normalized = NormalizeDiskSerial(serial);
            normalized = FixKnownVendorSerialFormat(model, normalized);
            return ApplyDiskSerialOverride(model, normalized);
        }

        private static string SelectBestStorageSerial(string model, params string[] values)
        {
            string best = string.Empty;
            int bestScore = int.MinValue;

            foreach (string value in values)
            {
                foreach (string candidate in ExpandDiskIdentifierCandidates(value))
                {
                    string prepared = PrepareDiskSerial(model, candidate);
                    if (!IsLikelyVendorSerial(prepared)) continue;
                    if (LooksLikeModelToken(model, prepared)) continue;

                    int score = ScoreDiskSerial(prepared) + ScoreDiskSerialForModel(model, prepared);
                    score += 100;

                    if (score > bestScore)
                    {
                        best = prepared;
                        bestScore = score;
                    }
                }
            }

            return best;
        }

        private static List<string> ExpandDiskIdentifierCandidates(string value)
        {
            var result = new List<string>();
            if (string.IsNullOrWhiteSpace(value)) return result;

            string text = value.Trim();
            if (ShouldKeepWholeDiskIdentifier(text)) AddUniqueText(result, text);
            AddUniqueText(result, ExtractBestSerialFromText(text));

            string[] separators = new[] { "\\", "/", "&", "#", "{", "}", " ", "\t", "\r", "\n" };
            string[] parts = text.Split(separators, StringSplitOptions.RemoveEmptyEntries);
            foreach (string part in parts)
            {
                AddUniqueText(result, part);
                AddUniqueText(result, ExtractBestSerialFromText(part));
                AddHexDecodedDiskIdentifierCandidates(result, part);
            }

            return result;
        }

        private static void AddHexDecodedDiskIdentifierCandidates(List<string> result, string value)
        {
            string hex = NormalizeDiskSerial(value);
            if (hex.Length < 10 || hex.Length > 80 || hex.Length % 2 != 0) return;

            foreach (char c in hex)
            {
                if (!Uri.IsHexDigit(c)) return;
            }

            AddUniqueText(result, DecodeHexAscii(hex, false));
            AddUniqueText(result, DecodeHexAscii(hex, true));
        }

        private static string DecodeHexAscii(string hex, bool swapPairs)
        {
            if (string.IsNullOrEmpty(hex) || hex.Length % 2 != 0) return string.Empty;

            var bytes = new List<byte>();
            for (int i = 0; i + 1 < hex.Length; i += 2)
            {
                string pair = swapPairs && i + 3 < hex.Length
                    ? new string(new[] { hex[i + 2], hex[i + 3] })
                    : new string(new[] { hex[i], hex[i + 1] });

                byte parsed;
                if (!byte.TryParse(pair, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out parsed)) return string.Empty;
                bytes.Add(parsed);

                if (swapPairs && i + 3 < hex.Length)
                {
                    pair = new string(new[] { hex[i], hex[i + 1] });
                    if (!byte.TryParse(pair, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out parsed)) return string.Empty;
                    bytes.Add(parsed);
                    i += 2;
                }
            }

            return CleanAscii(Encoding.ASCII.GetString(bytes.ToArray()));
        }

        private static bool ShouldKeepWholeDiskIdentifier(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            return value.IndexOf('\\') < 0
                && value.IndexOf('/') < 0
                && value.IndexOf('#') < 0
                && value.IndexOf('{') < 0
                && value.IndexOf('}') < 0;
        }

        private static void AddUniqueText(List<string> values, string value)
        {
            string normalized = NormalizeDiskSerial(value);
            if (normalized.Length == 0) return;

            foreach (string existing in values)
            {
                if (string.Equals(NormalizeDiskSerial(existing), normalized, StringComparison.OrdinalIgnoreCase)) return;
            }
            values.Add(normalized);
        }

        private static string FixKnownVendorSerialFormat(string model, string serial)
        {
            if (string.IsNullOrWhiteSpace(serial)) return string.Empty;

            string normalizedModel = NormalizeModel(model);
            string value = serial.Trim();

            if (IsSamsungNvmeModel(normalizedModel))
            {
                string swapped = SwapEveryTwoCharacters(value);
                if (LooksMoreLikeSamsungSerial(swapped, value)) return swapped;
            }

            if (IsWesternDigitalModel(normalizedModel) && value.StartsWith("WD", StringComparison.OrdinalIgnoreCase) && !value.StartsWith("WD-", StringComparison.OrdinalIgnoreCase) && value.Length > 2)
            {
                return "WD-" + value.Substring(2);
            }

            return value;
        }

        private static bool IsSamsungNvmeModel(string normalizedModel)
        {
            return normalizedModel.Contains("samsungmzv")
                || normalizedModel.Contains("samsungmz9")
                || normalizedModel.Contains("samsungmzn")
                || normalizedModel.Contains("samsungssd9")
                || normalizedModel.Contains("mzvl")
                || normalizedModel.Contains("mzvp")
                || normalizedModel.Contains("mzvla")
                || normalizedModel.Contains("mzvlb")
                || normalizedModel.Contains("mzvlq")
                || normalizedModel.Contains("mzvlw");
        }

        private static bool IsWesternDigitalModel(string normalizedModel)
        {
            return normalizedModel.Contains("wdc")
                || normalizedModel.Contains("westerndigital")
                || normalizedModel.StartsWith("wd")
                || normalizedModel.Contains("atawd");
        }

        private static bool LooksMoreLikeSamsungSerial(string swapped, string original)
        {
            if (string.IsNullOrWhiteSpace(swapped) || swapped.Length != original.Length) return false;
            if (!swapped.StartsWith("S", StringComparison.OrdinalIgnoreCase)) return false;
            if (original.StartsWith("S", StringComparison.OrdinalIgnoreCase)) return false;
            return IsLikelyVendorSerial(swapped);
        }

        private static string SwapEveryTwoCharacters(string value)
        {
            if (string.IsNullOrEmpty(value) || value.Length % 2 != 0) return value;

            var chars = value.ToCharArray();
            for (int i = 0; i + 1 < chars.Length; i += 2)
            {
                char temp = chars[i];
                chars[i] = chars[i + 1];
                chars[i + 1] = temp;
            }
            return new string(chars);
        }

        private static List<StorageDiskCandidate> GetWmiSmartDiskCandidates()
        {
            var result = new List<StorageDiskCandidate>();
            ReadWmiSmartClass(result, "MSStorageDriver_FailurePredictData");
            ReadWmiSmartClass(result, "MSStorageDriver_ATAPISmartData");
            return result;
        }

        private static void ReadWmiSmartClass(List<StorageDiskCandidate> result, string className)
        {
            try
            {
                var scope = CreateManagementScope(@"\\.\root\wmi");
                scope.Connect();
                using (var searcher = new ManagementObjectSearcher(scope, new ObjectQuery("SELECT InstanceName, VendorSpecific FROM " + className)))
                {
                    searcher.Options = WmiQueryOptions();
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        byte[] data = SafeGet(obj, "VendorSpecific") as byte[];
                        if (data == null || data.Length < 64) continue;

                        string instance = ReadString(obj, "InstanceName");
                        AddSmartCandidate(result, instance, ParseAtaIdentifySerial(data), ParseAtaIdentifyModel(data));
                        AddSmartCandidate(result, instance, ParseNvmeIdentifySerial(data), ParseNvmeIdentifyModel(data));
                    }
                }
            }
            catch
            {
            }
        }

        private static void AddSmartCandidate(List<StorageDiskCandidate> result, string instanceName, string serial, string model)
        {
            serial = PrepareDiskSerial(model, serial);
            if (!IsLikelyVendorSerial(serial)) return;

            result.Add(new StorageDiskCandidate
            {
                FriendlyName = string.IsNullOrWhiteSpace(model) ? instanceName : model,
                SerialNumber = serial,
                SizeBytes = 0
            });
        }

        private static string ParseAtaIdentifySerial(byte[] data)
        {
            return ReadAtaIdentifyString(data, 20, 20);
        }

        private static string ParseAtaIdentifyModel(byte[] data)
        {
            return ReadAtaIdentifyString(data, 54, 40);
        }

        private static string ReadAtaIdentifyString(byte[] data, int offset, int length)
        {
            if (data.Length < offset + length) return string.Empty;

            var chars = new char[length];
            for (int i = 0; i < length; i += 2)
            {
                chars[i] = (char)data[offset + i + 1];
                chars[i + 1] = (char)data[offset + i];
            }
            return CleanAscii(new string(chars));
        }

        private static string ParseNvmeIdentifySerial(byte[] data)
        {
            return data.Length >= 24 ? CleanAscii(Encoding.ASCII.GetString(data, 4, 20)) : string.Empty;
        }

        private static string ParseNvmeIdentifyModel(byte[] data)
        {
            return data.Length >= 64 ? CleanAscii(Encoding.ASCII.GetString(data, 24, 40)) : string.Empty;
        }

        private static string CleanAscii(string value)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;
            var sb = new StringBuilder();
            foreach (char c in value)
            {
                if (c >= 32 && c <= 126) sb.Append(c);
            }
            return sb.ToString().Trim();
        }

        private static string ApplyDiskSerialOverride(string model, string serial)
        {
            string configured = ConfigurationManager.AppSettings["DiskSerialOverrides"];
            if (string.IsNullOrWhiteSpace(configured)) return NormalizeDiskSerial(serial);

            string normalizedSerial = NormalizeDiskSerial(serial);
            string normalizedModel = NormalizeModel(model);

            string[] rules = configured.Split(new[] { ';', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (string rawRule in rules)
            {
                string rule = rawRule.Trim();
                int equals = rule.IndexOf('=');
                if (equals <= 0) continue;

                string left = rule.Substring(0, equals).Trim();
                string right = NormalizeDiskSerial(rule.Substring(equals + 1));
                if (string.IsNullOrEmpty(right)) continue;

                if (left.StartsWith("model:", StringComparison.OrdinalIgnoreCase))
                {
                    string expectedModel = NormalizeModel(left.Substring(6));
                    if (expectedModel.Length > 0 && normalizedModel.Contains(expectedModel)) return right;
                }
                else if (string.Equals(NormalizeDiskSerial(left), normalizedSerial, StringComparison.OrdinalIgnoreCase))
                {
                    return right;
                }
            }

            return normalizedSerial;
        }

        private static string FindRegistryDiskSerial(string model, string pnpDeviceId)
        {
            string normalizedModel = NormalizeModel(model);
            string normalizedPnp = NormalizeModel(pnpDeviceId);
            if (normalizedModel.Length == 0 && normalizedPnp.Length == 0) return string.Empty;

            RegistryDiskCandidate best = null;
            TryFindRegistryDiskSerial(Registry.LocalMachine, @"SYSTEM\CurrentControlSet\Enum\SCSI", normalizedModel, normalizedPnp, ref best);
            TryFindRegistryDiskSerial(Registry.LocalMachine, @"SYSTEM\CurrentControlSet\Enum\NVME", normalizedModel, normalizedPnp, ref best);
            TryFindRegistryDiskSerial(Registry.LocalMachine, @"SYSTEM\CurrentControlSet\Enum\IDE", normalizedModel, normalizedPnp, ref best);
            TryFindRegistryDiskSerial(Registry.LocalMachine, @"SYSTEM\CurrentControlSet\Enum\USBSTOR", normalizedModel, normalizedPnp, ref best);

            return best == null ? string.Empty : best.SerialNumber;
        }

        private static string ExtractSerialFromPnpDeviceId(string deviceId)
        {
            if (string.IsNullOrWhiteSpace(deviceId)) return string.Empty;

            string[] parts = deviceId.Split(new[] { '\\' }, StringSplitOptions.RemoveEmptyEntries);
            for (int i = parts.Length - 1; i >= 0; i--)
            {
                string part = parts[i];
                int amp = part.IndexOf('&');
                if (amp > 0) part = part.Substring(0, amp);

                string serial = NormalizeDiskSerial(part);
                if (IsLikelyVendorSerial(serial)) return serial;
            }

            return ExtractBestSerialFromText(deviceId);
        }

        private static void TryFindRegistryDiskSerial(RegistryKey root, string path, string normalizedModel, string normalizedPnp, ref RegistryDiskCandidate best)
        {
            try
            {
                using (RegistryKey baseKey = root.OpenSubKey(path))
                {
                    if (baseKey == null) return;

                    foreach (string modelKeyName in baseKey.GetSubKeyNames())
                    {
                        string normalizedKey = NormalizeModel(modelKeyName);
                        int modelScore = ScoreRegistryDiskModelMatch(normalizedModel, normalizedPnp, normalizedKey);
                        if (modelScore <= 0) continue;

                        using (RegistryKey modelKey = baseKey.OpenSubKey(modelKeyName))
                        {
                            if (modelKey == null) continue;

                            foreach (string instanceName in modelKey.GetSubKeyNames())
                            {
                                string serial = ExtractSerialFromRegistryInstance(instanceName);
                                ConsiderRegistryDiskCandidate(ref best, serial, modelScore + 20);

                                using (RegistryKey instanceKey = modelKey.OpenSubKey(instanceName))
                                {
                                    if (instanceKey == null) continue;

                                    int instanceScore = modelScore;
                                    string instanceText = modelKeyName + "\\" + instanceName + " " + ReadRegistryObjectText(instanceKey, "FriendlyName") + " " + ReadRegistryObjectText(instanceKey, "DeviceDesc");
                                    string normalizedInstanceText = NormalizeModel(instanceText);
                                    if (normalizedPnp.Length > 0 && normalizedPnp.Contains(NormalizeModel(modelKeyName + "\\" + instanceName))) instanceScore += 50;
                                    if (normalizedModel.Length > 0 && normalizedInstanceText.Contains(normalizedModel)) instanceScore += 20;

                                    ConsiderRegistryDiskCandidate(ref best, ExtractBestSerialFromText(ReadRegistryObjectText(instanceKey, "ParentIdPrefix")), instanceScore + 5);
                                    ConsiderRegistryDiskCandidate(ref best, ExtractBestSerialFromRegistryValues(instanceKey), instanceScore);
                                }
                            }
                        }
                    }
                }
            }
            catch
            {
            }
        }

        private static int ScoreRegistryDiskModelMatch(string normalizedModel, string normalizedPnp, string normalizedRegistryKey)
        {
            if (normalizedRegistryKey.Length == 0) return 0;

            int score = 0;
            if (normalizedModel.Length > 0)
            {
                if (normalizedRegistryKey.Contains(normalizedModel) || normalizedModel.Contains(normalizedRegistryKey))
                {
                    score += 100;
                }
                else
                {
                    score += ScoreModelSimilarity(normalizedModel, normalizedRegistryKey);
                    string[] modelTokens = SplitModelTokens(normalizedModel);
                    foreach (string token in modelTokens)
                    {
                        if (token.Length >= 4 && normalizedRegistryKey.Contains(token)) score += 15;
                    }
                }
            }

            if (normalizedPnp.Length > 0 && normalizedPnp.Contains(normalizedRegistryKey)) score += 80;

            return score >= 30 ? score : 0;
        }

        private static string[] SplitModelTokens(string normalizedModel)
        {
            var tokens = new List<string>();
            if (string.IsNullOrEmpty(normalizedModel)) return tokens.ToArray();

            var current = new StringBuilder();
            char previousKind = '\0';
            foreach (char c in normalizedModel)
            {
                char kind = char.IsDigit(c) ? 'd' : 'a';
                if (current.Length > 0 && kind != previousKind)
                {
                    tokens.Add(current.ToString());
                    current.Length = 0;
                }
                current.Append(c);
                previousKind = kind;
            }
            if (current.Length > 0) tokens.Add(current.ToString());
            if (normalizedModel.Length >= 4) tokens.Add(normalizedModel);
            return tokens.ToArray();
        }

        private static void ConsiderRegistryDiskCandidate(ref RegistryDiskCandidate best, string serial, int score)
        {
            serial = NormalizeDiskSerial(serial);
            if (!IsLikelyTextExtractedSerial(serial)) return;

            score += ScoreDiskSerial(serial);
            if (best == null || score > best.Score)
            {
                best = new RegistryDiskCandidate
                {
                    SerialNumber = serial,
                    Score = score
                };
            }
        }

        private static string ReadRegistryObjectText(RegistryKey key, string name)
        {
            try
            {
                object value = key.GetValue(name);
                if (value == null) return string.Empty;

                string[] values = value as string[];
                if (values != null) return string.Join(" ", values);

                return Convert.ToString(value);
            }
            catch
            {
                return string.Empty;
            }
        }

        private static string ExtractBestSerialFromRegistryValues(RegistryKey key)
        {
            string best = string.Empty;
            int bestScore = int.MinValue;

            try
            {
                foreach (string name in key.GetValueNames())
                {
                    if (!MayContainDiskSerialRegistryValue(name)) continue;

                    string serial = ExtractBestSerialFromText(ReadRegistryObjectText(key, name));
                    int score = ScoreDiskSerial(serial);
                    if (IsLikelyTextExtractedSerial(serial) && score > bestScore)
                    {
                        best = serial;
                        bestScore = score;
                    }
                }
            }
            catch
            {
            }

            return best;
        }

        private static bool MayContainDiskSerialRegistryValue(string name)
        {
            string normalized = NormalizeModel(name);
            if (normalized.Length == 0) return false;

            if (normalized == "containerid"
                || normalized == "classguid"
                || normalized == "compatibleids"
                || normalized == "hardwareid"
                || normalized == "locationpaths"
                || normalized == "devicedesc"
                || normalized == "friendlyname") return false;

            return normalized.Contains("serial")
                || normalized.Contains("parentid")
                || normalized.Contains("uniqueid")
                || normalized.Contains("identifier");
        }

        private static string ExtractSerialFromRegistryInstance(string instanceName)
        {
            if (string.IsNullOrWhiteSpace(instanceName)) return string.Empty;

            string value = instanceName;
            int amp = value.IndexOf('&');
            if (amp > 0) value = value.Substring(0, amp);

            string serial = NormalizeDiskSerial(value);
            if (!IsLikelyVendorSerial(serial)) return string.Empty;

            return serial.Replace("_", string.Empty).Trim();
        }

        private static StorageDiskCandidate FindStorageDiskCandidate(List<StorageDiskCandidate> candidates, string model, long sizeBytes)
        {
            return FindStorageDiskCandidate(candidates, -1, model, sizeBytes);
        }

        private static StorageDiskCandidate FindStorageDiskCandidate(List<StorageDiskCandidate> candidates, int index, string model, long sizeBytes)
        {
            StorageDiskCandidate best = null;
            long bestScore = long.MinValue;

            foreach (StorageDiskCandidate candidate in candidates)
            {
                long score = 0;
                bool indexMatched = index >= 0 && candidate.Index >= 0 && index == candidate.Index;
                int modelScore = ScoreModelSimilarity(model, candidate.FriendlyName);
                bool modelMatched = modelScore >= 45;

                if (!indexMatched && !modelMatched) continue;

                if (sizeBytes > 0 && candidate.SizeBytes > 0)
                {
                    long diff = Math.Abs(candidate.SizeBytes - sizeBytes);
                    long tolerance = Math.Max(1024L * 1024L * 1024L, sizeBytes / 100);
                    if (diff <= tolerance) score += 100;
                    score -= diff / (1024L * 1024L * 1024L);
                }

                if (modelMatched) score += 60 + modelScore;
                if (indexMatched) score += 140;

                if (score > bestScore)
                {
                    bestScore = score;
                    best = candidate;
                }
            }

            return bestScore >= 80 ? best : null;
        }

        private static bool LooksLikeSameModel(string left, string right)
        {
            return ScoreModelSimilarity(left, right) >= 80;
        }

        private static int ScoreModelSimilarity(string left, string right)
        {
            string a = NormalizeModel(left);
            string b = NormalizeModel(right);
            if (a.Length == 0 || b.Length == 0) return 0;

            if (a.Contains(b) || b.Contains(a)) return 100;

            string[] leftTokens = SplitSearchModelTokens(a);
            string[] rightTokens = SplitSearchModelTokens(b);
            int score = 0;

            foreach (string token in leftTokens)
            {
                if (token.Length < 3) continue;
                foreach (string other in rightTokens)
                {
                    if (other.Length < 3) continue;
                    if (token == other)
                    {
                        score += token.Length >= 5 ? 28 : 16;
                        break;
                    }
                    if (token.Length >= 5 && (token.Contains(other) || other.Contains(token)))
                    {
                        score += 18;
                        break;
                    }
                }
            }

            if (IsWesternDigitalModel(a) && IsWesternDigitalModel(b)) score += 20;
            if (a.Contains("sn7100") && b.Contains("sn7100")) score += 45;
            if (a.Contains("wdblack") && (b.Contains("wdblack") || b.Contains("black"))) score += 20;
            if (b.Contains("wdblack") && (a.Contains("wdblack") || a.Contains("black"))) score += 20;

            return Math.Min(score, 100);
        }

        private static string[] SplitSearchModelTokens(string normalizedModel)
        {
            var tokens = new List<string>();
            foreach (string token in SplitModelTokens(normalizedModel))
            {
                if (token.Length >= 3) tokens.Add(token);
            }

            string compact = normalizedModel
                .Replace("diskdevice", string.Empty)
                .Replace("scsidisk", string.Empty)
                .Replace("nvme", string.Empty)
                .Replace("ssd", string.Empty);
            if (compact.Length >= 4) tokens.Add(compact);

            return tokens.ToArray();
        }

        private static bool LooksLikeModelToken(string model, string value)
        {
            string normalizedModel = NormalizeModel(model);
            string normalizedValue = NormalizeModel(value);
            if (normalizedModel.Length < 6 || normalizedValue.Length < 6) return false;
            return normalizedModel.Contains(normalizedValue) || normalizedValue.Contains(normalizedModel);
        }

        private static string NormalizeModel(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            var sb = new StringBuilder();
            foreach (char c in value.ToLowerInvariant())
            {
                if (char.IsLetterOrDigit(c)) sb.Append(c);
            }
            return sb.ToString();
        }

        private static int ParsePhysicalDriveIndex(string tag)
        {
            if (string.IsNullOrWhiteSpace(tag)) return -1;
            string upper = tag.ToUpperInvariant();
            string marker = "PHYSICALDRIVE";
            int pos = upper.LastIndexOf(marker);
            if (pos < 0) return -1;

            string tail = upper.Substring(pos + marker.Length);
            int parsed;
            return int.TryParse(tail, out parsed) ? parsed : -1;
        }

        private static string NormalizeDiskSerial(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;

            string serial = value.Trim().Trim('.');
            serial = serial.Replace("\0", string.Empty).Trim();
            serial = serial.Replace(" ", string.Empty).Trim();

            return serial;
        }

        private static bool IsLikelyVendorSerial(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;

            string serial = value.Trim();
            string lower = serial.ToLowerInvariant();
            if (lower == "none" || lower == "unknown" || lower == "to be filled by o.e.m.") return false;
            if (IsInvalidDiskIdentifier(serial)) return false;

            int hexCount = 0;
            int separatorCount = 0;
            int alphaNumericCount = 0;

            foreach (char c in serial)
            {
                if (Uri.IsHexDigit(c)) hexCount++;
                if (c == '_' || c == '-' || c == ':' || c == ' ') separatorCount++;
                if (char.IsLetterOrDigit(c)) alphaNumericCount++;
            }

            bool looksLikeEuiOrGuid =
                ((serial.IndexOf('_') >= 0 && separatorCount >= 3 && alphaNumericCount == 16 && hexCount == 16)
                    || (serial.IndexOf('_') >= 0 && separatorCount >= 4 && alphaNumericCount >= 24 && hexCount >= 24)
                    || (separatorCount == 0 && alphaNumericCount >= 24 && hexCount >= 24));

            if (looksLikeEuiOrGuid) return false;

            return alphaNumericCount >= 5;
        }

        private static bool IsInvalidDiskIdentifier(string value)
        {
            string serial = NormalizeDiskSerial(value);
            if (serial.Length == 0) return true;

            Guid parsedGuid;
            if (Guid.TryParse(serial, out parsedGuid)) return true;

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

            if (alphaNumericCount > 0 && zeroOrFCount == alphaNumericCount) return true;

            bool looksLikeHyphenGuid =
                serial.IndexOf('-') >= 0
                && separatorCount >= 4
                && alphaNumericCount >= 24
                && hexCount == alphaNumericCount;
            if (looksLikeHyphenGuid) return true;

            return false;
        }

        private static string ExtractBestSerialFromText(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;

            string best = string.Empty;
            int bestScore = int.MinValue;
            var token = new StringBuilder();

            for (int i = 0; i <= value.Length; i++)
            {
                char c = i < value.Length ? value[i] : ' ';
                if (char.IsLetterOrDigit(c) || c == '_' || c == '-' || c == ':')
                {
                    token.Append(c);
                    continue;
                }

                if (token.Length > 0)
                {
                    string serial = NormalizeDiskSerial(token.ToString());
                    int score = ScoreDiskSerial(serial);
                    if (IsLikelyTextExtractedSerial(serial) && score > bestScore)
                    {
                        best = serial;
                        bestScore = score;
                    }
                    token.Length = 0;
                }
            }

            return best;
        }

        private static bool IsLikelyTextExtractedSerial(string value)
        {
            if (!IsLikelyVendorSerial(value)) return false;

            string serial = NormalizeDiskSerial(value);
            if (serial.Length < 8) return false;

            int digits = 0;
            int letters = 0;
            bool allSame = true;

            for (int i = 0; i < serial.Length; i++)
            {
                char c = serial[i];
                if (char.IsDigit(c)) digits++;
                if (char.IsLetter(c)) letters++;
                if (i > 0 && c != serial[0]) allSame = false;
            }

            if (allSame) return false;
            if (letters == 0 && digits < 10) return false;

            string normalized = NormalizeModel(serial);
            string[] rejected = new[] {
                "physicaldrive", "disk", "drive", "scsi", "nvme", "stor", "storage",
                "ven", "vendor", "prod", "product", "volume", "partmgr", "controller"
            };

            foreach (string item in rejected)
            {
                if (normalized == item) return false;
            }

            return true;
        }

        private static int ScoreDiskSerial(string value)
        {
            string serial = NormalizeDiskSerial(value);
            if (!IsLikelyVendorSerial(serial)) return 0;

            int score = 10;
            bool hasLetter = false;
            bool hasDigit = false;
            int separatorCount = 0;
            int alphaNumericCount = 0;

            foreach (char c in serial)
            {
                if (char.IsLetter(c)) hasLetter = true;
                if (char.IsDigit(c)) hasDigit = true;
                if (c == '_' || c == '-' || c == ':') separatorCount++;
                if (char.IsLetterOrDigit(c)) alphaNumericCount++;
            }

            if (hasLetter && hasDigit) score += 25;
            if (alphaNumericCount >= 8) score += 10;
            if (alphaNumericCount >= 12) score += 10;
            if (separatorCount > 0 && !serial.StartsWith("WD-", StringComparison.OrdinalIgnoreCase)) score -= 5;
            return score;
        }

        private static int ScoreDiskSerialForModel(string model, string serial)
        {
            string normalizedModel = NormalizeModel(model);
            string value = NormalizeDiskSerial(serial);
            if (!IsLikelyVendorSerial(value)) return 0;

            int score = 0;
            string upper = value.ToUpperInvariant();
            int alphaNumericCount = 0;
            int hexCount = 0;
            int letters = 0;
            int digits = 0;

            foreach (char c in value)
            {
                if (char.IsLetterOrDigit(c)) alphaNumericCount++;
                if (Uri.IsHexDigit(c)) hexCount++;
                if (char.IsLetter(c)) letters++;
                if (char.IsDigit(c)) digits++;
            }

            if (IsWesternDigitalModel(normalizedModel))
            {
                if (upper.StartsWith("WD-", StringComparison.OrdinalIgnoreCase)) score += 45;
                if (upper.StartsWith("WD", StringComparison.OrdinalIgnoreCase) && alphaNumericCount >= 8) score += 20;
                if (alphaNumericCount >= 8 && alphaNumericCount <= 24 && letters > 0 && digits > 0 && value.IndexOf(':') < 0) score += 25;
                if (normalizedModel.Contains("sn7100") && alphaNumericCount >= 8 && letters > 0 && digits > 0) score += 20;
                if (normalizedModel.Contains("wdblack") && alphaNumericCount >= 8 && letters > 0 && digits > 0) score += 10;
            }

            if (normalizedModel.Contains("seagate") || normalizedModel.Contains("st"))
            {
                if (alphaNumericCount >= 8 && alphaNumericCount <= 12 && letters > 0 && digits > 0) score += 25;
            }

            if (IsSamsungNvmeModel(normalizedModel) || normalizedModel.Contains("samsung"))
            {
                if (upper.StartsWith("S", StringComparison.OrdinalIgnoreCase) && alphaNumericCount >= 10) score += 30;
            }

            if (normalizedModel.Contains("kingston") && alphaNumericCount >= 12) score += 15;
            if ((normalizedModel.Contains("intel") || normalizedModel.Contains("solidigm")) && alphaNumericCount >= 10) score += 15;

            if (alphaNumericCount >= 24 && hexCount == alphaNumericCount) score -= 35;
            if (value.IndexOf(':') >= 0) score -= 20;

            return score;
        }

        private class StorageDiskCandidate
        {
            public string FriendlyName;
            public string SerialNumber;
            public long SizeBytes;
            public int Index = -1;
        }

        private class DiskSerialCandidate
        {
            public string SerialNumber;
            public int Score;
            public string Source;
        }

        private class RegistryDiskCandidate
        {
            public string SerialNumber;
            public int Score;
        }

        private class NetworkConfigMaps
        {
            public Dictionary<string, List<string>> ByMac = new Dictionary<string, List<string>>();
            public Dictionary<int, List<string>> ByIndex = new Dictionary<int, List<string>>();
        }

        private static List<ManagementObject> Query(string wql)
        {
            var result = new List<ManagementObject>();
            try
            {
                using (var searcher = new ManagementObjectSearcher(wql))
                {
                    searcher.Options = WmiQueryOptions();
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        result.Add(obj);
                    }
                }
            }
            catch
            {
            }
            return result;
        }

        private static EnumerationOptions WmiQueryOptions()
        {
            return new EnumerationOptions
            {
                Timeout = TimeSpan.FromSeconds(IsWindowsXpOrOlder() ? 3 : 6),
                ReturnImmediately = true,
                Rewindable = false
            };
        }

        private static ManagementScope CreateManagementScope(string path)
        {
            var options = new ConnectionOptions
            {
                Timeout = TimeSpan.FromSeconds(IsWindowsXpOrOlder() ? 3 : 6)
            };
            return new ManagementScope(path, options);
        }

        private static bool IsWindowsXpOrOlder()
        {
            Version version = Environment.OSVersion.Version;
            return version.Major < 6;
        }

        private static bool IsWindows8OrNewer()
        {
            Version version = Environment.OSVersion.Version;
            return version.Major > 6 || (version.Major == 6 && version.Minor >= 2);
        }

        private static object SafeGet(ManagementObject obj, string name)
        {
            try { return obj[name]; }
            catch { return null; }
        }

        private static string ReadString(ManagementObject obj, string name)
        {
            object value = SafeGet(obj, name);
            return value == null ? string.Empty : Convert.ToString(value).Trim();
        }

        private static string ReadStringArrayText(ManagementObject obj, string name)
        {
            object value = SafeGet(obj, name);
            if (value == null) return string.Empty;

            string[] values = value as string[];
            if (values != null) return string.Join(" ", values);

            return Convert.ToString(value).Trim();
        }

        private static long ReadLong(ManagementObject obj, string name)
        {
            object value = SafeGet(obj, name);
            if (value == null) return 0;
            long parsed;
            return long.TryParse(Convert.ToString(value), out parsed) ? parsed : 0;
        }

        private static int ReadInt(ManagementObject obj, string name)
        {
            object value = SafeGet(obj, name);
            if (value == null) return -1;
            int parsed;
            return int.TryParse(Convert.ToString(value), out parsed) ? parsed : -1;
        }

        private static string FormatWmiDate(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            try
            {
                return ManagementDateTimeConverter.ToDateTime(value).ToString("yyyy-MM-dd HH:mm:ss");
            }
            catch
            {
                return value;
            }
        }

        private static string FormatBytes(long bytes)
        {
            if (bytes <= 0) return string.Empty;
            decimal gb = bytes / 1024m / 1024m / 1024m;
            return gb.ToString("0.##", CultureInfo.InvariantCulture) + " GB";
        }
    }
}
