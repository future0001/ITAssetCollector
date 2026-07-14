using System;
using System.Diagnostics;
using System.ServiceProcess;
using System.Threading;

namespace AssetCollector
{
    public class AgentService : ServiceBase
    {
        public const string ServiceNameValue = "ITAssetCollectorAgent";
        private Timer timer;
        private bool running;
        private string lastTaskId = string.Empty;

        public AgentService()
        {
            ServiceName = ServiceNameValue;
            CanStop = true;
            AutoLog = true;
        }

        protected override void OnStart(string[] args)
        {
            var settings = AgentSettings.Load();
            timer = new Timer(delegate { RunOnce(); }, null, TimeSpan.Zero, TimeSpan.FromSeconds(settings.pollSeconds));
        }

        protected override void OnStop()
        {
            if (timer != null)
            {
                timer.Dispose();
                timer = null;
            }
        }

        private void RunOnce()
        {
            if (running) return;
            running = true;
            try
            {
                var settings = AgentSettings.Load();
                settings.serverUrl = DiscoveryClient.DiscoverServerUrl(1000, settings.serverUrl);
                if (Program.TryStartAutoUpdate(settings)) return;

                var request = ApiClient.GetCollectionRequest(settings.serverUrl, lastTaskId);
                if (request == null || string.IsNullOrWhiteSpace(request.id)) return;

                lastTaskId = request.id;
                AssetPayload payload = HardwareCollector.Collect();
                settings.ApplyTo(payload);
                if (request.reviewOnly)
                {
                    ApiClient.ReportCollection(settings.serverUrl, request.id, payload, "review", "pending review");
                }
                else
                {
                    ApiClient.Submit(settings.serverUrl, payload);
                    ApiClient.ReportCollection(settings.serverUrl, request.id, payload, "ok", "submitted");
                }
            }
            catch (Exception ex)
            {
                try
                {
                    var settings = AgentSettings.Load();
                    ApiClient.ReportCollection(settings.serverUrl, lastTaskId, null, "error", ex.Message);
                }
                catch
                {
                }
                try { EventLog.WriteEntry(ServiceNameValue, ex.ToString(), EventLogEntryType.Warning); }
                catch { }
            }
            finally
            {
                running = false;
            }
        }
    }
}
