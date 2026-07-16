using System;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;

namespace AssetCollector
{
    public static class SecurityClient
    {
        private const string OfflineFallbackKeySha256 = "302ce0f50d3a86806d2f02b374db8b18855d0ef3a11ff94cf4fa133e1aac4553";

        public static bool VerifyKey(string serverUrl, string key, out string message)
        {
            key = (key ?? string.Empty).Trim();
            if (key.Length == 0)
            {
                message = "请输入密钥。";
                return false;
            }

            try
            {
                string url = NormalizeUrl(serverUrl) + "/api/client-danger-key/verify";
                var request = (HttpWebRequest)WebRequest.Create(url);
                request.Method = "POST";
                request.Accept = "application/json";
                request.ContentType = "application/json; charset=utf-8";
                request.Timeout = 5000;
                byte[] bytes = Encoding.UTF8.GetBytes("{\"key\":\"" + EscapeJson(key) + "\"}");
                request.ContentLength = bytes.Length;
                using (Stream stream = request.GetRequestStream())
                {
                    stream.Write(bytes, 0, bytes.Length);
                }

                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    bool ok = (int)response.StatusCode >= 200 && (int)response.StatusCode < 300;
                    message = ok ? string.Empty : "服务端密钥验证失败。";
                    return ok;
                }
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null && response.StatusCode == HttpStatusCode.Unauthorized)
                {
                    message = "密钥错误。";
                    return false;
                }

                return VerifyOfflineFallbackKey(key, out message);
            }
            catch
            {
                return VerifyOfflineFallbackKey(key, out message);
            }
        }

        public static bool PromptAndVerify(IWin32Window owner, string serverUrl, string title)
        {
            using (var dialog = new PasswordPromptForm(title))
            {
                if (dialog.ShowDialog(owner) != DialogResult.OK) return false;

                string message;
                if (VerifyKey(serverUrl, dialog.Password, out message)) return true;

                MessageBox.Show(owner, message, "密钥验证失败", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return false;
            }
        }

        private static bool VerifyOfflineFallbackKey(string key, out string message)
        {
            if (string.Equals(Sha256Hex(key), OfflineFallbackKeySha256, StringComparison.OrdinalIgnoreCase))
            {
                message = string.Empty;
                return true;
            }

            message = "无法连接服务端验证密钥。离线环境请输入兜底密钥。";
            return false;
        }

        private static string NormalizeUrl(string value)
        {
            string url = (value ?? string.Empty).Trim().TrimEnd('/');
            if (url.Length == 0) url = DiscoveryClient.FallbackServerUrl;
            if (url.IndexOf("://", StringComparison.Ordinal) < 0) url = "http://" + url;
            return url;
        }

        private static string EscapeJson(string value)
        {
            return (value ?? string.Empty).Replace("\\", "\\\\").Replace("\"", "\\\"");
        }

        private static string Sha256Hex(string value)
        {
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(value ?? string.Empty));
                StringBuilder text = new StringBuilder(hash.Length * 2);
                foreach (byte item in hash)
                {
                    text.Append(item.ToString("x2"));
                }
                return text.ToString();
            }
        }
    }
}
