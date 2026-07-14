using System;
using System.Configuration;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Web.Script.Serialization;

namespace AssetCollector
{
    public static class DiscoveryClient
    {
        private const string Magic = "IT_ASSET_COLLECTOR_DISCOVER_V1";
        public const string FallbackServerUrl = "http://192.168.1.44:3000";

        public static string DiscoverServerUrl(int timeoutMilliseconds)
        {
            return DiscoverServerUrl(timeoutMilliseconds, string.Empty);
        }

        public static string DiscoverServerUrl(int timeoutMilliseconds, string preferredUrl)
        {
            foreach (string candidate in FastCandidates(preferredUrl))
            {
                if (IsServerReachable(candidate, 300)) return NormalizeUrl(candidate);
            }

            int port = DiscoveryPort();
            using (var client = new UdpClient())
            {
                client.EnableBroadcast = true;
                client.Client.ReceiveTimeout = Math.Max(250, Math.Min(timeoutMilliseconds, 700));

                byte[] request = Encoding.UTF8.GetBytes(Magic);
                foreach (var endpoint in BroadcastEndpoints(port))
                {
                    try { client.Send(request, request.Length, endpoint); }
                    catch { }
                }

                DateTime deadline = DateTime.Now.AddMilliseconds(timeoutMilliseconds);
                while (DateTime.Now < deadline)
                {
                    try
                    {
                        IPEndPoint remote = new IPEndPoint(IPAddress.Any, 0);
                        byte[] response = client.Receive(ref remote);
                        string url = ParseResponse(response);
                        url = ReplaceLoopbackHost(url, remote.Address);
                        if (!string.IsNullOrWhiteSpace(url) && IsServerReachable(url, 500)) return url.TrimEnd('/');
                    }
                    catch (SocketException)
                    {
                        break;
                    }
                }
            }

            foreach (string candidate in SlowCandidates(preferredUrl))
            {
                if (IsServerReachable(candidate, 500)) return NormalizeUrl(candidate);
            }

            return FallbackServerUrl;
        }

        private static IEnumerable<string> FastCandidates(string preferredUrl)
        {
            var result = new List<string>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (string value in new[] {
                preferredUrl,
                ConfigurationManager.AppSettings["ServerUrl"],
                "http://localhost:3000",
                "http://127.0.0.1:3000"
            })
            {
                string url = NormalizeUrl(value);
                if (url.Length > 0 && seen.Add(url)) result.Add(url);
            }
            return result;
        }

        private static IEnumerable<string> SlowCandidates(string preferredUrl)
        {
            var result = new List<string>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (string value in FastCandidates(preferredUrl))
            {
                if (seen.Add(value)) result.Add(value);
            }
            foreach (string value in LanGatewayCandidates())
            {
                string url = NormalizeUrl(value);
                if (url.Length > 0 && seen.Add(url)) result.Add(url);
            }
            return result;
        }

        private static IEnumerable<string> LanGatewayCandidates()
        {
            var result = new List<string>();
            try
            {
                foreach (NetworkInterface item in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (item.OperationalStatus != OperationalStatus.Up) continue;
                    if (item.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                    foreach (UnicastIPAddressInformation address in item.GetIPProperties().UnicastAddresses)
                    {
                        if (address.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                        string[] parts = address.Address.ToString().Split('.');
                        if (parts.Length != 4) continue;
                        result.Add("http://" + parts[0] + "." + parts[1] + "." + parts[2] + ".1:3000");
                    }
                }
            }
            catch
            {
            }
            result.Add(FallbackServerUrl);
            return result;
        }

        private static IEnumerable<IPEndPoint> BroadcastEndpoints(int port)
        {
            var endpoints = new List<IPEndPoint>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            AddEndpoint(endpoints, seen, IPAddress.Broadcast, port);

            NetworkInterface[] interfaces;
            try
            {
                interfaces = NetworkInterface.GetAllNetworkInterfaces();
            }
            catch
            {
                return endpoints;
            }

            foreach (NetworkInterface item in interfaces)
            {
                if (item.OperationalStatus != OperationalStatus.Up) continue;
                if (item.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;

                foreach (UnicastIPAddressInformation address in item.GetIPProperties().UnicastAddresses)
                {
                    if (address.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                    IPAddress mask = SafeGetIpv4Mask(address);
                    if (mask == null) continue;

                    IPAddress broadcast = GetBroadcastAddress(address.Address, mask);
                    AddEndpoint(endpoints, seen, broadcast, port);
                }
            }

            return endpoints;
        }

        private static IPAddress SafeGetIpv4Mask(UnicastIPAddressInformation address)
        {
            try
            {
                return address.IPv4Mask;
            }
            catch
            {
                return null;
            }
        }

        private static void AddEndpoint(List<IPEndPoint> endpoints, HashSet<string> seen, IPAddress address, int port)
        {
            string key = address + ":" + port;
            if (seen.Add(key)) endpoints.Add(new IPEndPoint(address, port));
        }

        private static IPAddress GetBroadcastAddress(IPAddress address, IPAddress mask)
        {
            byte[] ipBytes = address.GetAddressBytes();
            byte[] maskBytes = mask.GetAddressBytes();
            byte[] broadcastBytes = new byte[ipBytes.Length];
            for (int i = 0; i < broadcastBytes.Length; i++)
            {
                broadcastBytes[i] = (byte)(ipBytes[i] | (maskBytes[i] ^ 255));
            }
            return new IPAddress(broadcastBytes);
        }

        private static string ReplaceLoopbackHost(string url, IPAddress remoteAddress)
        {
            if (string.IsNullOrWhiteSpace(url) || remoteAddress == null) return url;
            if (IPAddress.IsLoopback(remoteAddress)) return url;

            try
            {
                Uri uri = new Uri(NormalizeUrl(url));
                if (!string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(uri.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase))
                {
                    return url;
                }

                return uri.Scheme + "://" + remoteAddress + (uri.IsDefaultPort ? string.Empty : ":" + uri.Port);
            }
            catch
            {
                return url;
            }
        }

        public static int DiscoveryPort()
        {
            int port;
            string configured = ConfigurationManager.AppSettings["DiscoveryPort"];
            return int.TryParse(configured, out port) && port > 0 ? port : 33030;
        }

        private static string ParseResponse(byte[] response)
        {
            try
            {
                string json = Encoding.UTF8.GetString(response);
                var data = new JavaScriptSerializer().DeserializeObject(json) as System.Collections.Generic.Dictionary<string, object>;
                if (data == null) return string.Empty;
                if (!data.ContainsKey("magic") || Convert.ToString(data["magic"]) != Magic) return string.Empty;
                return data.ContainsKey("url") ? Convert.ToString(data["url"]) : string.Empty;
            }
            catch
            {
                return string.Empty;
            }
        }

        private static bool IsServerReachable(string serverUrl, int timeoutMilliseconds)
        {
            if (string.IsNullOrWhiteSpace(serverUrl)) return false;

            try
            {
                string url = NormalizeUrl(serverUrl) + "/api/ping";
                var request = (HttpWebRequest)WebRequest.Create(url);
                request.Method = "GET";
                request.Timeout = timeoutMilliseconds;
                request.ReadWriteTimeout = timeoutMilliseconds;
                request.Accept = "application/json";

                using (var response = (HttpWebResponse)request.GetResponse())
                using (var stream = response.GetResponseStream())
                {
                    if (stream != null)
                    {
                        byte[] buffer = new byte[1];
                        stream.Read(buffer, 0, 0);
                    }
                    return (int)response.StatusCode >= 200 && (int)response.StatusCode < 300;
                }
            }
            catch
            {
                return false;
            }
        }

        private static string NormalizeUrl(string value)
        {
            string url = (value ?? string.Empty).Trim().TrimEnd('/');
            if (url.Length == 0) return string.Empty;
            if (url.IndexOf("://", StringComparison.Ordinal) < 0) url = "http://" + url;
            return url;
        }
    }
}
