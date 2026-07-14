let currentLang = localStorage.getItem('assetManagerLang') || 'zh-CN';
let serverKey = localStorage.getItem('assetServerKey') || '';
let pendingDiffs = [];

const zh = {
  clientManagement: '客户端管理',
  refresh: '刷新',
  backToAssets: '返回资产',
  loading: '加载中...',
  save: '保存',
  clientOverviewTitle: '\u5ba2\u6237\u7aef\u6982\u89c8',
  clientOverviewHint: '\u4f18\u5148\u5173\u6ce8\u672a\u68c0\u6d4b\u5ba2\u6237\u7aef\u3001\u672a\u5efa\u6863\u5fc3\u8df3\u3001\u5f85\u5ba1\u6838\u5dee\u5f02\u548c\u5347\u7ea7\u5305\u72b6\u6001\u3002',
  clientInstallTitle: '安装状态',
  clientInstallHint: '查看客户端安装、在线和未建档心跳情况。',
  clientCollectTitle: '采集任务',
  clientCollectHint: '向已安装客户端下发采集任务，或对指定电脑发起差异复核采集。',
  collectAgents: '一键收集客户端',
  collectAgentsDone: request => `已下发采集任务：${request.id || '-'}`,
  collectAgentsFailed: message => `下发采集任务失败：${message}`,
  reviewTargets: '复核电脑名',
  reviewTargetsPlaceholder: '每行一个计算机名',
  reviewCollectTargets: '复核采集指定电脑',
  reviewTargetRequired: '请至少填写一个计算机名。',
  reviewCollectDone: request => `已下发复核采集任务：${request.id || '-'}`,
  reviewCollectFailed: message => `下发复核采集任务失败：${message}`,
  reviewDiffs: '采集差异审核',
  reviewDiffHint: '按电脑逐条查看变更；只有点击应用才会写入资产档案，丢弃则保留原档案。',
  reviewDiffsEmpty: '暂无待确认的采集差异。',
  reviewDiffApplied: '已应用采集更新。',
  reviewDiffDiscarded: '已丢弃这条采集差异。',
  reviewDiffFailed: message => `处理采集差异失败：${message}`,
  applyDiff: '应用这条差异',
  discardDiff: '丢弃这条差异',
  diffCount: count => `${count} 项差异`,
  diffPendingCount: count => `${count} 条待审核`,
  oldValue: '原值',
  newValue: '新值',
  reportedAt: '回报时间',
  taskId: '任务',
  computer: '电脑',
  clientKeyHint: '用于客户端修改使用人、卸载等敏感操作。',
  manageClientKey: '客户端危险操作密钥',
  clientKeyPlaceholder: '输入新密钥',
  clientKeyEmpty: '密钥不能为空。',
  clientKeySaved: '客户端危险操作密钥已更新。',
  clientKeySaveFailed: message => `保存客户端危险操作密钥失败：${message}`,
  totalAssets: '资产总数',
  installed: '已安装',
  online: '近 5 分钟在线',
  notDetected: '未检测到',
  extraInstalled: '未建档心跳',
  missingClients: '未检测到客户端',
  extraClients: '有心跳但未建档',
  collectThisClient: '建档采集',
  collectClientDone: request => `已向该电脑下发建档采集：${request.id || '-'}`,
  collectClientFailed: message => `下发建档采集失败：${message}`,
  onlineNow: '在线',
  offlineNow: '离线',
  lastIp: 'IP',
  clientVersion: '版本',
  clientStatus: '状态',
  allClear: '暂无异常客户端状态。',
  versionManageTitle: '客户端版本管理',
  versionManageHint: '发布标准版和 XP 版客户端自动升级包。',
  versionWinTitle: '标准客户端',
  versionXpTitle: 'XP 客户端',
  versionNumber: '版本号',
  versionExeFile: 'EXE 文件',
  versionConfigFile: '配置文件',
  versionNotes: '备注',
  publishVersion: '发布',
  versionCurrent: item => `${item.label}：${item.version || '未发布'}`,
  versionMeta: item => `文件：${item.fileName || '-'} / 大小：${item.size || 0} B / 时间：${item.publishedAt || '-'}`,
  versionRequired: '请填写版本号并选择 EXE 文件。',
  versionPublishDone: '客户端版本已发布。',
  versionPublishFailed: message => `发布失败：${message}`,
  versionLoadFailed: message => `加载版本失败：${message}`,
  authRequired: '请输入服务端管理密钥',
  authFailed: '密钥不正确。'
};

const en = {
  clientManagement: 'Client Management',
  refresh: 'Refresh',
  backToAssets: 'Back',
  loading: 'Loading...',
  save: 'Save',
  clientOverviewTitle: 'Client Overview',
  clientOverviewHint: 'Focus on missing clients, unmatched heartbeats, pending diffs, and update package status.',
  clientInstallTitle: 'Installation Status',
  clientInstallHint: 'Review client installation, online status, and unmatched heartbeats.',
  clientCollectTitle: 'Collection Tasks',
  clientCollectHint: 'Request installed clients to collect data, or review specific computers.',
  collectAgents: 'Collect Installed Clients',
  collectAgentsDone: request => `Collection request created: ${request.id || '-'}`,
  collectAgentsFailed: message => `Create collection request failed: ${message}`,
  reviewTargets: 'Review computers',
  reviewTargetsPlaceholder: 'One computer name per line',
  reviewCollectTargets: 'Review Selected Computers',
  reviewTargetRequired: 'Enter at least one computer name.',
  reviewCollectDone: request => `Review request created: ${request.id || '-'}`,
  reviewCollectFailed: message => `Create review request failed: ${message}`,
  reviewDiffs: 'Collection Diff Review',
  reviewDiffHint: 'Inspect changes by computer. Assets are updated only after applying a diff.',
  reviewDiffsEmpty: 'No pending collection diffs.',
  reviewDiffApplied: 'Collection update applied.',
  reviewDiffDiscarded: 'Collection diff discarded.',
  reviewDiffFailed: message => `Handle collection diff failed: ${message}`,
  applyDiff: 'Apply This Diff',
  discardDiff: 'Discard This Diff',
  diffCount: count => `${count} diffs`,
  diffPendingCount: count => `${count} pending`,
  oldValue: 'Old',
  newValue: 'New',
  reportedAt: 'Reported',
  taskId: 'Task',
  computer: 'Computer',
  clientKeyHint: 'Used by client-side sensitive operations such as editing user info and uninstall.',
  manageClientKey: 'Client Operation Key',
  clientKeyPlaceholder: 'New key',
  clientKeyEmpty: 'Key cannot be empty.',
  clientKeySaved: 'Client operation key has been updated.',
  clientKeySaveFailed: message => `Failed to save client operation key: ${message}`,
  totalAssets: 'Total assets',
  installed: 'Installed',
  online: 'Online in 5 min',
  notDetected: 'Not detected',
  extraInstalled: 'Unmatched heartbeat',
  missingClients: 'Missing clients',
  extraClients: 'Heartbeat without asset',
  collectThisClient: 'Collect for Filing',
  collectClientDone: request => `Filing collection request created: ${request.id || '-'}`,
  collectClientFailed: message => `Create filing collection request failed: ${message}`,
  onlineNow: 'Online',
  offlineNow: 'Offline',
  lastIp: 'IP',
  clientVersion: 'Version',
  clientStatus: 'Status',
  allClear: 'No abnormal client status.',
  versionManageTitle: 'Client Version Management',
  versionManageHint: 'Publish auto-update packages for standard and XP clients.',
  versionWinTitle: 'Standard client',
  versionXpTitle: 'XP client',
  versionNumber: 'Version',
  versionExeFile: 'EXE file',
  versionConfigFile: 'Config file',
  versionNotes: 'Notes',
  publishVersion: 'Publish',
  versionCurrent: item => `${item.label}: ${item.version || 'Not published'}`,
  versionMeta: item => `File: ${item.fileName || '-'} / Size: ${item.size || 0} B / Time: ${item.publishedAt || '-'}`,
  versionRequired: 'Enter a version and choose an EXE file.',
  versionPublishDone: 'Client version published.',
  versionPublishFailed: message => `Publish failed: ${message}`,
  versionLoadFailed: message => `Load versions failed: ${message}`,
  authRequired: 'Enter server admin key',
  authFailed: 'Incorrect key.'
};

const translations = { 'zh-CN': zh, 'en-US': en };
const languageSelect = document.getElementById('languageSelect');
const clientSummary = document.getElementById('clientSummary');
const clientMetricGrid = document.getElementById('clientMetricGrid');
const clientStatusList = document.getElementById('clientStatusList');
const reviewTargetsInput = document.getElementById('reviewTargetsInput');
const diffSummary = document.getElementById('diffSummary');
const diffList = document.getElementById('diffList');
const clientKeyInput = document.getElementById('clientKeyInput');
const versionStatusList = document.getElementById('versionStatusList');
const versionWinNumber = document.getElementById('versionWinNumber');
const versionWinExe = document.getElementById('versionWinExe');
const versionWinConfig = document.getElementById('versionWinConfig');
const versionWinNotes = document.getElementById('versionWinNotes');
const versionXpNumber = document.getElementById('versionXpNumber');
const versionXpExe = document.getElementById('versionXpExe');
const versionXpConfig = document.getElementById('versionXpConfig');
const versionXpNotes = document.getElementById('versionXpNotes');

languageSelect.value = currentLang;
languageSelect.addEventListener('change', () => {
  currentLang = languageSelect.value;
  localStorage.setItem('assetManagerLang', currentLang);
  applyLanguage();
  renderDiffs();
});

document.getElementById('refreshBtn').addEventListener('click', loadClientPage);
document.getElementById('checkClientsBtn').addEventListener('click', loadClientStatus);
document.getElementById('collectAgentsBtn').addEventListener('click', collectInstalledClients);
document.getElementById('refreshDiffsBtn').addEventListener('click', loadDiffs);
document.getElementById('reviewTargetsBtn').addEventListener('click', reviewTargetComputers);
document.getElementById('saveClientKeyBtn').addEventListener('click', saveClientDangerKey);
document.getElementById('versionRefreshBtn').addEventListener('click', loadClientVersions);
document.getElementById('publishWinVersionBtn').addEventListener('click', () => publishClientVersion('win'));
document.getElementById('publishXpVersionBtn').addEventListener('click', () => publishClientVersion('xp'));

applyLanguage();
loadClientPage();

function t(key, arg) {
  const value = (translations[currentLang] || zh)[key];
  return typeof value === 'function' ? value(arg) : value || key;
}

function uiText(key, arg) {
  const zhText = {
    noDiffTitle: '\u65e0\u5dee\u5f02',
    noDiffBody: '\u5ba2\u6237\u7aef\u5df2\u56de\u62a5\uff0c\u91c7\u96c6\u6570\u636e\u4e0e\u73b0\u6709\u8d44\u4ea7\u6863\u6848\u4e00\u81f4\u3002',
    confirmNoDiff: '\u786e\u8ba4\u65e0\u5dee\u5f02',
    noDiffConfirmed: '\u5df2\u786e\u8ba4\u8be5\u6b21\u91c7\u96c6\u4e0e\u73b0\u6709\u6863\u6848\u4e00\u81f4\u3002',
    reviewStats: stats => `\u5f85\u5904\u7406 ${stats.total} \u6761\uff08\u5dee\u5f02 ${stats.diff} / \u65e0\u5dee\u5f02 ${stats.same}\uff09`
  };
  const enText = {
    noDiffTitle: 'No Difference',
    noDiffBody: 'The client reported successfully and the collected data matches the existing asset record.',
    confirmNoDiff: 'Confirm Unchanged',
    noDiffConfirmed: 'Collection result confirmed as unchanged.',
    reviewStats: stats => `${stats.total} pending (${stats.diff} changed / ${stats.same} unchanged)`
  };
  const value = (currentLang === 'en-US' ? enText : zhText)[key];
  return typeof value === 'function' ? value(arg) : value || key;
}

function applyLanguage() {
  document.documentElement.lang = currentLang;
  document.title = t('clientManagement');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
}

async function loadClientPage() {
  clientSummary.textContent = t('loading');
  await Promise.all([loadClientStatus(), loadDiffs(), loadClientVersions()]);
}

async function loadClientStatus() {
  clientStatusList.innerHTML = `<div class="emptyMini">${escapeHtml(t('loading'))}</div>`;
  const res = await authedFetch('/api/client-installations', { cache: 'no-store' });
  if (!res.ok) {
    clientStatusList.innerHTML = `<div class="emptyMini">${escapeHtml(await res.text())}</div>`;
    return;
  }
  const result = await res.json();
  const summary = result.summary || {};
  clientSummary.textContent = `${t('installed')} ${summary.installed || 0} / ${t('online')} ${summary.online || 0}`;
  clientMetricGrid.innerHTML = [
    renderMetric(t('totalAssets'), summary.totalAssets || 0),
    renderMetric(t('installed'), summary.installed || 0),
    renderMetric(t('online'), summary.online || 0),
    renderMetric(t('notDetected'), summary.notDetected || 0, summary.notDetected ? 'warn' : ''),
    renderMetric(t('extraInstalled'), summary.extraInstalled || 0, summary.extraInstalled ? 'warn' : '')
  ].join('');
  const computers = Array.isArray(result.computers) ? result.computers : [];
  const missing = computers.filter(item => !item.installed).slice(0, 60);
  const extra = computers.filter(item => item.assetMissing && !item.staleHeartbeat).slice(0, 60);
  const blocks = [];
  if (missing.length) blocks.push(renderClientStatusBlock(t('missingClients'), missing, 'missing'));
  if (extra.length) blocks.push(renderClientStatusBlock(t('extraClients'), extra, 'extra'));
  clientStatusList.innerHTML = blocks.length ? blocks.join('') : `<div class="emptyMini">${escapeHtml(t('allClear'))}</div>`;
  clientStatusList.querySelectorAll('[data-collect-client]').forEach(button => {
    button.addEventListener('click', () => collectSingleClient(button.getAttribute('data-collect-client')));
  });
}

function renderMetric(label, value, tone) {
  return `<div class="metric ${escapeHtml(tone || '')}">
    <div class="metricValue">${escapeHtml(value)}</div>
    <div class="metricLabel">${escapeHtml(label)}</div>
  </div>`;
}

function renderClientStatusBlock(title, items, tone) {
  return `<section class="clientStatusBlock ${escapeHtml(tone || '')}">
    <h3><span>${escapeHtml(title)}</span><em>${escapeHtml(items.length)}</em></h3>
    <div class="clientStatusRows">${items.map(renderClientStatusRow).join('')}</div>
  </section>`;
}

function renderClientStatusRow(item) {
  const main = item.computerCode || item.computerName || '-';
  const meta = [item.department, item.userName, item.lastSeenAt ? formatDate(item.lastSeenAt) : ''].filter(Boolean).join(' / ');
  const statusKey = item.assetMissing ? 'extra' : (!item.installed ? 'missing' : (item.online ? 'online' : 'offline'));
  const statusText = item.assetMissing
    ? t('extraInstalled')
    : (!item.installed ? t('notDetected') : (item.online ? t('onlineNow') : t('offlineNow')));
  const details = [
    item.lastIp ? `${t('lastIp')}: ${item.lastIp}` : '',
    item.clientVersion ? `${t('clientVersion')}: ${item.clientVersion}` : '',
    item.lastStatus ? `${t('clientStatus')}: ${item.lastStatus}` : ''
  ].filter(Boolean).join(' / ');
  const actions = item.assetMissing && item.computerName
    ? `<button type="button" class="smallButton" data-collect-client="${escapeHtml(item.computerName)}">${escapeHtml(t('collectThisClient'))}</button>`
    : '';
  return `<div class="clientStatusRow ${escapeHtml(statusKey)}">
    <div class="clientStatusMain">
      <strong>${escapeHtml(main)}</strong>
      <span class="clientStatusBadge ${escapeHtml(statusKey)}">${escapeHtml(statusText)}</span>
    </div>
    <small>${escapeHtml(meta || '-')}</small>
    ${details ? `<small>${escapeHtml(details)}</small>` : ''}
    ${actions ? `<div class="clientStatusActions">${actions}</div>` : ''}
  </div>`;
}

async function collectSingleClient(computerName) {
  const target = String(computerName || '').trim();
  if (!target) return;
  const res = await authedFetch('/api/collect/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewOnly: false, targets: [target] })
  });
  if (!res.ok) {
    alert(t('collectClientFailed', await res.text()));
    return;
  }
  const result = await res.json();
  alert(t('collectClientDone', result.request || {}));
  await loadClientStatus();
}

async function collectInstalledClients() {
  const res = await authedFetch('/api/collect/request', { method: 'POST' });
  if (!res.ok) {
    alert(t('collectAgentsFailed', await res.text()));
    return;
  }
  const result = await res.json();
  alert(t('collectAgentsDone', result.request || {}));
}

async function reviewTargetComputers() {
  const targets = String(reviewTargetsInput.value || '').split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
  if (!targets.length) {
    alert(t('reviewTargetRequired'));
    return;
  }
  const res = await authedFetch('/api/collect/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewOnly: true, targets })
  });
  if (!res.ok) {
    alert(t('reviewCollectFailed', await res.text()));
    return;
  }
  const result = await res.json();
  alert(t('reviewCollectDone', result.request || {}));
  reviewTargetsInput.value = '';
}

async function loadDiffs() {
  diffList.innerHTML = `<div class="emptyMini">${escapeHtml(t('loading'))}</div>`;
  const res = await authedFetch('/api/collect/status', { cache: 'no-store' });
  if (!res.ok) {
    diffList.innerHTML = `<div class="emptyMini">${escapeHtml(t('reviewDiffFailed', await res.text()))}</div>`;
    return;
  }
  const result = await res.json();
  pendingDiffs = [];
  const seenDiffs = new Set();
  (result.requests || []).forEach(request => {
    (request.reports || []).forEach(report => {
      if (!report || (!report.pendingReview && !report.pendingConfirmation)) return;
      const key = reviewItemKey(request, report);
      if (seenDiffs.has(key)) return;
      seenDiffs.add(key);
      pendingDiffs.push({ request, report });
    });
  });
  renderDiffs();
}

function renderDiffs() {
  const stats = pendingDiffs.reduce((acc, item) => {
    if (isNoDiffItem(item.report)) acc.same++;
    else acc.diff++;
    acc.total++;
    return acc;
  }, { total: 0, diff: 0, same: 0 });
  diffSummary.textContent = uiText('reviewStats', stats);
  if (!pendingDiffs.length) {
    diffList.innerHTML = `<div class="emptyMini">${escapeHtml(t('reviewDiffsEmpty'))}</div>`;
    return;
  }
  diffList.innerHTML = pendingDiffs.map((item, index) => renderDiffCard(item, index)).join('');
  diffList.querySelectorAll('[data-apply-diff]').forEach(button => {
    button.addEventListener('click', () => applyDiff(Number(button.getAttribute('data-apply-diff'))));
  });
  diffList.querySelectorAll('[data-discard-diff]').forEach(button => {
    button.addEventListener('click', () => discardDiff(Number(button.getAttribute('data-discard-diff'))));
  });
}

function renderDiffCard(item, index) {
  const report = item.report || {};
  const request = item.request || {};
  const diffs = Array.isArray(report.diff) ? report.diff : [];
  const noDiff = isNoDiffItem(report);
  return `<article class="diffCard">
    <div class="diffCardHeader">
      <div>
        <strong>${escapeHtml(report.computerName || '-')}</strong>
        <small>${escapeHtml(t('taskId'))}: ${escapeHtml(request.id || '-')} / ${escapeHtml(t('reportedAt'))}: ${escapeHtml(formatDate(report.reportedAt))}</small>
      </div>
      <span>${escapeHtml(noDiff ? uiText('noDiffTitle') : t('diffCount', diffs.length))}</span>
    </div>
    <div class="diffTable">
      ${noDiff ? renderNoDiffRow() : diffs.map(renderDiffRow).join('')}
    </div>
    <div class="diffActions">
      ${noDiff
        ? `<button class="primary" type="button" data-discard-diff="${index}">${escapeHtml(uiText('confirmNoDiff'))}</button>`
        : `<button class="danger" type="button" data-discard-diff="${index}">${escapeHtml(t('discardDiff'))}</button>
          <button class="primary" type="button" data-apply-diff="${index}">${escapeHtml(t('applyDiff'))}</button>`}
    </div>
  </article>`;
}

function isNoDiffItem(report) {
  const diffs = Array.isArray(report && report.diff) ? report.diff : [];
  return Boolean(report && report.pendingConfirmation && !report.pendingReview && diffs.length === 0);
}

function renderNoDiffRow() {
  return `<div class="diffRow diffRowCollection">
    <div class="diffField">${escapeHtml(uiText('noDiffTitle'))}</div>
    <div class="diffEmpty">${escapeHtml(uiText('noDiffBody'))}</div>
  </div>`;
}

function renderDiffRow(diff) {
  const collection = renderDiffCollection(diff);
  if (collection) {
    return `<div class="diffRow diffRowCollection">
      <div class="diffField">${escapeHtml(diff.label || diff.field || '-')}</div>
      <div class="diffChanges">${collection}</div>
    </div>`;
  }
  return `<div class="diffRow">
    <div class="diffField">${escapeHtml(diff.label || diff.field || '-')}</div>
    <div class="diffValue"><span>${escapeHtml(t('oldValue'))}</span>${renderDiffValue(diff.oldValue)}</div>
    <div class="diffValue"><span>${escapeHtml(t('newValue'))}</span>${renderDiffValue(diff.newValue)}</div>
  </div>`;
}

function reviewItemKey(request, report) {
  return [
    String(report && report.computerName || '').trim().toUpperCase(),
    String(report && report.existingAssetId || ''),
    String(report && report.reviewKey || stableDiffString(report && report.diff || []))
  ].join('|');
}

function renderDiffCollection(diff) {
  const oldItems = parseDiffValue(diff && diff.oldValue);
  const newItems = parseDiffValue(diff && diff.newValue);
  if (!Array.isArray(oldItems) || !Array.isArray(newItems)) return '';
  const changes = diffCollectionChanges(oldItems, newItems);
  if (!changes.length) return `<div class="diffEmpty">${escapeHtml(emptyText())}</div>`;
  return `<div class="diffChangeList">${changes.map(renderDiffChange).join('')}</div>`;
}

function diffCollectionChanges(oldItems, newItems) {
  const usedOld = new Set();
  const changes = [];
  newItems.forEach(newItem => {
    const oldIndex = oldItems.findIndex((oldItem, index) => !usedOld.has(index) && diffItemKey(oldItem) === diffItemKey(newItem));
    if (oldIndex < 0) {
      changes.push({ type: 'added', newItem });
      return;
    }
    usedOld.add(oldIndex);
    if (stableDiffString(oldItems[oldIndex]) !== stableDiffString(newItem)) {
      changes.push({ type: 'changed', oldItem: oldItems[oldIndex], newItem });
    }
  });
  oldItems.forEach((oldItem, index) => {
    if (!usedOld.has(index)) changes.push({ type: 'removed', oldItem });
  });
  return changes;
}

function renderDiffChange(change) {
  const label = diffChangeLabel(change.type);
  if (change.type === 'changed') {
    return `<div class="diffChange">
      <span class="diffBadge diffBadgeChanged">${escapeHtml(label)}</span>
      <div class="diffValue"><span>${escapeHtml(t('oldValue'))}</span>${renderDiffListItem(change.oldItem)}</div>
      <div class="diffValue"><span>${escapeHtml(t('newValue'))}</span>${renderDiffListItem(change.newItem)}</div>
    </div>`;
  }
  const item = change.type === 'removed' ? change.oldItem : change.newItem;
  return `<div class="diffChange">
    <span class="diffBadge ${change.type === 'removed' ? 'diffBadgeRemoved' : 'diffBadgeAdded'}">${escapeHtml(label)}</span>
    <div class="diffValue diffValueWide">${renderDiffListItem(item)}</div>
  </div>`;
}

function diffItemKey(item) {
  if (!item || typeof item !== 'object') return stableDiffString(item);
  const parts = [
    item.serialNumber,
    item.macAddress,
    item.model,
    item.name,
    item.product,
    item.manufacturer
  ].map(value => String(value == null ? '' : value).trim().toUpperCase()).filter(Boolean);
  return parts.length ? parts.join('|') : stableDiffString(item);
}

function stableDiffString(value) {
  if (Array.isArray(value)) return `[${value.map(stableDiffString).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableDiffString(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value == null ? '' : value);
}

function diffChangeLabel(type) {
  const zhLabels = { added: '\u65b0\u589e', removed: '\u79fb\u9664', changed: '\u53d8\u66f4' };
  const enLabels = { added: 'Added', removed: 'Removed', changed: 'Changed' };
  return currentLang === 'en-US' ? enLabels[type] || type : zhLabels[type] || type;
}

function emptyText() {
  return currentLang === 'en-US' ? 'No changed items' : '\u65e0\u53d8\u5316\u9879';
}

async function applyDiff(index) {
  const item = pendingDiffs[index];
  if (!item) return;
  const res = await authedFetch('/api/collect/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: item.request.id, computerName: item.report.computerName })
  });
  if (!res.ok) {
    alert(t('reviewDiffFailed', await res.text()));
    return;
  }
  alert(t('reviewDiffApplied'));
  await Promise.all([loadDiffs(), loadClientStatus()]);
}

async function discardDiff(index) {
  const item = pendingDiffs[index];
  if (!item) return;
  const noDiff = isNoDiffItem(item.report);
  const res = await authedFetch('/api/collect/discard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: item.request.id, computerName: item.report.computerName })
  });
  if (!res.ok) {
    alert(t('reviewDiffFailed', await res.text()));
    return;
  }
  alert(noDiff ? uiText('noDiffConfirmed') : t('reviewDiffDiscarded'));
  await loadDiffs();
}

function shortDiffValue(value) {
  const text = String(value == null || value === '' ? '-' : value);
  return text.length > 240 ? `${text.slice(0, 240)}...` : text;
}

function renderDiffValue(value) {
  const parsed = parseDiffValue(value);
  if (Array.isArray(parsed)) {
    if (!parsed.length) return `<div class="diffEmpty">-</div>`;
    return `<div class="diffItemList">${parsed.map(renderDiffListItem).join('')}</div>`;
  }
  if (parsed && typeof parsed === 'object') return renderDiffListItem(parsed);
  return `<code>${escapeHtml(shortDiffValue(parsed))}</code>`;
}

function parseDiffValue(value) {
  if (value == null || value === '') return '-';
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '-';
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { return JSON.parse(trimmed); }
    catch { }
  }
  return value;
}

function renderDiffListItem(item) {
  if (!item || typeof item !== 'object') return `<code>${escapeHtml(shortDiffValue(item))}</code>`;
  const title = item.model || item.name || item.product || item.manufacturer || item.serialNumber || '-';
  const details = Object.keys(item)
    .filter(key => item[key] != null && item[key] !== '' && key !== 'model' && key !== 'name')
    .map(key => `${fieldLabel(key)}: ${Array.isArray(item[key]) ? item[key].join(', ') : item[key]}`);
  return `<div class="diffItem">
    <strong>${escapeHtml(title)}</strong>
    ${details.length ? `<small>${escapeHtml(details.join(' / '))}</small>` : ''}
  </div>`;
}

function fieldLabel(key) {
  const labels = {
    serialNumber: 'SN',
    sizeText: '容量',
    sizeBytes: '字节',
    macAddress: 'MAC',
    ipAddresses: 'IP',
    manufacturer: '厂商',
    product: '型号'
  };
  return labels[key] || key;
}

async function saveClientDangerKey() {
  const value = String(clientKeyInput.value || '').trim();
  if (!value) {
    alert(t('clientKeyEmpty'));
    return;
  }
  const res = await authedFetch('/api/client-danger-key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: value })
  });
  if (!res.ok) {
    alert(t('clientKeySaveFailed', await res.text()));
    return;
  }
  clientKeyInput.value = '';
  alert(t('clientKeySaved'));
}

async function loadClientVersions() {
  versionStatusList.innerHTML = `<div class="emptyMini">${escapeHtml(t('loading'))}</div>`;
  const res = await authedFetch('/api/client/versions', { cache: 'no-store' });
  if (!res.ok) {
    versionStatusList.innerHTML = `<div class="emptyMini">${escapeHtml(t('versionLoadFailed', await res.text()))}</div>`;
    return;
  }
  const data = await res.json();
  renderClientVersionStatus(data.channels || {});
}

function renderClientVersionStatus(channels) {
  const items = [
    Object.assign({ label: t('versionWinTitle') }, channels.win || {}),
    Object.assign({ label: t('versionXpTitle') }, channels.xp || {})
  ];
  versionStatusList.innerHTML = items.map(item => `<div class="versionStatusItem">
    <strong>${escapeHtml(t('versionCurrent', item))}</strong>
    <small>${escapeHtml(t('versionMeta', item))}</small>
    ${item.exeUrl ? `<a href="${escapeHtml(item.exeUrl)}">${escapeHtml(item.exeUrl)}</a>` : ''}
  </div>`).join('');
  if (channels.win && channels.win.version) versionWinNumber.value = channels.win.version;
  if (channels.xp && channels.xp.version) versionXpNumber.value = channels.xp.version;
}

async function publishClientVersion(channel) {
  const fields = channel === 'xp'
    ? { version: versionXpNumber, exe: versionXpExe, config: versionXpConfig, notes: versionXpNotes }
    : { version: versionWinNumber, exe: versionWinExe, config: versionWinConfig, notes: versionWinNotes };
  const version = String(fields.version.value || '').trim();
  const exeFile = fields.exe.files && fields.exe.files[0];
  const configFile = fields.config.files && fields.config.files[0];
  if (!version || !exeFile) {
    alert(t('versionRequired'));
    return;
  }
  const payload = {
    flavor: channel,
    version,
    notes: fields.notes.value.trim(),
    exe: await fileToBase64Payload(exeFile),
    config: configFile ? await fileToBase64Payload(configFile) : null
  };
  const res = await authedFetch('/api/client/versions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    alert(t('versionPublishFailed', await res.text()));
    return;
  }
  fields.exe.value = '';
  fields.config.value = '';
  alert(t('versionPublishDone'));
  await loadClientVersions();
}

function fileToBase64Payload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      resolve({ name: file.name, contentBase64: comma >= 0 ? value.slice(comma + 1) : value });
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(currentLang === 'zh-CN' ? 'zh-CN' : 'en-US', { hour12: false });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function authedFetch(url, options) {
  const requestOptions = options || {};
  requestOptions.headers = Object.assign({}, requestOptions.headers || {});
  if (serverKey) requestOptions.headers['X-Asset-Server-Key'] = serverKey;
  let res = await fetch(url, requestOptions);
  if (res.status !== 401) return res;
  const key = prompt(t('authRequired'), serverKey);
  if (key == null) return res;
  serverKey = key.trim();
  localStorage.setItem('assetServerKey', serverKey);
  requestOptions.headers['X-Asset-Server-Key'] = serverKey;
  res = await fetch(url, requestOptions);
  if (res.status === 401) alert(t('authFailed'));
  return res;
}
