using System;
using System.Collections.Generic;

namespace AssetCollector
{
    public class AssetPayload
    {
        public UserInfo user { get; set; }
        public SystemInfo system { get; set; }
        public BaseBoardInfo baseBoard { get; set; }
        public List<NetworkAdapterInfo> networkAdapters { get; set; }
        public List<DiskInfo> disks { get; set; }

        public AssetPayload()
        {
            user = new UserInfo();
            system = new SystemInfo();
            baseBoard = new BaseBoardInfo();
            networkAdapters = new List<NetworkAdapterInfo>();
            disks = new List<DiskInfo>();
        }
    }

    public class OfflineAssetRecord
    {
        public string id { get; set; }
        public string savedAt { get; set; }
        public AssetPayload payload { get; set; }
    }

    public class CollectionRequest
    {
        public string id { get; set; }
        public string createdAt { get; set; }
        public string expiresAt { get; set; }
        public bool reviewOnly { get; set; }
    }

    public class ClientUpdateInfo
    {
        public bool updateAvailable { get; set; }
        public string version { get; set; }
        public string exeUrl { get; set; }
        public string configUrl { get; set; }
        public string fileName { get; set; }
        public string sha256 { get; set; }
        public string signature { get; set; }
        public long size { get; set; }
        public string notes { get; set; }
    }

    public class UserInfo
    {
        public string name { get; set; }
        public string department { get; set; }
        public string employeeId { get; set; }
        public string location { get; set; }
        public string phone { get; set; }
        public string note { get; set; }
    }

    public class SystemInfo
    {
        public string computerCode { get; set; }
        public string computerName { get; set; }
        public string osCaption { get; set; }
        public string osVersion { get; set; }
        public string installDate { get; set; }
    }

    public class BaseBoardInfo
    {
        public string manufacturer { get; set; }
        public string product { get; set; }
        public string serialNumber { get; set; }
    }

    public class NetworkAdapterInfo
    {
        public string name { get; set; }
        public string macAddress { get; set; }
        public List<string> ipAddresses { get; set; }

        public NetworkAdapterInfo()
        {
            ipAddresses = new List<string>();
        }
    }

    public class DiskInfo
    {
        public string model { get; set; }
        public string serialNumber { get; set; }
        public long sizeBytes { get; set; }
        public string sizeText { get; set; }
    }
}
