using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace AssetCollector
{
    public static class AssetExcelExporter
    {
        public static void Export(string filePath, IList<AssetPayload> assets)
        {
            var sb = new StringBuilder();
            sb.AppendLine("<!doctype html>");
            sb.AppendLine("<html><head><meta charset=\"utf-8\"></head><body>");
            sb.AppendLine("<table border=\"1\">");
            sb.AppendLine("<thead><tr>");

            string[] headers = new[] {
                "导出时间", "姓名", "部门", "工号", "位置", "电话", "备注",
                "计算机编号", "计算机名", "系统版本", "系统安装时间", "主板厂商", "主板型号", "主板序列号",
                "物理网卡", "物理硬盘"
            };

            foreach (string header in headers)
            {
                sb.Append("<th>").Append(Escape(header)).AppendLine("</th>");
            }

            sb.AppendLine("</tr></thead><tbody>");

            foreach (AssetPayload asset in assets)
            {
                sb.AppendLine("<tr>");
                AppendCell(sb, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
                AppendCell(sb, asset.user.name);
                AppendCell(sb, asset.user.department);
                AppendCell(sb, asset.user.employeeId);
                AppendCell(sb, asset.user.location);
                AppendCell(sb, asset.user.phone);
                AppendCell(sb, asset.user.note);
                AppendCell(sb, asset.system.computerCode);
                AppendCell(sb, asset.system.computerName);
                AppendCell(sb, (asset.system.osCaption + " " + asset.system.osVersion).Trim());
                AppendCell(sb, asset.system.installDate);
                AppendCell(sb, asset.baseBoard.manufacturer);
                AppendCell(sb, asset.baseBoard.product);
                AppendCell(sb, asset.baseBoard.serialNumber);
                AppendCell(sb, FormatNics(asset.networkAdapters));
                AppendCell(sb, FormatDisks(asset.disks));
                sb.AppendLine("</tr>");
            }

            string json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 * 16 }.Serialize(assets);
            sb.AppendLine("</tbody></table>");
            sb.Append("<script id=\"it-assets-json\" type=\"application/json\">")
                .Append(EscapeScriptJson(json))
                .AppendLine("</script>");
            sb.AppendLine("</body></html>");
            File.WriteAllText(filePath, sb.ToString(), new UTF8Encoding(true));
        }

        private static void AppendCell(StringBuilder sb, string value)
        {
            sb.Append("<td style=\"mso-number-format:'\\@'; white-space:pre-wrap\">")
                .Append(Escape(value))
                .AppendLine("</td>");
        }

        private static string FormatNics(IList<NetworkAdapterInfo> nics)
        {
            var lines = new List<string>();
            for (int i = 0; i < nics.Count; i++)
            {
                NetworkAdapterInfo nic = nics[i];
                lines.Add("网卡 " + (i + 1));
                lines.Add("名称: " + nic.name);
                lines.Add("MAC: " + nic.macAddress);
                lines.Add("IPv4: " + (nic.ipAddresses.Count == 0 ? "" : string.Join(", ", nic.ipAddresses.ToArray())));
            }
            return string.Join("\n", lines.ToArray());
        }

        private static string FormatDisks(IList<DiskInfo> disks)
        {
            var lines = new List<string>();
            for (int i = 0; i < disks.Count; i++)
            {
                DiskInfo disk = disks[i];
                lines.Add("硬盘 " + (i + 1));
                lines.Add("型号: " + disk.model);
                lines.Add("序列号: " + disk.serialNumber);
                lines.Add("容量: " + disk.sizeText);
            }
            return string.Join("\n", lines.ToArray());
        }

        private static string Escape(string value)
        {
            return (value ?? string.Empty)
                .Replace("&", "&amp;")
                .Replace("<", "&lt;")
                .Replace(">", "&gt;")
                .Replace("\"", "&quot;")
                .Replace("'", "&#39;");
        }

        private static string EscapeScriptJson(string value)
        {
            return (value ?? string.Empty)
                .Replace("</", "<\\/")
                .Replace("<", "\\u003c")
                .Replace(">", "\\u003e")
                .Replace("&", "\\u0026");
        }
    }
}
