using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace AssetCollector
{
    public static class ApiClient
    {
        public static string DefaultServerUrl()
        {
            string configured = ConfigurationManager.AppSettings["ServerUrl"];
            return NormalizeUrl(string.IsNullOrWhiteSpace(configured) ? "http://localhost:3000" : configured);
        }

        public static string Submit(string serverUrl, AssetPayload payload)
        {
            string url = NormalizeUrl(serverUrl) + "/api/assets";
            string json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 * 8 }.Serialize(payload);
            byte[] bytes = Encoding.UTF8.GetBytes(json);

            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "POST";
            request.ContentType = "application/json; charset=utf-8";
            request.Accept = "application/json";
            request.Timeout = 20000;
            request.ContentLength = bytes.Length;

            using (Stream stream = request.GetRequestStream())
            {
                stream.Write(bytes, 0, bytes.Length);
            }

            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
            {
                string body = reader.ReadToEnd();
                string actionText = DescribeSubmitResult(body);
                return ((int)response.StatusCode) + " " + response.StatusDescription
                    + (string.IsNullOrEmpty(actionText) ? string.Empty : Environment.NewLine + actionText)
                    + Environment.NewLine + body;
            }
        }

        public static CollectionRequest GetCollectionRequest(string serverUrl, string lastTaskId)
        {
            string url = NormalizeUrl(serverUrl) + "/api/collect/request?computerName="
                + Uri.EscapeDataString(Environment.MachineName)
                + "&lastTaskId=" + Uri.EscapeDataString(lastTaskId ?? string.Empty);
            string body = RequestText(url, "GET", null);
            var data = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 }.DeserializeObject(body) as Dictionary<string, object>;
            if (data == null) return null;
            object requestValue;
            if (!data.TryGetValue("request", out requestValue) || requestValue == null) return null;
            var requestData = requestValue as Dictionary<string, object>;
            if (requestData == null) return null;
            return new CollectionRequest
            {
                id = Value(requestData, "id"),
                createdAt = Value(requestData, "createdAt"),
                expiresAt = Value(requestData, "expiresAt"),
                reviewOnly = BoolValue(requestData, "reviewOnly")
            };
        }

        public static void ReportCollection(string serverUrl, string taskId, AssetPayload payload, string status, string message)
        {
            var data = new Dictionary<string, object>();
            data["taskId"] = taskId ?? string.Empty;
            data["computerName"] = Environment.MachineName;
            data["status"] = status ?? string.Empty;
            data["message"] = message ?? string.Empty;
            if (payload != null) data["payload"] = payload;
            string json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 * 8 }.Serialize(data);
            RequestText(NormalizeUrl(serverUrl) + "/api/collect/report", "POST", json);
        }

        public static ClientUpdateInfo CheckClientUpdate(string serverUrl, string currentVersion)
        {
            string url = NormalizeUrl(serverUrl) + "/api/client/update?computerName="
                + Uri.EscapeDataString(Environment.MachineName)
                + "&version=" + Uri.EscapeDataString(currentVersion ?? string.Empty)
                + "&flavor=" + Uri.EscapeDataString(ConfigurationManager.AppSettings["ClientFlavor"] ?? "win");
            string body = RequestText(url, "GET", null);
            var data = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 }.DeserializeObject(body) as Dictionary<string, object>;
            if (data == null) return null;
            return new ClientUpdateInfo
            {
                updateAvailable = BoolValue(data, "updateAvailable"),
                version = Value(data, "version"),
                exeUrl = Value(data, "exeUrl"),
                configUrl = Value(data, "configUrl"),
                fileName = Value(data, "fileName"),
                sha256 = Value(data, "sha256"),
                signature = Value(data, "signature"),
                notes = Value(data, "notes"),
                size = LongValue(data, "size")
            };
        }

        public static void DownloadFile(string serverUrl, string relativeOrAbsoluteUrl, string targetPath)
        {
            string url = ResolveUrl(serverUrl, relativeOrAbsoluteUrl);
            Directory.CreateDirectory(Path.GetDirectoryName(targetPath));
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "GET";
            request.Timeout = 60000;

            using (var response = (HttpWebResponse)request.GetResponse())
            using (Stream input = response.GetResponseStream())
            using (Stream output = File.Create(targetPath))
            {
                byte[] buffer = new byte[81920];
                int read;
                while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                {
                    output.Write(buffer, 0, read);
                }
            }
        }

        public static bool VerifySha256(string filePath, string expected)
        {
            expected = (expected ?? string.Empty).Trim();
            if (expected.Length == 0) return false;
            using (var sha = SHA256.Create())
            using (var stream = File.OpenRead(filePath))
            {
                string actual = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", string.Empty).ToLowerInvariant();
                return string.Equals(actual, expected.ToLowerInvariant(), StringComparison.OrdinalIgnoreCase);
            }
        }

        public static bool VerifyUpdateSignature(ClientUpdateInfo update)
        {
            string publicKey = (ConfigurationManager.AppSettings["UpdateSigningPublicKey"] ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(publicKey)) return true;
            if (update == null || string.IsNullOrWhiteSpace(update.signature)) return false;

            string fileName = string.IsNullOrWhiteSpace(update.fileName) ? FileNameFromUpdateUrl(update.exeUrl) : update.fileName;
            string payload = string.Join("\n", new[]
            {
                update.version ?? string.Empty,
                fileName ?? string.Empty,
                (update.sha256 ?? string.Empty).Trim().ToLowerInvariant()
            });

            using (var rsa = new RSACryptoServiceProvider())
            {
                rsa.PersistKeyInCsp = false;
                rsa.FromXmlString(NormalizePublicKey(publicKey));
                byte[] data = Encoding.UTF8.GetBytes(payload);
                byte[] signature = Convert.FromBase64String(update.signature);
                return rsa.VerifyData(data, CryptoConfig.MapNameToOID("SHA256"), signature);
            }
        }

        private static string RequestText(string url, string method, string json)
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = method;
            request.Accept = "application/json";
            request.Timeout = 20000;
            if (json != null)
            {
                byte[] bytes = Encoding.UTF8.GetBytes(json);
                request.ContentType = "application/json; charset=utf-8";
                request.ContentLength = bytes.Length;
                using (Stream stream = request.GetRequestStream())
                {
                    stream.Write(bytes, 0, bytes.Length);
                }
            }

            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        private static string Value(Dictionary<string, object> data, string key)
        {
            object value;
            return data != null && data.TryGetValue(key, out value) ? Convert.ToString(value) : string.Empty;
        }

        private static bool BoolValue(Dictionary<string, object> data, string key)
        {
            object value;
            if (data == null || !data.TryGetValue(key, out value) || value == null) return false;
            if (value is bool) return (bool)value;
            bool parsed;
            return bool.TryParse(Convert.ToString(value), out parsed) && parsed;
        }

        private static long LongValue(Dictionary<string, object> data, string key)
        {
            object value;
            if (data == null || !data.TryGetValue(key, out value) || value == null) return 0;
            long parsed;
            return long.TryParse(Convert.ToString(value), out parsed) ? parsed : 0;
        }

        public static OrganizationDirectory GetOrganizationDirectory(string serverUrl)
        {
            string url = NormalizeUrl(serverUrl) + "/api/org";
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "GET";
            request.Accept = "application/json";
            request.Timeout = 5000;

            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
            {
                string body = reader.ReadToEnd();
                var serializer = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };
                var data = serializer.DeserializeObject(body) as Dictionary<string, object>;
                if (data == null) return new OrganizationDirectory();

                var directory = new OrganizationDirectory();
                var names = new List<string>();
                object flatUnits;
                if (data.TryGetValue("flatUnits", out flatUnits))
                {
                    AddOrganizationFlatUnitNames(flatUnits as object[], names);
                }

                object flatNames;
                if (names.Count == 0 && data.TryGetValue("flatNames", out flatNames))
                {
                    var flatArray = flatNames as object[];
                    if (flatArray != null) names.AddRange(flatArray.Select(Convert.ToString));
                }

                object units;
                if (names.Count == 0 && data.TryGetValue("units", out units))
                {
                    AddOrganizationUnitNames(units as object[], names);
                }

                if (data.TryGetValue("units", out units))
                {
                    AddOrganizationEmployees(units as object[], directory.EmployeeDepartments, string.Empty);
                }

                directory.Departments = names
                    .Select(name => (name ?? string.Empty).Trim())
                    .Where(name => name.Length > 0)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                return directory;
            }
        }

        public static string[] GetOrganizationDepartments(string serverUrl)
        {
            return GetOrganizationDirectory(serverUrl).Departments;
        }

        private static void AddOrganizationUnitNames(object[] units, List<string> names)
        {
            if (units == null) return;
            foreach (object item in units)
            {
                var unit = item as Dictionary<string, object>;
                if (unit == null) continue;

                object nameValue;
                object typeValue;
                string type = unit.TryGetValue("type", out typeValue) ? Convert.ToString(typeValue) : string.Empty;
                if (!string.Equals((type ?? string.Empty).Trim(), "company", StringComparison.OrdinalIgnoreCase)
                    && unit.TryGetValue("name", out nameValue))
                {
                    names.Add(Convert.ToString(nameValue));
                }

                object children;
                if (unit.TryGetValue("children", out children)) AddOrganizationUnitNames(children as object[], names);
            }
        }

        private static void AddOrganizationFlatUnitNames(object[] units, List<string> names)
        {
            if (units == null || names == null) return;
            foreach (object item in units)
            {
                var unit = item as Dictionary<string, object>;
                if (unit == null) continue;

                object typeValue;
                string type = unit.TryGetValue("type", out typeValue) ? Convert.ToString(typeValue) : string.Empty;
                if (string.Equals((type ?? string.Empty).Trim(), "company", StringComparison.OrdinalIgnoreCase)) continue;

                object nameValue;
                if (unit.TryGetValue("name", out nameValue)) names.Add(Convert.ToString(nameValue));
            }
        }

        private static void AddOrganizationEmployees(object[] units, Dictionary<string, string> employeeDepartments, string inheritedDepartment)
        {
            if (units == null || employeeDepartments == null) return;
            foreach (object item in units)
            {
                var unit = item as Dictionary<string, object>;
                if (unit == null) continue;

                object nameValue;
                string unitName = unit.TryGetValue("name", out nameValue) ? Convert.ToString(nameValue) : string.Empty;
                unitName = (unitName ?? string.Empty).Trim();

                object typeValue;
                string type = unit.TryGetValue("type", out typeValue) ? Convert.ToString(typeValue) : string.Empty;
                type = (type ?? string.Empty).Trim().ToLowerInvariant();
                string department = IsOrganizationDepartmentType(type) && unitName.Length > 0 ? unitName : inheritedDepartment;
                if (department.Length == 0 && !string.Equals(type, "company", StringComparison.OrdinalIgnoreCase)) department = unitName;

                object employees;
                if (department.Length > 0 && unit.TryGetValue("employees", out employees))
                {
                    AddEmployeeDepartmentKeys(employees as object[], department, employeeDepartments);
                }

                object children;
                if (unit.TryGetValue("children", out children)) AddOrganizationEmployees(children as object[], employeeDepartments, department);
            }
        }

        private static bool IsOrganizationDepartmentType(string type)
        {
            return string.Equals(type, "department", StringComparison.OrdinalIgnoreCase)
                || string.Equals(type, "division", StringComparison.OrdinalIgnoreCase)
                || string.Equals(type, "business-unit", StringComparison.OrdinalIgnoreCase);
        }

        private static void AddEmployeeDepartmentKeys(object[] employees, string department, Dictionary<string, string> employeeDepartments)
        {
            if (employees == null) return;
            foreach (object item in employees)
            {
                var employee = item as Dictionary<string, object>;
                if (employee == null) continue;

                AddEmployeeDepartmentKey(employee, "name", department, employeeDepartments);
                AddEmployeeDepartmentKey(employee, "employeeId", department, employeeDepartments);
            }
        }

        private static void AddEmployeeDepartmentKey(Dictionary<string, object> employee, string field, string department, Dictionary<string, string> employeeDepartments)
        {
            object value;
            if (!employee.TryGetValue(field, out value)) return;

            string key = (Convert.ToString(value) ?? string.Empty).Trim();
            if (key.Length == 0 || employeeDepartments.ContainsKey(key)) return;
            employeeDepartments[key] = department;
        }

        private static string NormalizeUrl(string value)
        {
            string url = (value ?? string.Empty).Trim().TrimEnd('/');
            if (url.Length == 0) return "http://localhost:3000";
            if (url.IndexOf("://", StringComparison.Ordinal) < 0) url = "http://" + url;
            return url;
        }

        private static string ResolveUrl(string serverUrl, string relativeOrAbsoluteUrl)
        {
            string value = (relativeOrAbsoluteUrl ?? string.Empty).Trim();
            if (value.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                || value.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return value;
            }
            if (!value.StartsWith("/", StringComparison.Ordinal)) value = "/" + value;
            return NormalizeUrl(serverUrl) + value;
        }

        private static string NormalizePublicKey(string value)
        {
            string key = (value ?? string.Empty).Trim().Replace("\\n", "\n");
            if (key.StartsWith("<", StringComparison.Ordinal)) return key;
            try
            {
                string decoded = Encoding.UTF8.GetString(Convert.FromBase64String(key)).Trim();
                return decoded.Length > 0 ? decoded : key;
            }
            catch
            {
                return key;
            }
        }

        private static string FileNameFromUpdateUrl(string value)
        {
            value = (value ?? string.Empty).Trim();
            if (value.Length == 0) return string.Empty;
            try
            {
                Uri uri;
                if (Uri.TryCreate(value, UriKind.Absolute, out uri)) return Path.GetFileName(uri.LocalPath);
            }
            catch
            {
            }
            int query = value.IndexOf('?');
            if (query >= 0) value = value.Substring(0, query);
            return Path.GetFileName(value.Replace('/', Path.DirectorySeparatorChar));
        }

        private static string DescribeSubmitResult(string body)
        {
            try
            {
                var data = new JavaScriptSerializer().DeserializeObject(body) as System.Collections.Generic.Dictionary<string, object>;
                if (data == null || !data.ContainsKey("action")) return string.Empty;

                string action = Convert.ToString(data["action"]);
                if (string.Equals(action, "pending_review", StringComparison.OrdinalIgnoreCase)) return "Server found an existing record. Submitted changes were queued for review and the asset record was not updated.";
                if (string.Equals(action, "unchanged", StringComparison.OrdinalIgnoreCase)) return "Server found an existing record and no changes were detected.";
                if (string.Equals(action, "updated", StringComparison.OrdinalIgnoreCase)) return "Server updated the existing record.";
                if (string.Equals(action, "created", StringComparison.OrdinalIgnoreCase)) return "Server created a new record.";
            }
            catch
            {
            }

            return string.Empty;
        }
    }

    public class OrganizationDirectory
    {
        public string[] Departments { get; set; }
        public Dictionary<string, string> EmployeeDepartments { get; private set; }

        public OrganizationDirectory()
        {
            Departments = new string[0];
            EmployeeDepartments = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
    }
}
