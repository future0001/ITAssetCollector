const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const dgram = require('dgram');
const { execFile } = require('child_process');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DISCOVERY_PORT = Number(process.env.DISCOVERY_PORT || 33030);
const SERVER_KEY = text(process.env.ASSET_SERVER_KEY || process.env.SERVER_KEY || '');
const UPDATE_SIGNING_PRIVATE_KEY = text(process.env.ASSET_UPDATE_SIGNING_PRIVATE_KEY || '');
const DISCOVERY_MAGIC = 'IT_ASSET_COLLECTOR_DISCOVER_V1';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'assets.json');
const ORG_FILE = path.join(DATA_DIR, 'org.json');
const CATEGORY_FILE = path.join(DATA_DIR, 'categories.json');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const COLLECTION_FILE = path.join(DATA_DIR, 'collection-requests.json');
const SECURITY_FILE = path.join(DATA_DIR, 'security.json');
const CLIENT_UPDATE_FILE = path.join(DATA_DIR, 'client-update.json');
const CLIENT_UPDATE_XP_FILE = path.join(DATA_DIR, 'client-update-xp.json');
const CLIENT_UPDATE_DIR = path.join(ROOT, 'client-updates');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const BACKUP_KEEP = Number(process.env.ASSET_BACKUP_KEEP || 50);
const MAX_REACHABILITY_IPS = Number(process.env.ASSET_REACHABILITY_MAX_IPS || 128);
const REACHABILITY_TIMEOUT_MS = Number(process.env.ASSET_REACHABILITY_TIMEOUT_MS || 1200);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.exe': 'application/octet-stream',
  '.config': 'application/xml; charset=utf-8'
};

const ABNORMAL_DISK_SOURCES = [
  { id: 'usb-device', label: 'USB Device', hints: ['usb device'] },
  { id: 'flash-disk', label: 'Flash Disk', hints: ['generic flash disk', 'flash disk', 'usb flash'] },
  { id: 'mass-storage', label: 'Mass Storage', hints: ['mass storage', 'usb mass storage'] },
  { id: 'removable', label: 'Removable', hints: ['removable'] },
  { id: 'u-disk', label: 'U Disk', hints: ['u disk', 'udisk'] }
];

const BOARD_BRAND_NAMES = [
  { name: '\u534e\u7855', hints: ['asus', 'asustek'] },
  { name: '\u6280\u5609', hints: ['gigabyte'] },
  { name: '\u5fae\u661f', hints: ['micro-star', 'micro star', 'msi'] },
  { name: '\u534e\u64ce', hints: ['asrock'] },
  { name: '\u8054\u60f3', hints: ['lenovo'] },
  { name: '\u6234\u5c14', hints: ['dell'] },
  { name: '\u60e0\u666e', hints: ['hewlett-packard', 'hewlett packard', 'hp'] },
  { name: '\u82f1\u7279\u5c14', hints: ['intel'] },
  { name: '\u8d85\u5fae', hints: ['supermicro', 'super micro'] },
  { name: '\u4e03\u5f69\u8679', hints: ['colorful'] },
  { name: '\u6620\u6cf0', hints: ['biostar'] },
  { name: '\u6602\u8fbe', hints: ['onda'] },
  { name: '\u6885\u6377', hints: ['soyo'] },
  { name: '\u94ed\u7444', hints: ['maxsun'] },
  { name: '\u5bcc\u58eb\u5eb7', hints: ['foxconn'] },
  { name: '\u7cbe\u82f1', hints: ['ecs', 'elitegroup'] }
];

const MISSING_FIELD_FILTERS = {
  computerName: { path: ['system', 'computerName'] },
  computerCode: { path: ['system', 'computerCode'] },
  userName: { path: ['user', 'name'] },
  department: { path: ['user', 'department'] },
  location: { path: ['user', 'location'] },
  ipAddress: { isMissing: asset => assetIpv4List(asset).length === 0 },
  macAddress: { isMissing: asset => !((asset.networkAdapters || []).some(nic => text(nic.macAddress))) },
  boardManufacturer: { path: ['baseBoard', 'manufacturer'] },
  boardProduct: { path: ['baseBoard', 'product'] },
  boardSerial: { path: ['baseBoard', 'serialNumber'] },
  diskSerial: { isMissing: asset => !((asset.disks || []).some(disk => text(disk.serialNumber))) },
  osCaption: { path: ['system', 'osCaption'] }
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readAssets() {
  ensureDataFile();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!Array.isArray(data)) return [];
    const deduped = dedupeAssets(data);
    return deduped;
  } catch (err) {
    const recovered = readLatestAssetsBackup();
    if (recovered) return recovered;
    throw new Error('Asset data file is not readable: ' + (err && err.message ? err.message : String(err)));
  }
}

function readAssetsForWrite() {
  const items = readAssets();
  if (!Array.isArray(items)) throw new Error('Asset data file is not available for writing');
  return items;
}

function readLatestAssetsBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return null;
    const names = fs.readdirSync(BACKUP_DIR)
      .filter(name => /^assets-\d{8}T\d{6}Z-[a-z0-9-]+(?:-\d+)?\.json$/i.test(name))
      .sort()
      .reverse();
    for (const name of names) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, name), 'utf8'));
        if (Array.isArray(data) && data.length > 0) return data;
      } catch {
      }
    }
  } catch {
  }
  return null;
}

function readCollectionRequests() {
  ensureDataFile();
  try {
    const data = JSON.parse(fs.readFileSync(COLLECTION_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeCollectionRequests(items) {
  ensureDataFile();
  const kept = (Array.isArray(items) ? items : [])
    .slice(-50)
    .map(item => Object.assign({}, item, { reports: item && item.reports && typeof item.reports === 'object' ? item.reports : {} }));
  const tmp = COLLECTION_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(kept, null, 2), 'utf8');
  fs.renameSync(tmp, COLLECTION_FILE);
}

function readClientHeartbeats() {
  ensureDataFile();
  try {
    if (!fs.existsSync(CLIENTS_FILE)) return {};
    const data = JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeClientHeartbeats(items) {
  ensureDataFile();
  const tmp = CLIENTS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items || {}, null, 2), 'utf8');
  fs.renameSync(tmp, CLIENTS_FILE);
}

function requestIp(req) {
  const forwarded = text(req && req.headers && req.headers['x-forwarded-for']).split(',')[0].trim();
  const raw = forwarded || text(req && req.socket && req.socket.remoteAddress);
  return raw.replace(/^::ffff:/, '');
}

function recordClientHeartbeat(input) {
  const computerName = text(input && input.computerName)
    || text(input && input.payload && input.payload.system && input.payload.system.computerName);
  if (!computerName) return null;

  const key = computerKey(computerName);
  const items = readClientHeartbeats();
  const existing = items[key] || {};
  const payload = input && input.payload ? input.payload : {};
  const user = payload.user || {};
  const system = payload.system || {};
  const heartbeat = {
    computerName,
    firstSeenAt: existing.firstSeenAt || new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    lastIp: text(input && input.ip) || existing.lastIp || '',
    lastTaskId: text(input && input.taskId) || existing.lastTaskId || '',
    lastStatus: text(input && input.status) || existing.lastStatus || 'poll',
    clientVersion: text(input && input.version) || existing.clientVersion || '',
    userName: text(user.name) || existing.userName || '',
    department: text(user.department) || existing.department || '',
    osCaption: text(system.osCaption) || existing.osCaption || '',
    osVersion: text(system.osVersion) || existing.osVersion || ''
  };
  items[key] = heartbeat;
  writeClientHeartbeats(items);
  return heartbeat;
}

function clientInstallationStatus() {
  const assets = sortAssetsByDepartment(readAssets());
  const heartbeats = readClientHeartbeats();
  const seenAssetKeys = new Set();
  const seenHeartbeatKeys = new Set();
  const now = Date.now();
  const onlineWindowMs = 5 * 60 * 1000;
  const unmatchedHeartbeatWindowMs = Number(process.env.ASSET_UNMATCHED_HEARTBEAT_WINDOW_MS || 24 * 60 * 60 * 1000);

  const computers = assets.map(asset => {
    const computerName = text(asset && asset.system && asset.system.computerName);
    const aliases = assetClientKeys(asset);
    aliases.forEach(key => seenAssetKeys.add(key));
    const heartbeatEntry = latestHeartbeatForKeys(heartbeats, aliases);
    const heartbeat = heartbeatEntry && heartbeatEntry.heartbeat;
    if (heartbeatEntry && heartbeatEntry.key) seenHeartbeatKeys.add(heartbeatEntry.key);
    const lastSeenMs = heartbeat ? Date.parse(heartbeat.lastSeenAt || '') : NaN;
    const installed = Boolean(heartbeat);
    const online = installed && !Number.isNaN(lastSeenMs) && now - lastSeenMs <= onlineWindowMs;
    return {
      id: asset.id,
      computerName,
      computerCode: text(asset && asset.system && asset.system.computerCode),
      userName: text(asset && asset.user && asset.user.name),
      department: assetDepartment(asset),
      installed,
      online,
      firstSeenAt: installed ? text(heartbeat.firstSeenAt) : '',
      lastSeenAt: installed ? text(heartbeat.lastSeenAt) : '',
      lastIp: installed ? text(heartbeat.lastIp) : '',
      lastStatus: installed ? text(heartbeat.lastStatus) : '',
      clientVersion: installed ? text(heartbeat.clientVersion) : ''
    };
  });

  for (const [key, heartbeat] of Object.entries(heartbeats)) {
    if (seenAssetKeys.has(key) || seenHeartbeatKeys.has(key)) continue;
    const lastSeenMs = Date.parse(heartbeat.lastSeenAt || '');
    const staleHeartbeat = Number.isNaN(lastSeenMs) || now - lastSeenMs > unmatchedHeartbeatWindowMs;
    computers.push({
      id: '',
      computerName: text(heartbeat.computerName),
      computerCode: '',
      userName: text(heartbeat.userName),
      department: text(heartbeat.department),
      installed: true,
      online: !Number.isNaN(lastSeenMs) && now - lastSeenMs <= onlineWindowMs,
      firstSeenAt: text(heartbeat.firstSeenAt),
      lastSeenAt: text(heartbeat.lastSeenAt),
      lastIp: text(heartbeat.lastIp),
      lastStatus: text(heartbeat.lastStatus),
      clientVersion: text(heartbeat.clientVersion),
      assetMissing: true,
      staleHeartbeat
    });
  }

  computers.sort((a, b) => compareAssetText(a.department, b.department)
    || compareAssetText(a.computerName, b.computerName));

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    onlineWindowSeconds: onlineWindowMs / 1000,
    summary: {
      totalAssets: assets.length,
      installed: computers.filter(item => item.installed && !item.assetMissing).length,
      online: computers.filter(item => item.installed && item.online && !item.assetMissing).length,
      notDetected: computers.filter(item => !item.installed).length,
      extraInstalled: computers.filter(item => item.assetMissing && !item.staleHeartbeat).length,
      staleUnmatched: computers.filter(item => item.assetMissing && item.staleHeartbeat).length
    },
    computers
  };
}

function assetClientKeys(asset) {
  const values = [
    asset && asset.system && asset.system.computerName,
    asset && asset.system && asset.system.computerCode
  ];
  const keys = values.map(computerKey).filter(Boolean);
  return Array.from(new Set(keys));
}

function latestHeartbeatForKeys(heartbeats, keys) {
  return keys.reduce((best, key) => {
    const heartbeat = heartbeats[key];
    if (!heartbeat) return best;
    if (!best) return { key, heartbeat };
    return Date.parse(heartbeat.lastSeenAt || '') > Date.parse(best.heartbeat.lastSeenAt || '') ? { key, heartbeat } : best;
  }, null);
}

function readClientUpdateManifest(flavor) {
  ensureDataFile();
  try {
    const manifestFile = text(flavor).toLowerCase() === 'xp' ? CLIENT_UPDATE_XP_FILE : CLIENT_UPDATE_FILE;
    if (!fs.existsSync(manifestFile)) return null;
    const data = JSON.parse(fs.readFileSync(manifestFile, 'utf8').replace(/^\uFEFF/, ''));
    const version = text(data && data.version);
    const fileName = path.basename(text(data && (data.fileName || data.exeFile || data.packageFile)));
    if (!version || !fileName) return null;

    const filePath = path.join(CLIENT_UPDATE_DIR, fileName);
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    const configName = path.basename(text(data && data.configFile));
    const configPath = configName ? path.join(CLIENT_UPDATE_DIR, configName) : '';

    return {
      version,
      fileName,
      sha256: text(data && data.sha256) || sha256File(filePath),
      signature: text(data && data.signature),
      size: stat.size,
      notes: text(data && data.notes),
      publishedAt: text(data && data.publishedAt),
      configFile: configName && fs.existsSync(configPath) ? configName : ''
    };
  } catch {
    return null;
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function clientUpdateResponse(currentVersion, flavor) {
  const manifest = readClientUpdateManifest(flavor);
  if (!manifest) return { ok: true, updateAvailable: false };
  const available = compareVersions(manifest.version, currentVersion) > 0;
  return Object.assign({ ok: true, updateAvailable: available }, manifest, available ? {
    exeUrl: `/client-updates/${encodeURIComponent(manifest.fileName)}`,
    configUrl: manifest.configFile ? `/client-updates/${encodeURIComponent(manifest.configFile)}` : ''
  } : {});
}

function clientVersionsStatus() {
  const win = readClientUpdateManifest('win');
  const xp = readClientUpdateManifest('xp');
  return {
    ok: true,
    channels: {
      win: clientVersionStatusItem(win),
      xp: clientVersionStatusItem(xp)
    }
  };
}

function clientVersionStatusItem(manifest) {
  if (!manifest) return { exists: false };
  return Object.assign({ exists: true }, manifest, {
    exeUrl: `/client-updates/${encodeURIComponent(manifest.fileName)}`,
    configUrl: manifest.configFile ? `/client-updates/${encodeURIComponent(manifest.configFile)}` : ''
  });
}

function publishClientVersion(input) {
  const flavor = text(input && input.flavor).toLowerCase() === 'xp' ? 'xp' : 'win';
  const version = text(input && input.version);
  const exe = input && input.exe;
  const config = input && input.config;
  if (!version) throw new Error('version is required');
  if (!exe || !text(exe.contentBase64)) throw new Error('exe file is required');

  fs.mkdirSync(CLIENT_UPDATE_DIR, { recursive: true });
  const prefix = flavor === 'xp' ? 'it-asset-client-xp-' : 'it-asset-client-';
  const exeName = `${prefix}${safeVersionFilePart(version)}.exe`;
  const exePath = path.join(CLIENT_UPDATE_DIR, exeName);
  fs.writeFileSync(exePath, Buffer.from(text(exe.contentBase64), 'base64'));

  let configName = '';
  if (config && text(config.contentBase64)) {
    configName = `${exeName}.config`;
    fs.writeFileSync(path.join(CLIENT_UPDATE_DIR, configName), Buffer.from(text(config.contentBase64), 'base64'));
  }

  const manifest = {
    version,
    fileName: exeName,
    configFile: configName,
    sha256: sha256File(exePath),
    publishedAt: new Date().toISOString(),
    notes: text(input && input.notes)
  };
  manifest.signature = signUpdateManifest(manifest) || text(input && input.signature);
  writeClientUpdateManifest(flavor, manifest);
  return { ok: true, channel: flavor, manifest: clientVersionStatusItem(readClientUpdateManifest(flavor)) };
}

function updateSignaturePayload(manifest) {
  return [
    text(manifest && manifest.version),
    text(manifest && manifest.fileName),
    text(manifest && manifest.sha256).toLowerCase()
  ].join('\n');
}

function signUpdateManifest(manifest) {
  const privateKey = normalizePrivateKey(UPDATE_SIGNING_PRIVATE_KEY);
  if (!privateKey) return '';
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(updateSignaturePayload(manifest), 'utf8');
  signer.end();
  return signer.sign(privateKey, 'base64');
}

function normalizePrivateKey(value) {
  const key = text(value).replace(/\\n/g, '\n');
  if (!key) return '';
  if (key.includes('BEGIN')) return key;
  try {
    const decoded = Buffer.from(key, 'base64').toString('utf8').trim();
    return decoded.includes('BEGIN') ? decoded : key;
  } catch {
    return key;
  }
}

function writeClientUpdateManifest(flavor, manifest) {
  ensureDataFile();
  const file = flavor === 'xp' ? CLIENT_UPDATE_XP_FILE : CLIENT_UPDATE_FILE;
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), 'utf8');
}

function safeVersionFilePart(value) {
  return text(value).replace(/[^0-9A-Za-z._-]+/g, '-').replace(/^-+|-+$/g, '') || 'latest';
}

function compareVersions(left, right) {
  const a = text(left).split(/[^\d]+/).filter(Boolean).map(Number);
  const b = text(right).split(/[^\d]+/).filter(Boolean).map(Number);
  const length = Math.max(a.length, b.length, 1);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

function createCollectionRequest(options) {
  const opts = options || {};
  const targets = normalizeTargetComputerNames(opts.targets || opts.computerNames);
  const requests = readCollectionRequests();
  const request = {
    id: 'collect-' + new Date().toISOString().replace(/[-:.TZ]/g, '') + '-' + crypto.randomBytes(4).toString('hex'),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    reviewOnly: Boolean(opts.reviewOnly),
    targets,
    reports: {}
  };
  requests.push(request);
  writeCollectionRequests(requests);
  return request;
}

function normalizeTargetComputerNames(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map(text)
    .filter(value => {
      const key = computerKey(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function collectionRequestMatchesComputer(item, computerName) {
  const targets = normalizeTargetComputerNames(item && item.targets);
  if (targets.length === 0) return true;
  const key = computerKey(computerName);
  return Boolean(key && targets.map(computerKey).includes(key));
}

function collectionRequestHasReport(item, computerName) {
  const key = computerKey(computerName);
  return Boolean(key && item && item.reports && Object.prototype.hasOwnProperty.call(item.reports, key));
}

function latestActiveCollectionRequest(lastTaskId, computerName) {
  const now = Date.now();
  const requests = readCollectionRequests()
    .filter(item => item && item.id && Date.parse(item.expiresAt || item.createdAt) >= now)
    .filter(item => collectionRequestMatchesComputer(item, computerName))
    .filter(item => !collectionRequestHasReport(item, computerName))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const latest = requests[0];
  if (!latest || latest.id === text(lastTaskId)) return null;
  return latest;
}

function collectionRequestSummary(item) {
  const reports = item && item.reports && typeof item.reports === 'object' ? Object.keys(item.reports).map(key => item.reports[key]) : [];
  return {
    id: item.id,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    reviewOnly: Boolean(item.reviewOnly),
    targets: normalizeTargetComputerNames(item.targets),
    reportCount: reports.length,
    successCount: reports.filter(report => report && report.status === 'ok').length,
    errorCount: reports.filter(report => report && report.status === 'error').length,
    pendingReviewCount: reports.filter(report => report && report.pendingReview).length,
    pendingConfirmationCount: reports.filter(report => report && report.pendingConfirmation).length,
    noDifferenceCount: reports.filter(report => report && report.status === 'no-difference').length,
    reports
  };
}

function saveCollectionReport(input) {
  const taskId = text(input && input.taskId);
  const computerName = text(input && input.computerName) || text(input && input.payload && input.payload.system && input.payload.system.computerName) || 'unknown';
  recordClientHeartbeat(input);
  const requests = readCollectionRequests();
  let request = requests.find(item => item && item.id === taskId);
  if (!request) {
    request = { id: taskId || 'manual', createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), reports: {} };
    requests.push(request);
  }
  request.reports = request.reports || {};
  const report = {
    computerName,
    status: text(input && input.status) || 'ok',
    message: text(input && input.message),
    reportedAt: new Date().toISOString()
  };

  if (request.reviewOnly && input && input.payload) {
    const incoming = normalizeAsset(input.payload);
    const existing = findExistingAssetForPayload(readAssets(), incoming);
    const reportKey = computerKey(computerName);
    report.status = 'review';
    report.payload = assetSummary(incoming);
    report.existingAssetId = existing ? existing.id : '';
    report.diff = existing ? assetDiff(existing, incoming) : assetDiff(null, incoming);
    report.reviewKey = reviewDiffKey(existing, computerName, report.diff);
    report.hasDiff = report.diff.length > 0;
    report.pendingReview = report.hasDiff;
    report.pendingConfirmation = !report.hasDiff;
    report.message = report.hasDiff ? 'pending review' : 'no difference';
    const duplicate = (report.pendingReview || report.pendingConfirmation) ? findPendingReviewRequest(requests, reportKey, report.reviewKey, request.id) : null;
    if (duplicate) {
      duplicate.request.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      duplicate.report.reportedAt = report.reportedAt;
      duplicate.report.payload = report.payload;
      duplicate.report.existingAssetId = report.existingAssetId;
      duplicate.report.diff = report.diff;
      duplicate.report.reviewKey = report.reviewKey;
      duplicate.report.hasDiff = report.hasDiff;
      duplicate.report.pendingReview = report.pendingReview;
      duplicate.report.pendingConfirmation = report.pendingConfirmation;
      duplicate.report.status = report.hasDiff ? 'review' : 'no-difference';
      duplicate.report.message = report.hasDiff ? 'pending review' : 'no difference';
      report.status = 'duplicate-review';
      report.pendingReview = false;
      report.pendingConfirmation = false;
      report.message = 'duplicate pending review';
      report.reviewedAt = new Date().toISOString();
    }
    if (!report.hasDiff)
    {
      report.status = 'no-difference';
    }
  }

  request.reports[computerKey(computerName)] = report;
  writeCollectionRequests(requests);
  return collectionRequestSummary(request);
}

function createAssetSubmitReview(existing, incoming, source) {
  const diff = assetDiff(existing, incoming);
  const reportComputerName = text(incoming && incoming.system && incoming.system.computerName) || text(existing && existing.system && existing.system.computerName);
  const reportKey = computerKey(reportComputerName);
  const reviewKey = reviewDiffKey(existing, reportComputerName, diff);
  const requests = readCollectionRequests();
  const existingRequest = findPendingReviewRequest(requests, reportKey, reviewKey);
  if (existingRequest) {
    existingRequest.request.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    existingRequest.request.source = text(source) || existingRequest.request.source || 'asset-submit';
    existingRequest.report.reportedAt = new Date().toISOString();
    existingRequest.report.payload = assetSummary(incoming);
    existingRequest.report.existingAssetId = existing ? existing.id : '';
    existingRequest.report.diff = diff;
    existingRequest.report.reviewKey = reviewKey;
    existingRequest.report.hasDiff = diff.length > 0;
    existingRequest.report.pendingReview = diff.length > 0;
    existingRequest.report.status = diff.length > 0 ? 'review' : 'no-difference';
    existingRequest.report.message = diff.length > 0 ? 'pending review' : 'no difference';
    writeCollectionRequests(requests);
    return collectionRequestSummary(existingRequest.request);
  }

  const request = {
    id: 'asset-review-' + new Date().toISOString().replace(/[-:.TZ]/g, '') + '-' + crypto.randomBytes(4).toString('hex'),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    reviewOnly: true,
    source: text(source) || 'asset-submit',
    targets: [text(incoming && incoming.system && incoming.system.computerName)].filter(Boolean),
    reports: {}
  };
  const report = {
    computerName: reportComputerName,
    status: diff.length > 0 ? 'review' : 'no-difference',
    message: diff.length > 0 ? 'pending review' : 'no difference',
    reportedAt: new Date().toISOString(),
    payload: assetSummary(incoming),
    existingAssetId: existing ? existing.id : '',
    diff,
    reviewKey,
    hasDiff: diff.length > 0,
    pendingReview: diff.length > 0
  };
  if (!report.pendingReview) report.reviewedAt = new Date().toISOString();
  request.reports[reportKey] = report;

  requests.push(request);
  writeCollectionRequests(requests);
  return collectionRequestSummary(request);
}

function findPendingReviewRequest(requests, reportKey, reviewKey, excludeRequestId) {
  if (!reportKey || !reviewKey) return null;
  for (let i = requests.length - 1; i >= 0; i--) {
    const request = requests[i];
    if (excludeRequestId && request && request.id === excludeRequestId) continue;
    const reports = request && request.reports;
    if (!reports || typeof reports !== 'object') continue;
    const report = reports[reportKey];
    if (!report || (!report.pendingReview && !report.pendingConfirmation)) continue;
    const currentKey = report.reviewKey || reviewDiffKey({ id: report.existingAssetId }, report.computerName, report.diff || []);
    if (currentKey === reviewKey) return { request, report };
  }
  return null;
}

function writeAssets(items) {
  ensureDataFile();
  backupCurrentData('auto');
  const uniqueItems = sortAssetsByDepartment(dedupeAssets(items));
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(uniqueItems, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function readOrganization() {
  ensureDataFile();
  try {
    if (!fs.existsSync(ORG_FILE)) return buildOrganizationFromAssets(readAssets());
    const data = JSON.parse(fs.readFileSync(ORG_FILE, 'utf8'));
    const units = normalizeOrgUnits(data && data.units);
    return { version: 2, updatedAt: text(data && data.updatedAt), units };
  } catch {
    return buildOrganizationFromAssets(readAssets());
  }
}

function writeOrganization(input) {
  ensureDataFile();
  const payload = {
    version: 2,
    updatedAt: new Date().toISOString(),
    units: normalizeOrgUnits(input && input.units)
  };
  const tmp = ORG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, ORG_FILE);
  return payload;
}

function readCategories() {
  ensureDataFile();
  try {
    if (!fs.existsSync(CATEGORY_FILE)) return buildCategoriesFromAssets(readAssets());
    const data = JSON.parse(fs.readFileSync(CATEGORY_FILE, 'utf8'));
    return normalizeCategories(data && data.categories);
  } catch {
    return buildCategoriesFromAssets(readAssets());
  }
}

function writeCategories(input) {
  ensureDataFile();
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    categories: normalizeCategories(input && input.categories)
  };
  const tmp = CATEGORY_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, CATEGORY_FILE);
  return payload.categories;
}

function readSecuritySettings() {
  ensureDataFile();
  try {
    if (!fs.existsSync(SECURITY_FILE)) return {};
    const data = JSON.parse(fs.readFileSync(SECURITY_FILE, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeSecuritySettings(settings) {
  ensureDataFile();
  const payload = Object.assign({}, settings || {}, { updatedAt: new Date().toISOString() });
  const tmp = SECURITY_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, SECURITY_FILE);
  return payload;
}

function hashClientDangerKey(key, salt) {
  return crypto
    .createHash('sha256')
    .update(`${salt || ''}:${text(key)}`, 'utf8')
    .digest('hex');
}

function setClientDangerKey(key) {
  const value = text(key);
  if (!value) throw new Error('Key is required');
  const salt = crypto.randomBytes(16).toString('hex');
  const settings = readSecuritySettings();
  settings.clientDangerKey = {
    salt,
    hash: hashClientDangerKey(value, salt),
    updatedAt: new Date().toISOString()
  };
  writeSecuritySettings(settings);
  return clientDangerKeyStatus();
}

function clientDangerKeyStatus() {
  const item = readSecuritySettings().clientDangerKey || {};
  return {
    configured: Boolean(item.salt && item.hash),
    updatedAt: text(item.updatedAt)
  };
}

function verifyClientDangerKey(key) {
  const item = readSecuritySettings().clientDangerKey || {};
  if (!item.salt || !item.hash) return false;
  const expected = Buffer.from(text(item.hash), 'utf8');
  const actual = Buffer.from(hashClientDangerKey(key, item.salt), 'utf8');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function normalizeCategories(categories) {
  const seen = new Set();
  return (Array.isArray(categories) ? categories : [])
    .map(text)
    .filter(name => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b));
}

function assetCategory(asset) {
  return text(asset && asset.metadata && asset.metadata.category)
    || text(asset && asset.user && asset.user.department);
}

function buildCategoriesFromAssets(items) {
  return normalizeCategories((items || []).map(assetCategory));
}

function normalizeOrgUnits(units) {
  const seen = new Set();

  function normalizeList(list, parentPath) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const name = text(item.name);
        if (!name) return null;
        const code = text(item.code);
        const type = normalizeOrgType(item.type);
        const manager = text(item.manager);
        const pathValue = parentPath ? `${parentPath}/${name}` : name;
        const fallbackId = 'org-' + hashText(`${pathValue}|${code}|${index}`).slice(0, 16);
        let id = text(item.id) || fallbackId;
        while (seen.has(id.toLowerCase())) id = `${fallbackId}-${seen.size}`;
        seen.add(id.toLowerCase());
        return {
          id,
          type,
          code,
          name,
          manager,
          employees: normalizeOrgEmployees(item.employees, pathValue),
          children: normalizeList(item.children, pathValue)
        };
      })
      .filter(Boolean);
  }

  return normalizeList(units, '');
}

function normalizeOrgEmployees(employees, parentPath) {
  const seen = new Set();
  return (Array.isArray(employees) ? employees : [])
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const name = text(item.name);
      const employeeId = text(item.employeeId || item.id);
      if (!name && !employeeId) return null;
      const fallbackId = 'emp-' + hashText(`${parentPath}|${name}|${employeeId}|${index}`).slice(0, 16);
      let id = text(item.id) || fallbackId;
      while (seen.has(id.toLowerCase())) id = `${fallbackId}-${seen.size}`;
      seen.add(id.toLowerCase());
      return {
        id,
        name,
        employeeId,
        title: text(item.title),
        phone: text(item.phone)
      };
    })
    .filter(Boolean);
}

function normalizeOrgType(value) {
  const raw = text(value).toLowerCase();
  if (['company', 'business-unit', 'division', 'department', 'team'].includes(raw)) return raw;
  if (['公司', '集团', '总公司'].includes(raw)) return 'company';
  if (['事业部', '业务单元'].includes(raw)) return 'business-unit';
  if (['中心', '分部'].includes(raw)) return 'division';
  if (['部门', '部'].includes(raw)) return 'department';
  if (['小组', '组', '班组'].includes(raw)) return 'team';
  return 'department';
}

function buildOrganizationFromAssets(items) {
  const names = Array.from(new Set((items || [])
    .map(asset => text(asset && asset.user && asset.user.department))
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));

  return {
    version: 2,
    updatedAt: '',
    units: names.map(name => ({
      id: 'org-' + hashText(name).slice(0, 16),
      type: 'department',
      code: '',
      name,
      manager: '',
      employees: buildOrgEmployeesFromAssets(name, items),
      children: []
    }))
  };
}

function buildOrgEmployeesFromAssets(department, items) {
  const seen = new Set();
  return (items || [])
    .filter(asset => text(asset && asset.user && asset.user.department).toLowerCase() === text(department).toLowerCase())
    .map(asset => {
      const user = asset.user || {};
      const name = text(user.name);
      const employeeId = text(user.employeeId);
      const key = `${name.toLowerCase()}|${employeeId.toLowerCase()}`;
      if ((!name && !employeeId) || seen.has(key)) return null;
      seen.add(key);
      return {
        id: 'emp-' + hashText(`${department}|${key}`).slice(0, 16),
        name,
        employeeId,
        title: '',
        phone: text(user.phone)
      };
    })
    .filter(Boolean);
}

function organizationEmployeeKey(employee) {
  const employeeId = text(employee && employee.employeeId).toLowerCase();
  const name = text(employee && employee.name).toLowerCase();
  if (employeeId) return `id:${employeeId}`;
  if (name) return `name:${name}`;
  return '';
}

function organizationEmployeeCount(unit) {
  const employees = new Set();
  (function collect(item) {
    (item && item.employees || []).forEach(employee => {
      const key = organizationEmployeeKey(employee);
      if (key) employees.add(key);
    });
    (item && item.children || []).forEach(collect);
  })(unit);
  return employees.size;
}

function organizationTotalEmployeeCount(units) {
  return organizationEmployeeCount({ children: units || [] });
}

function backupCurrentData(reason) {
  ensureDataFile();
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const current = fs.readFileSync(DATA_FILE, 'utf8');
    if (!current.trim()) return '';

    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const safeReason = text(reason || 'manual').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
    let backupPath = path.join(BACKUP_DIR, `assets-${timestamp}-${safeReason}.json`);
    for (let i = 1; fs.existsSync(backupPath); i++) {
      backupPath = path.join(BACKUP_DIR, `assets-${timestamp}-${safeReason}-${i}.json`);
    }
    fs.writeFileSync(backupPath, current, 'utf8');
    pruneBackups();
    return backupPath;
  } catch {
    return '';
  }
}

function pruneBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(name => /^assets-\d{8}T\d{6}Z-[a-z0-9-]+(?:-\d+)?\.json$/i.test(name))
      .sort()
      .reverse();
    const keep = Math.max(1, BACKUP_KEEP || 50);
    for (const name of files.slice(keep)) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, name)); }
      catch {}
    }
  } catch {
  }
}

function send(res, status, body, headers) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ''), 'utf8');
  res.writeHead(status, Object.assign({
    'Content-Length': payload.length,
    'Cache-Control': 'no-store'
  }, headers || {}));
  res.end(payload);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8' });
}

function authorized(req) {
  if (!SERVER_KEY) return true;

  const url = new URL(req.url, 'http://localhost');
  const provided = text(
    req.headers['x-asset-server-key']
      || bearerToken(req.headers.authorization)
      || url.searchParams.get('key')
  );
  if (!provided) return false;

  const expected = Buffer.from(SERVER_KEY, 'utf8');
  const actual = Buffer.from(provided, 'utf8');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function bearerToken(value) {
  const textValue = text(value);
  const match = /^Bearer\s+(.+)$/i.exec(textValue);
  return match ? match[1] : '';
}

function rejectUnauthorized(req, res) {
  if (req.url.startsWith('/api/')) return sendJson(res, 401, { error: 'Unauthorized' });
  return send(res, 401, 'Unauthorized', { 'Content-Type': 'text/plain; charset=utf-8' });
}

function requiresServerKey(req) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/export.xls') return true;
  if (req.method === 'POST' && url.pathname === '/api/assets') return false;
  if (req.method === 'GET' && url.pathname === '/api/ping') return false;
  if (req.method === 'GET' && url.pathname === '/api/org') return false;
  if (req.method === 'GET' && url.pathname === '/api/collect/request') return false;
  if (req.method === 'POST' && url.pathname === '/api/collect/report') return false;
  if (req.method === 'GET' && url.pathname === '/api/client/update') return false;
  if (req.method === 'POST' && url.pathname === '/api/client-danger-key/verify') return false;
  if (req.url.startsWith('/api/')) return true;
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const raw = await readBody(req);
  if (!text(raw)) return {};
  return parseJsonText(raw, 'Invalid JSON request body');
}

function parseJsonText(raw, message) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    const error = new Error(message || 'Invalid JSON');
    error.statusCode = 400;
    error.detail = err && err.message ? err.message : String(err);
    throw error;
  }
}

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeAsset(input, existing) {
  const now = new Date().toISOString();
  const user = input.user || {};
  const system = input.system || {};
  const metadata = input.metadata || {};
  const base = existing || {};
  const preserveUpdatedAt = Boolean(existing && existing === input && input.updatedAt);

  const asset = {
    id: base.id || input.id || '',
    createdAt: base.createdAt || input.createdAt || now,
    updatedAt: preserveUpdatedAt ? input.updatedAt : now,
    user: {
      name: text(user.name),
      department: text(user.department),
      employeeId: text(user.employeeId),
      location: text(user.location),
      phone: text(user.phone),
      note: text(user.note)
    },
    system: {
      computerCode: text(system.computerCode),
      computerName: text(system.computerName),
      osCaption: text(system.osCaption),
      osVersion: text(system.osVersion),
      installDate: text(system.installDate)
    },
    metadata: {
      category: text(metadata.category) || text(user.department),
      tags: normalizeTags(metadata.tags)
    },
    baseBoard: normalizeBaseBoard(input.baseBoard || {}),
    networkAdapters: Array.isArray(input.networkAdapters) ? input.networkAdapters.map(normalizeNic) : [],
    disks: Array.isArray(input.disks) ? input.disks.map(normalizeDisk) : [],
    raw: input.raw || null
  };
  asset.identityKey = buildIdentityKey(asset);
  if (!asset.id) asset.id = 'asset-' + hashText(asset.identityKey).slice(0, 24);
  return asset;
}

function mergeAssetInput(existing, patch, options) {
  return {
    id: existing.id,
    createdAt: existing.createdAt,
    user: Object.assign({}, existing.user || {}, patch.user || {}),
    system: Object.assign({}, existing.system || {}, patch.system || {}),
    metadata: mergeMetadata(existing.metadata || {}, patch.metadata || {}, options),
    baseBoard: Object.assign({}, existing.baseBoard || {}, patch.baseBoard || {}),
    networkAdapters: patch.networkAdapters || existing.networkAdapters || [],
    disks: patch.disks || existing.disks || [],
    raw: patch.raw || existing.raw || null
  };
}

function text(value) {
  return String(value == null ? '' : value).trim();
}

function computerKey(value) {
  return text(value).replace(/\s+/g, '').toLowerCase();
}

function normalizeTags(value) {
  const items = Array.isArray(value) ? value : text(value).split(/[,;，；\s]+/);
  const seen = new Set();
  const tags = [];
  for (const item of items) {
    const tag = text(item);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

function mergeMetadata(existing, patch, options) {
  const preserveEmpty = Boolean(options && options.preserveEmptyMetadata);
  const hasCategory = Object.prototype.hasOwnProperty.call(patch, 'category');
  const hasTags = Object.prototype.hasOwnProperty.call(patch, 'tags');
  const tags = normalizeTags(patch.tags);
  return {
    category: hasCategory && (!preserveEmpty || text(patch.category)) ? patch.category : existing.category,
    tags: hasTags && (!preserveEmpty || tags.length > 0) ? patch.tags : existing.tags
  };
}

function normalizeBaseBoard(board) {
  return {
    manufacturer: text(board.manufacturer),
    product: text(board.product),
    serialNumber: text(board.serialNumber)
  };
}

function normalizeNic(nic) {
  return {
    name: text(nic.name),
    macAddress: formatMacAddress(nic.macAddress),
    ipAddresses: Array.isArray(nic.ipAddresses) ? nic.ipAddresses.map(text).filter(Boolean) : []
  };
}

function formatMacAddress(value) {
  const raw = text(value).toLowerCase();
  const hex = raw.replace(/[^0-9a-f]/g, '');
  if (hex.length !== 12) return raw;
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

function normalizeDisk(disk) {
  return {
    model: text(disk.model),
    serialNumber: text(disk.serialNumber),
    sizeBytes: Number(disk.sizeBytes || 0),
    sizeText: text(disk.sizeText)
  };
}

function selectedAbnormalDiskSources(sourceIds) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) return ABNORMAL_DISK_SOURCES;
  const selected = new Set(sourceIds.map(text).filter(Boolean));
  return ABNORMAL_DISK_SOURCES.filter(source => selected.has(source.id));
}

function abnormalDiskSource(disk, sourceIds) {
  const model = text(disk && disk.model).toLowerCase();
  const serial = text(disk && disk.serialNumber).toLowerCase();
  const combined = `${model} ${serial}`;
  if (!combined.trim()) return null;

  return selectedAbnormalDiskSources(sourceIds)
    .find(source => source.hints.some(hint => combined.includes(hint))) || null;
}

function isAbnormalDisk(disk, sourceIds) {
  return Boolean(abnormalDiskSource(disk, sourceIds));
}

function cleanupAbnormalDevices(sourceIds) {
  const items = readAssetsForWrite();
  const selectedSources = selectedAbnormalDiskSources(sourceIds);
  const selectedIds = selectedSources.map(source => source.id);
  let recordsUpdated = 0;
  let disksRemoved = 0;
  const removedBySource = Object.fromEntries(selectedSources.map(source => [source.id, 0]));

  for (let i = 0; i < items.length; i++) {
    const disks = Array.isArray(items[i].disks) ? items[i].disks : [];
    const keptDisks = [];

    for (const disk of disks) {
      const source = abnormalDiskSource(disk, selectedIds);
      if (!source) {
        keptDisks.push(disk);
        continue;
      }

      disksRemoved++;
      removedBySource[source.id] = (removedBySource[source.id] || 0) + 1;
    }

    const removed = disks.length - keptDisks.length;
    if (removed <= 0) continue;

    items[i] = normalizeAsset(mergeAssetInput(items[i], { disks: keptDisks }), items[i]);
    recordsUpdated++;
  }

  if (disksRemoved > 0) writeAssets(items);
  return { ok: true, recordsUpdated, disksRemoved, sources: selectedIds, removedBySource };
}

function normalizedKey(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function usefulKey(value) {
  const key = normalizedKey(value);
  if (!key) return '';
  if (key === 'none' || key === 'unknown' || key === 'tobefilledbyoem' || key === 'defaultstring') return '';
  return key;
}

function keySet(values) {
  return new Set(values.map(usefulKey).filter(Boolean));
}

function intersects(left, right) {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function assetIdentity(asset) {
  return {
    computerCode: usefulKey(asset.system && asset.system.computerCode),
    computerName: usefulKey(asset.system && asset.system.computerName),
    boardSerial: usefulKey(asset.baseBoard && asset.baseBoard.serialNumber),
    diskSerials: keySet((asset.disks || []).map(d => d.serialNumber)),
    macAddresses: keySet((asset.networkAdapters || []).map(n => n.macAddress))
  };
}

function isDuplicateAsset(left, right) {
  const a = assetIdentity(left);
  const b = assetIdentity(right);

  if (a.computerCode && a.computerCode === b.computerCode) return true;
  if (a.boardSerial && a.boardSerial === b.boardSerial) return true;
  if (a.diskSerials.size && b.diskSerials.size && intersects(a.diskSerials, b.diskSerials)) return true;
  if (a.computerName && a.computerName === b.computerName && a.macAddresses.size && b.macAddresses.size && intersects(a.macAddresses, b.macAddresses)) return true;
  if (assetFingerprint(left) && assetFingerprint(left) === assetFingerprint(right)) return true;

  return false;
}

function sortedKeys(values) {
  return values.map(usefulKey).filter(Boolean).sort();
}

function assetFingerprint(asset) {
  const computerCode = usefulKey(asset.system && asset.system.computerCode);
  const computerName = usefulKey(asset.system && asset.system.computerName);
  const board = [
    usefulKey(asset.baseBoard && asset.baseBoard.manufacturer),
    usefulKey(asset.baseBoard && asset.baseBoard.product),
    usefulKey(asset.baseBoard && asset.baseBoard.serialNumber)
  ].join(':');
  const macs = sortedKeys((asset.networkAdapters || []).map(n => n.macAddress)).join(',');
  const disks = (asset.disks || []).map(d => [
    usefulKey(d.model),
    usefulKey(d.serialNumber),
    usefulKey(d.sizeText),
    usefulKey(d.sizeBytes)
  ].join(':')).filter(value => value.replace(/:/g, '')).sort().join(',');

  if (!computerCode && !computerName && !board.replace(/:/g, '') && !macs && !disks) return '';

  return [computerCode, computerName, board, macs, disks].join('|');
}

function hashText(value) {
  return crypto.createHash('sha1').update(value || '', 'utf8').digest('hex');
}

function buildIdentityKey(asset) {
  const id = assetIdentity(asset);
  if (id.computerCode) return 'code:' + id.computerCode;
  if (id.boardSerial) return 'board:' + id.boardSerial;
  if (id.diskSerials.size) return 'disk:' + Array.from(id.diskSerials).sort().join(',');
  if (id.computerName && id.macAddresses.size) return 'pcmac:' + id.computerName + ':' + Array.from(id.macAddresses).sort().join(',');

  const exact = {
    user: asset.user || {},
    system: asset.system || {},
    baseBoard: asset.baseBoard || {},
    networkAdapters: (asset.networkAdapters || []).map(n => ({
      name: usefulKey(n.name),
      macAddress: usefulKey(n.macAddress),
      ipAddresses: sortedKeys(n.ipAddresses || [])
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    disks: (asset.disks || []).map(d => ({
      model: usefulKey(d.model),
      serialNumber: usefulKey(d.serialNumber),
      sizeBytes: Number(d.sizeBytes || 0),
      sizeText: usefulKey(d.sizeText)
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  };
  return 'exact:' + hashText(JSON.stringify(exact));
}

function findDuplicateAssetIndexes(items, asset) {
  const indexes = [];
  items.forEach((item, index) => {
    const normalized = normalizeAsset(item, item);
    if ((normalized.identityKey && normalized.identityKey === asset.identityKey) || isDuplicateAsset(normalized, asset)) indexes.push(index);
  });
  return indexes;
}

function mergeTwoAssets(existing, incoming) {
  return normalizeAsset(mergeAssetInput(existing, incoming, { preserveEmptyMetadata: true }), existing);
}

function dedupeAssets(items) {
  const result = [];
  for (const item of items) {
    const asset = normalizeAsset(item, item);
    const index = findDuplicateAssetIndexes(result, asset)[0];
    if (index >= 0) {
      result[index] = mergeTwoAssets(result[index], asset);
    } else {
      result.push(asset);
    }
  }
  return result;
}

function serveStatic(req, res) {
  const urlPath = new URL(req.url, 'http://localhost').pathname;
  if (urlPath.startsWith('/client-updates/')) return serveClientUpdateFile(urlPath, res);
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!isPathInside(PUBLIC_DIR, filePath)) return send(res, 403, 'Forbidden');

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    send(res, 200, data, { 'Content-Type': type });
  });
}

function serveClientUpdateFile(urlPath, res) {
  const fileName = path.basename(decodeURIComponent(urlPath.slice('/client-updates/'.length)));
  if (!fileName) return send(res, 404, 'Not found');
  const filePath = path.normalize(path.join(CLIENT_UPDATE_DIR, fileName));
  if (!isPathInside(CLIENT_UPDATE_DIR, filePath)) return send(res, 403, 'Forbidden');

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    send(res, 200, data, {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
    });
  });
}

function assetSummary(asset) {
  return {
    id: asset.id,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    user: asset.user,
    system: asset.system,
    metadata: Object.assign({}, asset.metadata || {}, { category: assetCategory(asset) }),
    baseBoard: asset.baseBoard,
    networkAdapters: asset.networkAdapters,
    disks: asset.disks
  };
}

function findExistingAssetForPayload(items, incoming) {
  const normalized = normalizeAsset(incoming);
  const duplicateIndexes = findDuplicateAssetIndexes(items, normalized);
  if (duplicateIndexes.length > 0) return items[duplicateIndexes[0]];
  const computerName = computerKey(normalized.system && normalized.system.computerName);
  if (!computerName) return null;
  return items.find(item => computerKey(item && item.system && item.system.computerName) === computerName) || null;
}

function comparableAsset(asset) {
  if (!asset) return null;
  const normalized = normalizeAsset(asset, asset);
  return {
    user: normalized.user,
    system: normalized.system,
    baseBoard: normalized.baseBoard,
    networkAdapters: normalized.networkAdapters,
    disks: normalized.disks
  };
}

function assetDiff(existing, incoming) {
  const before = comparableAsset(existing);
  const after = comparableAsset(incoming);
  const fields = [
    ['user.name', '使用人'],
    ['user.department', '部门'],
    ['user.employeeId', '工号'],
    ['user.location', '位置'],
    ['user.phone', '电话'],
    ['user.note', '备注'],
    ['system.computerCode', '资产编号'],
    ['system.computerName', '计算机名'],
    ['system.osCaption', '系统'],
    ['system.osVersion', '系统版本'],
    ['system.installDate', '安装时间'],
    ['baseBoard.manufacturer', '主板厂商'],
    ['baseBoard.product', '主板型号'],
    ['baseBoard.serialNumber', '主板序列号'],
    ['networkAdapters', '网卡'],
    ['disks', '硬盘']
  ];

  return fields
    .map(([pathValue, label]) => {
      const oldValue = diffValue(readPath(before, pathValue));
      const newValue = diffValue(readPath(after, pathValue));
      return oldValue === newValue ? null : { field: pathValue, label, oldValue, newValue };
    })
    .filter(Boolean);
}

function reviewDiffKey(existing, computerName, diff) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      computer: computerKey(computerName),
      existingAssetId: text(existing && existing.id),
      diff: sortObjectKeys(diff || [])
    }), 'utf8')
    .digest('hex');
}

function readPath(value, pathValue) {
  return pathValue.split('.').reduce((current, key) => current == null ? undefined : current[key], value);
}

function diffValue(value) {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map(item => item && typeof item === 'object' ? sortObjectKeys(item) : item));
  }
  if (value && typeof value === 'object') return JSON.stringify(sortObjectKeys(value));
  return text(value);
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortObjectKeys(value[key]);
    return acc;
  }, {});
}

function applyCollectionReview(taskId, computerName) {
  const requests = readCollectionRequests();
  const request = requests.find(item => item && item.id === text(taskId));
  if (!request || !request.reports) return { ok: false, error: 'Review request not found' };
  const reportKey = computerKey(computerName);
  const report = request.reports[reportKey];
  if (!report || !report.pendingReview || !report.payload) return { ok: false, error: 'Pending review not found' };
  const reviewKey = report.reviewKey || reviewDiffKey({ id: report.existingAssetId }, report.computerName, report.diff || []);
  report.reviewKey = reviewKey;

  const items = readAssetsForWrite();
  const incoming = normalizeAsset(report.payload);
  const existing = report.existingAssetId
    ? items.find(item => item.id === report.existingAssetId)
    : findExistingAssetForPayload(items, incoming);
  if (existing) {
    const index = items.findIndex(item => item.id === existing.id);
    items[index] = normalizeAsset(mergeAssetInput(existing, incoming, { preserveEmptyMetadata: true }), existing);
  } else {
    items.unshift(incoming);
  }

  report.pendingReview = false;
  report.appliedAt = new Date().toISOString();
  report.message = 'applied';
  report.status = 'applied';
  closeMatchingPendingReviews(requests, reportKey, reviewKey, request.id, 'superseded');
  writeAssets(items);
  writeCollectionRequests(requests);
  return { ok: true, request: collectionRequestSummary(request), asset: assetSummary(existing || incoming) };
}

function discardCollectionReview(taskId, computerName) {
  const requests = readCollectionRequests();
  const request = requests.find(item => item && item.id === text(taskId));
  if (!request || !request.reports) return { ok: false, error: 'Review request not found' };
  const reportKey = computerKey(computerName);
  const report = request.reports[reportKey];
  if (!report || (!report.pendingReview && !report.pendingConfirmation)) return { ok: false, error: 'Pending review not found' };
  const reviewKey = report.reviewKey || reviewDiffKey({ id: report.existingAssetId }, report.computerName, report.diff || []);
  report.reviewKey = reviewKey;
  const wasConfirmation = Boolean(report.pendingConfirmation) && !report.pendingReview;

  report.pendingReview = false;
  report.pendingConfirmation = false;
  report.discardedAt = new Date().toISOString();
  report.message = wasConfirmation ? 'confirmed no difference' : 'discarded';
  report.status = wasConfirmation ? 'confirmed' : 'discarded';
  closeMatchingPendingReviews(requests, reportKey, reviewKey, request.id, wasConfirmation ? 'confirmed-duplicate' : 'discarded-duplicate');
  writeCollectionRequests(requests);
  return { ok: true, request: collectionRequestSummary(request) };
}

function closeMatchingPendingReviews(requests, reportKey, reviewKey, excludeRequestId, status) {
  if (!reportKey || !reviewKey) return;
  requests.forEach(request => {
    if (!request || request.id === excludeRequestId || !request.reports) return;
    const report = request.reports[reportKey];
    if (!report || (!report.pendingReview && !report.pendingConfirmation)) return;
    const currentKey = report.reviewKey || reviewDiffKey({ id: report.existingAssetId }, report.computerName, report.diff || []);
    if (currentKey !== reviewKey) return;
    report.pendingReview = false;
    report.pendingConfirmation = false;
    report.message = 'duplicate review closed';
    report.status = status || 'superseded';
    report.reviewedAt = new Date().toISOString();
  });
}

function assetDepartment(asset) {
  return text(asset && asset.user && asset.user.department);
}

function assetComputerName(asset) {
  const system = asset && asset.system ? asset.system : {};
  return text(system.computerCode) || text(system.computerName);
}

function compareAssetText(left, right) {
  const a = text(left).toLowerCase();
  const b = text(right).toLowerCase();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'zh-CN');
}

function compareAssetTimeDesc(left, right) {
  const a = Date.parse(left || '');
  const b = Date.parse(right || '');
  const aValid = !Number.isNaN(a);
  const bValid = !Number.isNaN(b);
  if (aValid && bValid && a !== b) return b - a;
  if (aValid && !bValid) return -1;
  if (!aValid && bValid) return 1;
  return 0;
}

function compareAssetsByDepartment(left, right) {
  return compareAssetText(assetDepartment(left), assetDepartment(right))
    || compareAssetText(assetCategory(left), assetCategory(right))
    || compareAssetTimeDesc(left.updatedAt || left.createdAt, right.updatedAt || right.createdAt)
    || compareAssetText(assetComputerName(left), assetComputerName(right));
}

function sortAssetsByDepartment(items) {
  return (items || []).slice().sort(compareAssetsByDepartment);
}

function missingFieldIds(url) {
  return url.searchParams.getAll('missing')
    .flatMap(value => text(value).split(','))
    .map(text)
    .filter(id => Object.prototype.hasOwnProperty.call(MISSING_FIELD_FILTERS, id));
}

function filterAssetsByMissingFields(items, fieldIds) {
  if (!fieldIds.length) return items;
  return items.filter(asset => fieldIds.every(fieldId => isAssetFieldMissing(asset, fieldId)));
}

function orgFilterName(url) {
  return text(url.searchParams.get('org') || url.searchParams.get('department'));
}

function filterAssetsByOrganization(items, orgName) {
  const selected = text(orgName);
  if (!selected) return items;
  const scope = organizationMatchScope(readOrganization().units, selected);
  if (scope.names.size === 0 && scope.employees.size === 0) scope.names.add(selected.toLowerCase());
  return items.filter(asset => {
    const user = asset && asset.user ? asset.user : {};
    return scope.names.has(text(user.department).toLowerCase())
      || scope.employees.has(text(user.name).toLowerCase())
      || scope.employees.has(text(user.employeeId).toLowerCase());
  });
}

function organizationNameSet(units, selectedName) {
  return organizationMatchScope(units, selectedName).names;
}

function organizationMatchScope(units, selectedName) {
  const selected = text(selectedName).toLowerCase();
  const names = new Set();
  const employees = new Set();

  function visit(list, matched, parentPath) {
    (list || []).forEach(unit => {
      const name = text(unit && unit.name);
      const pathValue = parentPath ? `${parentPath}/${name}` : name;
      const keys = [unit && unit.id, unit && unit.code, name, pathValue].map(value => text(value).toLowerCase()).filter(Boolean);
      const isMatched = matched || keys.includes(selected);
      if (isMatched && name) names.add(name.toLowerCase());
      if (isMatched) {
        (unit && unit.employees || []).forEach(employee => {
          const employeeName = text(employee && employee.name).toLowerCase();
          const employeeId = text(employee && employee.employeeId).toLowerCase();
          if (employeeName) employees.add(employeeName);
          if (employeeId) employees.add(employeeId);
        });
      }
      visit(unit && unit.children, isMatched, pathValue);
    });
  }

  visit(units, false, '');
  return { names, employees };
}

function organizationResponse(org, assets) {
  const flatUnits = flattenOrganizationUnits(org.units, assets);
  return Object.assign({}, org, {
    flatNames: Array.from(new Set(flatUnits.map(unit => unit.name))),
    flatUnits,
    stats: {
      totalUnits: flatUnits.length,
      totalEmployees: organizationTotalEmployeeCount(org.units),
      totalAssets: assets.length,
      unmatchedAssets: assets.filter(asset => {
        const user = asset && asset.user ? asset.user : {};
        const department = text(user.department).toLowerCase();
        const userName = text(user.name).toLowerCase();
        const employeeId = text(user.employeeId).toLowerCase();
        return (department || userName || employeeId) && !flatUnits.some(unit => {
          return unit.name.toLowerCase() === department
            || (unit.employeeKeys || []).includes(userName)
            || (unit.employeeKeys || []).includes(employeeId);
        });
      }).length
    }
  });
}

function flattenOrganizationUnits(units, assets) {
  const rows = [];
  const assetUsers = (assets || []).map(asset => {
    const user = asset && asset.user ? asset.user : {};
    return {
      department: text(user.department).toLowerCase(),
      name: text(user.name).toLowerCase(),
      employeeId: text(user.employeeId).toLowerCase()
    };
  });

  function descendantScope(unit) {
    const names = [];
    const employeeKeys = new Set();
    function collect(item) {
      const name = text(item && item.name);
      if (name) names.push(name.toLowerCase());
      (item && item.employees || []).forEach(employee => {
        const employeeName = text(employee && employee.name).toLowerCase();
        const employeeId = text(employee && employee.employeeId).toLowerCase();
        if (employeeName) employeeKeys.add(employeeName);
        if (employeeId) employeeKeys.add(employeeId);
      });
      (item.children || []).forEach(collect);
    }
    collect(unit);
    return { names, employeeKeys: Array.from(employeeKeys) };
  }

  function visit(list, depth, parentPath) {
    (list || []).forEach(unit => {
      const name = text(unit && unit.name);
      if (!name) return;
      const pathValue = parentPath ? `${parentPath}/${name}` : name;
      const scope = descendantScope(unit);
      rows.push({
        id: text(unit.id),
        type: normalizeOrgType(unit.type),
        code: text(unit.code),
        name,
        manager: text(unit.manager),
        path: pathValue,
        depth,
        employeeCount: organizationEmployeeCount(unit),
        employeeKeys: scope.employeeKeys,
        assetCount: assetUsers.filter(user => scope.names.includes(user.department)
          || scope.employeeKeys.includes(user.name)
          || scope.employeeKeys.includes(user.employeeId)).length,
        directAssetCount: assetUsers.filter(user => user.department === name.toLowerCase()
          || (unit.employees || []).some(employee => {
            const employeeName = text(employee && employee.name).toLowerCase();
            const employeeId = text(employee && employee.employeeId).toLowerCase();
            return employeeName === user.name || employeeId === user.employeeId;
          })).length
      });
      visit(unit && unit.children, depth + 1, pathValue);
    });
  }

  visit(units, 0, '');
  return rows;
}

function isAssetFieldMissing(asset, fieldId) {
  const filter = MISSING_FIELD_FILTERS[fieldId];
  if (!filter) return false;
  if (typeof filter.isMissing === 'function') return filter.isMissing(asset);
  return !text(valueAtPath(asset, filter.path));
}

function valueAtPath(source, pathParts) {
  return (pathParts || []).reduce((value, key) => {
    if (!value || typeof value !== 'object') return '';
    return value[key];
  }, source);
}

function assetIpv4List(asset) {
  const ips = [];
  (asset.networkAdapters || []).forEach(nic => {
    (nic.ipAddresses || []).map(text).filter(isIpv4).forEach(ip => ips.push(ip));
  });
  return ips;
}

function isIpv4(value) {
  return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(text(value));
}

function uniqueIpv4List(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map(text)
    .filter(isIpv4)
    .filter(ip => {
      if (seen.has(ip)) return false;
      seen.add(ip);
      return true;
    });
}

function pingArgs(ip) {
  if (process.platform === 'win32') return ['-n', '1', '-w', String(REACHABILITY_TIMEOUT_MS), ip];
  if (process.platform === 'darwin') return ['-c', '1', '-W', String(Math.ceil(REACHABILITY_TIMEOUT_MS / 1000)), ip];
  return ['-c', '1', '-W', String(Math.ceil(REACHABILITY_TIMEOUT_MS / 1000)), ip];
}

function parsePingLatency(output) {
  const value = text(output);
  const patterns = [
    /time[=<]\s*([0-9.]+)\s*ms/i,
    /时间[=<]\s*([0-9.]+)\s*ms/i,
    /Average\s*=\s*([0-9.]+)\s*ms/i,
    /平均\s*=\s*([0-9.]+)\s*ms/i
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(value);
    if (match) return Number(match[1]);
  }
  return null;
}

function testIpReachability(ip) {
  const startedAt = Date.now();
  return new Promise(resolve => {
    execFile('ping', pingArgs(ip), { timeout: REACHABILITY_TIMEOUT_MS + 1500, windowsHide: true }, (error, stdout, stderr) => {
      const output = `${stdout || ''}\n${stderr || ''}`;
      const unreachable = /100%\s*loss|100%\s*丢失|请求超时|Request timed out|Destination host unreachable|无法访问目标主机/i.test(output);
      const online = !error && !unreachable;
      const latencyMs = parsePingLatency(output);
      resolve({
        ip,
        status: online ? 'online' : 'offline',
        latencyMs,
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        message: online
          ? (latencyMs == null ? 'Reachable' : `Reachable in ${latencyMs} ms`)
          : text(error && error.killed ? 'Timed out' : (stderr || stdout)).slice(0, 240)
      });
    });
  });
}

function parsePingLatencySafe(output) {
  const value = Buffer.isBuffer(output) ? output.toString('latin1') : text(output);
  const patterns = [
    /time[=<]\s*([0-9.]+)\s*ms/i,
    /[=<]\s*([0-9.]+)\s*ms/i,
    /Average\s*=\s*([0-9.]+)\s*ms/i
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(value);
    if (match) return Number(match[1]);
  }
  return null;
}

function testIpReachabilitySafe(ip) {
  const startedAt = Date.now();
  return new Promise(resolve => {
    execFile('ping', pingArgs(ip), { encoding: 'buffer', timeout: REACHABILITY_TIMEOUT_MS + 1500, windowsHide: true }, (error, stdout, stderr) => {
      const buffers = [];
      if (Buffer.isBuffer(stdout)) buffers.push(stdout);
      if (Buffer.isBuffer(stderr)) buffers.push(stderr);
      const output = Buffer.concat(buffers);
      const outputText = output.toString('latin1');
      const unreachable = /100%\s*loss|Request timed out|Destination host unreachable/i.test(outputText);
      const online = !error && !unreachable;
      const latencyMs = parsePingLatencySafe(output);
      const reason = online ? 'reachable' : (error && error.killed ? 'timeout' : 'no-response');
      resolve({
        ip,
        status: online ? 'online' : 'offline',
        reason,
        latencyMs,
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        message: online
          ? (latencyMs == null ? 'Reachable' : `Reachable in ${latencyMs} ms`)
          : `No response within ${REACHABILITY_TIMEOUT_MS} ms`
      });
    });
  });
}

async function reachabilityResponse(payload) {
  const ips = uniqueIpv4List(payload && payload.ips).slice(0, MAX_REACHABILITY_IPS);
  if (ips.length === 0) return { ok: false, error: 'No valid IPv4 addresses provided', results: [] };
  const results = await Promise.all(ips.map(testIpReachabilitySafe));
  const summary = results.reduce((acc, item) => {
    acc.total++;
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { total: 0, online: 0, offline: 0, error: 0 });
  return { ok: true, timeoutMs: REACHABILITY_TIMEOUT_MS, limit: MAX_REACHABILITY_IPS, summary, results };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeScriptJson(value) {
  return String(value == null ? '' : value)
    .replace(/<\//g, '<\\/')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function excelCell(value) {
  return `<td style="mso-number-format:'\\@'">${escapeHtml(value)}</td>`;
}

function displayBoardManufacturer(value) {
  const raw = text(value);
  const normalized = raw.toLowerCase();
  const brand = BOARD_BRAND_NAMES.find(item => item.hints.some(hint => normalized.includes(hint)));
  return brand ? brand.name : raw;
}

function exportExcel(res, ids) {
  const selected = new Set((ids || []).map(text).filter(Boolean));
  const rows = sortAssetsByDepartment(readAssets().filter(asset => selected.size === 0 || selected.has(asset.id)));
  const header = [
    '提交时间', '分类', '标签', '姓名', '部门', '工号', '位置', '电话', '备注',
    '计算机编号', '计算机名', '系统版本', '系统安装时间', '主板厂商', '主板型号',
    '物理网卡', '物理硬盘'
  ];
  const tableRows = rows.map(asset => {
    const nics = asset.networkAdapters.map(n => `${n.name} / ${n.macAddress} / ${n.ipAddresses.join(', ')}`).join('\n');
    const disks = asset.disks.map(d => `${d.model} / ${d.serialNumber} / ${d.sizeText || d.sizeBytes}`).join('\n');
    const values = [
      asset.createdAt, assetCategory(asset), (asset.metadata.tags || []).join(', '),
      asset.user.name, asset.user.department, asset.user.employeeId, asset.user.location,
      asset.user.phone, asset.user.note, asset.system.computerCode, asset.system.computerName, `${asset.system.osCaption} ${asset.system.osVersion}`,
      asset.system.installDate, displayBoardManufacturer(asset.baseBoard.manufacturer), asset.baseBoard.product,
      nics, disks
    ];
    return `<tr>${values.map(excelCell).join('')}</tr>`;
  }).join('');

  const importJson = escapeScriptJson(JSON.stringify(rows.map(assetSummary)));
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${header.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table><script id="it-assets-json" type="application/json">${importJson}</script></body></html>`;
  send(res, 200, html, {
    'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
    'Content-Disposition': `attachment; filename="it-assets-${new Date().toISOString().slice(0, 10)}.xls"`
  });
}

function exportJsonBackup(res) {
  const assets = readAssets().map(assetSummary);
  const backup = {
    kind: 'it-asset-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    count: assets.length,
    assets
  };
  const date = new Date().toISOString().slice(0, 10);
  send(res, 200, JSON.stringify(backup, null, 2), {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="it-assets-backup-${date}.json"`
  });
}

function parseImportBody(body) {
  const raw = String(body || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return [];

  if (/^</.test(raw)) {
    const match = raw.match(/<script\b[^>]*id=["']it-assets-json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!match) return [];
    return parseJsonText(match[1].replace(/<\\\//g, '</'), 'Invalid offline import data');
  }

  return parseJsonText(raw, 'Invalid offline import data');
}

function collectImportPayloads(input) {
  const result = [];

  function addItem(item) {
    if (!item || typeof item !== 'object') return;
    if (item.payload && typeof item.payload === 'object') {
      result.push(item.payload);
      return;
    }
    if (item.system || item.user || item.baseBoard || item.networkAdapters || item.disks) {
      result.push(item);
    }
  }

  if (Array.isArray(input)) {
    input.forEach(addItem);
  } else if (input && typeof input === 'object') {
    if (Array.isArray(input.records)) input.records.forEach(addItem);
    else if (Array.isArray(input.assets)) input.assets.forEach(addItem);
    else addItem(input);
  }

  return result;
}

function importAssets(payloads) {
  const items = readAssetsForWrite();
  const stats = { imported: 0, created: 0, updated: 0, pendingReview: 0, unchanged: 0, skipped: 0 };

  for (const payload of payloads) {
    try {
      const asset = normalizeAsset(payload);
      const duplicateIndexes = findDuplicateAssetIndexes(items, asset);

      if (duplicateIndexes.length > 0) {
        const existing = items[duplicateIndexes[0]];
        const review = createAssetSubmitReview(existing, asset, 'offline-import');
        if (review.pendingReviewCount > 0) stats.pendingReview++;
        else stats.unchanged++;
      } else {
        items.unshift(asset);
        stats.created++;
      }

      stats.imported++;
    } catch {
      stats.skipped++;
    }
  }

  if (stats.created > 0) writeAssets(items);
  return stats;
}

function backupPayloadAssets(input) {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'object') return [];
  if (Array.isArray(input.assets)) return input.assets;
  if (input.backup && Array.isArray(input.backup.assets)) return input.backup.assets;
  if (input.data && Array.isArray(input.data.assets)) return input.data.assets;
  return collectImportPayloads(input);
}

function restoreBackup(input) {
  const mode = text(input && input.mode).toLowerCase() === 'merge' ? 'merge' : 'replace';
  const payloads = backupPayloadAssets(input && Object.prototype.hasOwnProperty.call(input, 'backup') ? input.backup : input);
  if (payloads.length === 0) return { ok: false, error: 'No backup records found' };

  const backupPath = backupCurrentData('before-restore');

  if (mode === 'merge') {
    const stats = importAssets(payloads);
    return Object.assign({ ok: true, mode, backupPath }, stats);
  }

  const restored = [];
  let skipped = 0;
  for (const payload of payloads) {
    try {
      restored.push(normalizeAsset(payload));
    } catch {
      skipped++;
    }
  }

  writeAssets(restored);
  return {
    ok: true,
    mode,
    backupPath,
    restored: dedupeAssets(restored).length,
    skipped
  };
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && url.pathname === '/api/ping') {
    return sendJson(res, 200, {
      ok: true,
      name: os.hostname(),
      port: PORT,
      discoveryPort: DISCOVERY_PORT,
      time: new Date().toISOString()
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/assets') {
    const missingFields = missingFieldIds(url);
    const orgName = orgFilterName(url);
    const filtered = filterAssetsByOrganization(filterAssetsByMissingFields(readAssets(), missingFields), orgName);
    return sendJson(res, 200, sortAssetsByDepartment(filtered).map(assetSummary));
  }

  if (req.method === 'GET' && url.pathname === '/api/org') {
    const org = readOrganization();
    return sendJson(res, 200, organizationResponse(org, readAssets()));
  }

  if (req.method === 'POST' && url.pathname === '/api/key/verify') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/client-danger-key') {
    return sendJson(res, 200, clientDangerKeyStatus());
  }

  if (req.method === 'PUT' && url.pathname === '/api/client-danger-key') {
    const payload = await readJsonBody(req);
    return sendJson(res, 200, setClientDangerKey(payload.key));
  }

  if (req.method === 'POST' && url.pathname === '/api/client-danger-key/verify') {
    const payload = await readJsonBody(req);
    const ok = verifyClientDangerKey(payload.key);
    return sendJson(res, ok ? 200 : 401, { ok });
  }

  if (req.method === 'PUT' && url.pathname === '/api/org') {
    const payload = await readJsonBody(req);
    return sendJson(res, 200, writeOrganization(payload));
  }

  if (req.method === 'GET' && url.pathname === '/api/categories') {
    return sendJson(res, 200, {
      version: 1,
      categories: readCategories(),
      assetCategories: buildCategoriesFromAssets(readAssets())
    });
  }

  if (req.method === 'PUT' && url.pathname === '/api/categories') {
    const payload = await readJsonBody(req);
    return sendJson(res, 200, { ok: true, categories: writeCategories(payload) });
  }

  if (req.method === 'POST' && url.pathname === '/api/collect/request') {
    const payload = await readJsonBody(req);
    return sendJson(res, 200, { ok: true, request: collectionRequestSummary(createCollectionRequest(payload)) });
  }

  if (req.method === 'GET' && url.pathname === '/api/collect/request') {
    recordClientHeartbeat({
      computerName: url.searchParams.get('computerName'),
      taskId: url.searchParams.get('lastTaskId'),
      status: 'poll',
      ip: requestIp(req)
    });
    const request = latestActiveCollectionRequest(url.searchParams.get('lastTaskId'), url.searchParams.get('computerName'));
    return sendJson(res, 200, { ok: true, request: request ? collectionRequestSummary(request) : null });
  }

  if (req.method === 'GET' && url.pathname === '/api/collect/status') {
    const requests = readCollectionRequests().map(collectionRequestSummary).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return sendJson(res, 200, { ok: true, requests });
  }

  if (req.method === 'GET' && url.pathname === '/api/client-installations') {
    return sendJson(res, 200, clientInstallationStatus());
  }

  if (req.method === 'GET' && url.pathname === '/api/client/versions') {
    return sendJson(res, 200, clientVersionsStatus());
  }

  if (req.method === 'POST' && url.pathname === '/api/client/versions') {
    const payload = await readJsonBody(req);
    return sendJson(res, 200, publishClientVersion(payload));
  }

  if (req.method === 'GET' && url.pathname === '/api/client/update') {
    recordClientHeartbeat({
      computerName: url.searchParams.get('computerName'),
      version: url.searchParams.get('version'),
      status: 'update-check',
      ip: requestIp(req)
    });
    return sendJson(res, 200, clientUpdateResponse(url.searchParams.get('version'), url.searchParams.get('flavor')));
  }

  if (req.method === 'POST' && url.pathname === '/api/collect/report') {
    const payload = await readJsonBody(req);
    return sendJson(res, 200, { ok: true, request: saveCollectionReport(payload) });
  }

  if (req.method === 'POST' && url.pathname === '/api/collect/apply') {
    const payload = await readJsonBody(req);
    const result = applyCollectionReview(payload.taskId, payload.computerName);
    return sendJson(res, result.ok ? 200 : 400, result);
  }

  if (req.method === 'POST' && url.pathname === '/api/collect/discard') {
    const payload = await readJsonBody(req);
    const result = discardCollectionReview(payload.taskId, payload.computerName);
    return sendJson(res, result.ok ? 200 : 400, result);
  }

  if (req.method === 'POST' && url.pathname === '/api/ip/reachability') {
    const payload = await readJsonBody(req);
    const result = await reachabilityResponse(payload);
    return sendJson(res, result.ok ? 200 : 400, result);
  }

  if (req.method === 'GET' && url.pathname === '/api/backup/download') {
    return exportJsonBackup(res);
  }

  if (req.method === 'POST' && url.pathname === '/api/backup/restore') {
    const payload = await readJsonBody(req);
    const result = restoreBackup(payload);
    if (!result.ok) return sendJson(res, 400, result);
    return sendJson(res, 200, result);
  }

  if (req.method === 'POST' && url.pathname === '/api/assets/batch-delete') {
    const payload = await readJsonBody(req);
    const ids = new Set(Array.isArray(payload.ids) ? payload.ids.map(text).filter(Boolean) : []);
    if (ids.size === 0) return sendJson(res, 400, { error: 'No ids provided' });

    const items = readAssetsForWrite();
    const kept = items.filter(item => !ids.has(item.id));
    writeAssets(kept);
    return sendJson(res, 200, { ok: true, deleted: items.length - kept.length });
  }

  if (req.method === 'POST' && url.pathname === '/api/assets/batch-category') {
    const payload = await readJsonBody(req);
    const ids = new Set(Array.isArray(payload.ids) ? payload.ids.map(text).filter(Boolean) : []);
    if (ids.size === 0) return sendJson(res, 400, { error: 'No ids provided' });

    const category = text(payload.category);
    const items = readAssetsForWrite();
    let updated = 0;
    for (let i = 0; i < items.length; i++) {
      if (!ids.has(items[i].id)) continue;
      const asset = normalizeAsset(items[i], items[i]);
      asset.metadata = asset.metadata || {};
      asset.metadata.category = category;
      items[i] = asset;
      updated++;
    }

    if (updated > 0) writeAssets(items);
    return sendJson(res, 200, { ok: true, updated, category });
  }

  if (req.method === 'POST' && url.pathname === '/api/assets/batch-tags') {
    const payload = await readJsonBody(req);
    const ids = new Set(Array.isArray(payload.ids) ? payload.ids.map(text).filter(Boolean) : []);
    if (ids.size === 0) return sendJson(res, 400, { error: 'No ids provided' });

    const mode = ['replace', 'add', 'remove'].includes(text(payload.mode).toLowerCase())
      ? text(payload.mode).toLowerCase()
      : 'add';
    const tags = normalizeTags(payload.tags);
    const tagKeys = new Set(tags.map(tag => tag.toLowerCase()));
    const items = readAssetsForWrite();
    let updated = 0;
    for (let i = 0; i < items.length; i++) {
      if (!ids.has(items[i].id)) continue;
      const asset = normalizeAsset(items[i], items[i]);
      const currentTags = normalizeTags(asset.metadata && asset.metadata.tags);
      asset.metadata = asset.metadata || {};
      if (mode === 'replace') {
        asset.metadata.tags = tags;
      } else if (mode === 'remove') {
        asset.metadata.tags = currentTags.filter(tag => !tagKeys.has(tag.toLowerCase()));
      } else {
        asset.metadata.tags = normalizeTags(currentTags.concat(tags));
      }
      items[i] = asset;
      updated++;
    }

    if (updated > 0) writeAssets(items);
    return sendJson(res, 200, { ok: true, updated, mode, tags });
  }

  if (req.method === 'POST' && url.pathname === '/api/assets/cleanup-abnormal-devices') {
    const payload = await readJsonBody(req);
    return sendJson(res, 200, cleanupAbnormalDevices(payload.sources));
  }

  if (req.method === 'POST' && url.pathname === '/api/import-offline') {
    const payload = parseImportBody(await readBody(req));
    const records = collectImportPayloads(payload);
    if (records.length === 0) return sendJson(res, 400, { error: 'No offline records found' });

    return sendJson(res, 200, Object.assign({ ok: true }, importAssets(records)));
  }

  if (req.method === 'POST' && url.pathname === '/api/assets') {
    const payload = await readJsonBody(req);
    const items = readAssetsForWrite();
    const asset = normalizeAsset(payload);
    const duplicateIndexes = findDuplicateAssetIndexes(items, asset);

    if (duplicateIndexes.length > 0) {
      const existing = items[duplicateIndexes[0]];
      const review = createAssetSubmitReview(existing, asset, 'asset-submit');
      return sendJson(res, 202, Object.assign(assetSummary(existing), {
        duplicate: true,
        action: review.pendingReviewCount > 0 ? 'pending_review' : 'unchanged',
        pendingReview: review.pendingReviewCount > 0,
        reviewRequestId: review.id,
        diffCount: review.reports && review.reports[0] && Array.isArray(review.reports[0].diff) ? review.reports[0].diff.length : 0,
        message: review.pendingReviewCount > 0
          ? 'Existing asset was not updated. New submitted data is waiting for review.'
          : 'Existing asset already matches submitted data.'
      }));
    }

    items.unshift(asset);
    writeAssets(items);
    return sendJson(res, 201, Object.assign(assetSummary(asset), { duplicate: false, action: 'created' }));
  }

  if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'assets') {
    const id = parts[2];
    const items = readAssetsForWrite();
    const index = items.findIndex(item => item.id === id);
    if (index < 0) return sendJson(res, 404, { error: 'Asset not found' });

    if (req.method === 'GET') return sendJson(res, 200, assetSummary(items[index]));

    if (req.method === 'PUT') {
      const payload = await readJsonBody(req);
      items[index] = normalizeAsset(mergeAssetInput(items[index], payload), items[index]);
      writeAssets(items);
      return sendJson(res, 200, assetSummary(items[index]));
    }

    if (req.method === 'DELETE') {
      const removed = items.splice(index, 1)[0];
      writeAssets(items);
      return sendJson(res, 200, { ok: true, id: removed.id });
    }
  }

  sendJson(res, 404, { error: 'API not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/export.xls') {
      if (requiresServerKey(req) && !authorized(req)) return rejectUnauthorized(req, res);
      return exportExcel(res, (url.searchParams.get('ids') || '').split(','));
    }
    if (req.url.startsWith('/api/')) {
      if (requiresServerKey(req) && !authorized(req)) return rejectUnauthorized(req, res);
      return await handleApi(req, res);
    }
    return serveStatic(req, res);
  } catch (err) {
    const status = err && Number(err.statusCode) >= 400 && Number(err.statusCode) < 600 ? Number(err.statusCode) : 500;
    sendJson(res, status, { error: err.message || 'Server error' });
  }
});

ensureDataFile();
server.listen(PORT, HOST, () => {
  console.log(`IT Asset server is running at http://localhost:${PORT}`);
  console.log(SERVER_KEY ? 'Server key protection is enabled.' : 'Server key protection is disabled. Set ASSET_SERVER_KEY to enable it.');
  console.log(UPDATE_SIGNING_PRIVATE_KEY ? 'Client update signing is enabled.' : 'Client update signing is disabled. Set ASSET_UPDATE_SIGNING_PRIVATE_KEY before publishing trusted auto-updates.');
  for (const address of localIpv4Addresses()) {
    console.log(`LAN access: http://${address}:${PORT}`);
  }
  startDiscoveryServer();
});

function startDiscoveryServer() {
  const socket = dgram.createSocket('udp4');

  socket.on('message', (message, remote) => {
    if (message.toString('utf8').trim() !== DISCOVERY_MAGIC) return;

    const url = `http://${pickServerAddress(remote.address)}:${PORT}`;
    const payload = Buffer.from(JSON.stringify({
      magic: DISCOVERY_MAGIC,
      name: os.hostname(),
      port: PORT,
      url,
      addresses: localIpv4Addresses()
    }), 'utf8');
    socket.send(payload, remote.port, remote.address);
  });

  socket.on('error', err => {
    console.warn(`Discovery server error: ${err.message}`);
  });

  socket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
    socket.setBroadcast(true);
    console.log(`Discovery server is listening on UDP ${DISCOVERY_PORT}`);
  });
}

function pickServerAddress(clientAddress) {
  const candidates = localIpv4Addresses();

  if (!clientAddress || clientAddress === '127.0.0.1' || clientAddress === '::1') return '127.0.0.1';

  const clientPrefix = clientAddress.split('.').slice(0, 3).join('.');
  return candidates.find(address => address.startsWith(clientPrefix + '.')) || candidates[0] || clientAddress;
}

function localIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const list of Object.values(interfaces)) {
    for (const item of list || []) {
      const family = String(item.family || '');
      if ((family === 'IPv4' || family === '4') && !item.internal) candidates.push(item.address);
    }
  }

  return candidates;
}
