let currentLang = localStorage.getItem('assetManagerLang') || 'zh-CN';
let serverKey = localStorage.getItem('assetServerKey') || '';
let assets = [];
let organization = { units: [], flatUnits: [], stats: {} };
let selectedOrgChartCompany = localStorage.getItem('selectedOrgChartCompany') || '';
let collapsedOrgChartNodes = loadCollapsedOrgChartNodes();
let selectedOrgEditorId = '';
let selectedOrgEmployeeId = '';
let selectedReachabilityIps = new Set();
let reachabilityResults = [];
let reachabilityRunning = false;

const zh = {
  loading: '\u6b63\u5728\u52a0\u8f7d...',
  loadFailed: '\u52a0\u8f7d\u5931\u8d25',
  refresh: '\u5237\u65b0',
  backToAssets: '\u8fd4\u56de\u8d44\u4ea7\u6570\u636e',
  cancel: '\u53d6\u6d88',
  save: '\u4fdd\u5b58',
  authRequired: '\u8bf7\u8f93\u5165\u670d\u52a1\u7aef\u5bc6\u94a5',
  authFailed: '\u5bc6\u94a5\u9519\u8bef\u6216\u5df2\u8fc7\u671f',
  ipDetails: '\u0049\u0050 \u8be6\u60c5',
  ipUsageSummary: stats => `\u5171 ${stats.totalAssets} \u53f0\u8bbe\u5907\uff0c\u8bb0\u5f55 ${stats.totalIpEntries} \u4e2a IPv4\uff0c\u8986\u76d6 ${stats.subnetCount} \u4e2a\u7f51\u6bb5`,
  ipEmpty: '\u6682\u65e0 IPv4 \u8bb0\u5f55',
  ipMetricUnique: '\u552f\u4e00 IP',
  ipMetricDuplicate: '\u51b2\u7a81 IP',
  ipMetricSubnet: '\u7f51\u6bb5',
  ipMetricNoIp: '\u65e0 IPv4 \u8bbe\u5907',
  ipDuplicateTitle: '\u0049\u0050 \u51b2\u7a81',
  ipLinkLocalTitle: '\u81ea\u52a8\u79c1\u6709\u5730\u5740',
  ipNoAddressTitle: '\u672a\u8bb0\u5f55 IPv4',
  ipNoAlerts: '\u672a\u53d1\u73b0 IP \u5f02\u5e38',
  ipSubnetUsed: subnet => `${subnet.used}/${subnet.total} \u5df2\u7528`,
  ipSubnetFree: count => `${count} \u53ef\u7528`,
  ipReachabilityTitle: '\u4e3b\u673a\u7f51\u7edc\u53ef\u8fbe\u68c0\u6d4b',
  ipReachabilityInput: '\u5f85\u68c0\u6d4b IP',
  ipReachabilityPlaceholder: '\u6bcf\u884c\u4e00\u4e2a IP\uff0c\u4e5f\u53ef\u7528\u7a7a\u683c\u3001\u9017\u53f7\u5206\u9694',
  ipTestSelected: '\u68c0\u6d4b\u9009\u4e2d / \u8f93\u5165',
  ipTestAll: '\u68c0\u6d4b\u5168\u90e8\u5df2\u767b\u8bb0 IP',
  ipClearSelection: '\u6e05\u7a7a\u9009\u62e9',
  ipSelectedSummary: count => `\u5df2\u9009 ${count} \u4e2a IP`,
  ipReachabilityIdle: '\u70b9\u51fb\u7f51\u6bb5\u683c\u5b50\u6216\u8f93\u5165 IP \u540e\u5f00\u59cb\u68c0\u6d4b',
  ipReachabilityRunning: count => `\u6b63\u5728\u68c0\u6d4b ${count} \u4e2a IP...`,
  ipReachabilityDone: summary => `\u5171 ${summary.total || 0} \u4e2a\uff0c\u5728\u7ebf ${summary.online || 0}\uff0c\u79bb\u7ebf ${summary.offline || 0}`,
  ipReachabilityEmpty: '\u8bf7\u5148\u9009\u62e9\u6216\u8f93\u5165\u6709\u6548 IPv4 \u5730\u5740\u3002',
  ipReachabilityFailed: message => `\u68c0\u6d4b\u5931\u8d25\uff1a${message}`,
  ipStatusOnline: '\u5728\u7ebf',
  ipStatusOffline: '\u79bb\u7ebf',
  ipStatusError: '\u5f02\u5e38',
  ipLatency: '\u5ef6\u8fdf',
  ipCheckedAt: '\u68c0\u6d4b\u65f6\u95f4',
  ipReachableMessage: '\u4e3b\u673a\u53ef\u8fbe',
  ipNoResponseMessage: '\u8d85\u65f6\u672a\u54cd\u5e94',
  ipPingFailedMessage: '\u68c0\u6d4b\u5931\u8d25',
  ipOverviewTitle: '\u0049\u0050 \u8d44\u6e90\u6982\u89c8',
  ipOverviewHint: '\u5148\u67e5\u770b\u51b2\u7a81\u548c\u672a\u767b\u8bb0\u5730\u5740\uff0c\u518d\u70b9\u9009\u7f51\u6bb5\u683c\u5b50\u8fdb\u884c\u53ef\u8fbe\u68c0\u6d4b\u3002',
  ipLegendUsed: '\u5df2\u7528',
  ipLegendDuplicate: '\u51b2\u7a81',
  ipLegendSelected: '\u5df2\u9009',
  orgChartTitle: '\u7ec4\u7ec7\u56fe\u793a',
  orgChartSummary: stats => `${stats.totalUnits} \u4e2a\u8282\u70b9 / ${stats.totalEmployees || 0} \u4eba / ${stats.totalAssets} \u53f0\u8d44\u4ea7`,
  orgCompanySelectTitle: '\u9009\u62e9\u7ec4\u7ec7\u67b6\u6784',
  orgChartViewTitle: '\u7ec4\u7ec7\u6982\u89c8',
  orgChartViewHint: '\u70b9\u51fb\u8282\u70b9\u53ef\u8fdb\u5165\u7f16\u8f91\uff0c\u4f7f\u7528\u53f3\u4fa7\u63a7\u4ef6\u5feb\u901f\u5b9a\u4f4d\u548c\u6536\u5c55\u3002',
  orgCenterChart: '\u56de\u5230\u4e2d\u5fc3',
  orgExpandAll: '\u5168\u90e8\u5c55\u5f00',
  orgCollapseAll: '\u5168\u90e8\u6536\u8d77',
  manageOrg: '\u7ec4\u7ec7\u7ba1\u7406',
  orgTitle: '\u7ec4\u7ec7\u67b6\u6784',
  orgHint: '\u7ef4\u62a4\u7ec4\u7ec7\u8282\u70b9\u548c\u76f4\u5c5e\u5458\u5de5\uff0c\u4fdd\u5b58\u540e\u5ba2\u6237\u7aef\u90e8\u95e8\u5019\u9009\u4f1a\u540c\u6b65\u66f4\u65b0\u3002',
  orgPreviewTitle: '\u5f53\u524d\u7ed3\u6784',
  orgSelectNodeHint: '\u9009\u62e9\u5de6\u4fa7\u8282\u70b9\u540e\u7f16\u8f91',
  orgNodeInfoTitle: '\u8282\u70b9\u4fe1\u606f',
  orgNodeInfoHint: '\u5148\u5e94\u7528\u8282\u70b9\uff0c\u518d\u7edf\u4e00\u4fdd\u5b58',
  orgStats: stats => `\u5171 ${stats.totalUnits} \u4e2a\u7ec4\u7ec7\u8282\u70b9\uff0c${stats.totalEmployees || 0} \u4eba\uff0c${stats.totalAssets} \u53f0\u8d44\u4ea7`,
  orgEmpty: '\u6682\u65e0\u7ec4\u7ec7\u67b6\u6784',
  orgAssetCount: count => `${count} \u53f0\u8d44\u4ea7`,
  orgEmployeeCount: count => `${count} \u4eba`,
  orgDirectAssetCount: count => `\u76f4\u5c5e ${count}`,
  orgImport: '\u5bfc\u5165',
  orgExport: '\u5bfc\u51fa',
  orgType: '\u7c7b\u578b',
  orgCode: '\u7f16\u7801',
  orgName: '\u540d\u79f0',
  orgManager: '\u8d1f\u8d23\u4eba',
  orgParent: '\u4e0a\u7ea7\u8282\u70b9',
  orgRoot: '\u9876\u5c42',
  orgTypeCompany: '\u516c\u53f8',
  orgTypeBusinessUnit: '\u4e8b\u4e1a\u90e8',
  orgTypeDivision: '\u4e2d\u5fc3',
  orgTypeDepartment: '\u90e8\u95e8',
  orgTypeTeam: '\u5c0f\u7ec4',
  orgApplyNode: '\u5e94\u7528\u8282\u70b9',
  orgAddChild: '\u65b0\u589e\u4e0b\u7ea7',
  orgAddSibling: '\u65b0\u589e\u540c\u7ea7',
  orgDeleteNode: '\u5220\u9664\u8282\u70b9',
  orgAddCompany: '\u65b0\u589e\u516c\u53f8',
  orgAddDepartment: '\u65b0\u589e\u90e8\u95e8',
  orgAddTeam: '\u65b0\u589e\u5c0f\u7ec4',
  orgEmployees: '\u76f4\u5c5e\u5458\u5de5',
  orgEmployeeName: '\u59d3\u540d',
  orgEmployeeId: '\u5de5\u53f7',
  orgEmployeeTitle: '\u804c\u4f4d',
  orgEmployeePhone: '\u7535\u8bdd',
  orgEmployeeParent: '\u6240\u5c5e\u90e8\u95e8 / \u4e0a\u7ea7',
  orgAddEmployee: '\u65b0\u589e\u5458\u5de5',
  orgUpdateEmployee: '\u66f4\u65b0\u5458\u5de5',
  orgDeleteEmployee: '\u5220\u9664\u5458\u5de5',
  orgEmployeeEmpty: '\u5f53\u524d\u8282\u70b9\u6682\u65e0\u76f4\u5c5e\u5458\u5de5',
  orgAdvanced: '\u6279\u91cf\u6587\u672c\u7f16\u8f91',
  orgEditTitle: '\u7f16\u8f91\u7ed3\u6784\uff08\u7c7b\u578b | \u7f16\u7801 | \u540d\u79f0 | \u8d1f\u8d23\u4eba\uff09',
  orgTextPlaceholder: '\u516c\u53f8 | HQ | \u603b\u90e8 | \u5f20\u4e09\n  \u90e8\u95e8 | RD | \u7814\u53d1\u90e8 | \u674e\u56db',
  orgApplyText: '\u5e94\u7528\u6587\u672c',
  orgSelectNode: '\u8bf7\u5148\u9009\u62e9\u7ec4\u7ec7\u8282\u70b9\u3002',
  orgSelectEmployee: '\u8bf7\u5148\u9009\u62e9\u5458\u5de5\u3002',
  orgNameRequired: '\u7ec4\u7ec7\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002',
  orgEmployeeNameRequired: '\u5458\u5de5\u59d3\u540d\u4e0d\u80fd\u4e3a\u7a7a\u3002',
  orgDeleteConfirm: '\u786e\u5b9a\u5220\u9664\u8be5\u8282\u70b9\u53ca\u5176\u4e0b\u7ea7\u7ec4\u7ec7\u5417\uff1f',
  orgSaveFailed: message => `\u4fdd\u5b58\u7ec4\u7ec7\u67b6\u6784\u5931\u8d25\uff1a${message}`,
  orgImportFailed: message => `\u5bfc\u5165\u7ec4\u7ec7\u67b6\u6784\u5931\u8d25\uff1a${message}`
};

const en = {
  loading: 'Loading...',
  loadFailed: 'Load failed',
  refresh: 'Refresh',
  backToAssets: 'Back to Assets',
  cancel: 'Cancel',
  save: 'Save',
  authRequired: 'Enter server key',
  authFailed: 'Invalid or expired key',
  ipDetails: 'IP Details',
  ipUsageSummary: stats => `${stats.totalAssets} devices, ${stats.totalIpEntries} IPv4 entries, ${stats.subnetCount} subnet(s)`,
  ipEmpty: 'No IPv4 records',
  ipMetricUnique: 'Unique IPs',
  ipMetricDuplicate: 'Duplicate IPs',
  ipMetricSubnet: 'Subnets',
  ipMetricNoIp: 'No IPv4',
  ipDuplicateTitle: 'IP Conflicts',
  ipLinkLocalTitle: 'Link-local Addresses',
  ipNoAddressTitle: 'Missing IPv4',
  ipNoAlerts: 'No IP issues detected',
  ipSubnetUsed: subnet => `${subnet.used}/${subnet.total} used`,
  ipSubnetFree: count => `${count} free`,
  ipReachabilityTitle: 'Host Reachability Test',
  ipReachabilityInput: 'IPs to test',
  ipReachabilityPlaceholder: 'One IP per line, or separate with spaces and commas',
  ipTestSelected: 'Test Selected / Input',
  ipTestAll: 'Test All Recorded IPs',
  ipClearSelection: 'Clear Selection',
  ipSelectedSummary: count => `${count} IP(s) selected`,
  ipReachabilityIdle: 'Click subnet cells or enter IPs, then start a test',
  ipReachabilityRunning: count => `Testing ${count} IP(s)...`,
  ipReachabilityDone: summary => `${summary.total || 0} total, ${summary.online || 0} online, ${summary.offline || 0} offline`,
  ipReachabilityEmpty: 'Select or enter valid IPv4 addresses first.',
  ipReachabilityFailed: message => `Reachability test failed: ${message}`,
  ipStatusOnline: 'Online',
  ipStatusOffline: 'Offline',
  ipStatusError: 'Error',
  ipLatency: 'Latency',
  ipCheckedAt: 'Checked at',
  ipReachableMessage: 'Host reachable',
  ipNoResponseMessage: 'No response before timeout',
  ipPingFailedMessage: 'Test failed',
  ipOverviewTitle: 'IP Resource Overview',
  ipOverviewHint: 'Review conflicts and missing addresses first, then select subnet cells for reachability testing.',
  ipLegendUsed: 'Used',
  ipLegendDuplicate: 'Conflict',
  ipLegendSelected: 'Selected',
  orgChartTitle: 'Organization Chart',
  orgChartSummary: stats => `${stats.totalUnits} node(s) / ${stats.totalEmployees || 0} employee(s) / ${stats.totalAssets} asset(s)`,
  orgCompanySelectTitle: 'Select organization',
  orgChartViewTitle: 'Organization Overview',
  orgChartViewHint: 'Click a node to edit it. Use the controls to navigate and collapse large structures.',
  orgCenterChart: 'Center',
  orgExpandAll: 'Expand All',
  orgCollapseAll: 'Collapse All',
  manageOrg: 'Manage Organization',
  orgTitle: 'Organization',
  orgHint: 'Maintain organization nodes and direct employees. Client department choices update after saving.',
  orgPreviewTitle: 'Current Structure',
  orgSelectNodeHint: 'Select a node on the left to edit',
  orgNodeInfoTitle: 'Node Info',
  orgNodeInfoHint: 'Apply node changes before saving',
  orgStats: stats => `${stats.totalUnits} org unit(s), ${stats.totalEmployees || 0} employee(s), ${stats.totalAssets} asset(s)`,
  orgEmpty: 'No organization structure',
  orgAssetCount: count => `${count} asset(s)`,
  orgEmployeeCount: count => `${count} employee(s)`,
  orgDirectAssetCount: count => `Direct ${count}`,
  orgImport: 'Import',
  orgExport: 'Export',
  orgType: 'Type',
  orgCode: 'Code',
  orgName: 'Name',
  orgManager: 'Manager',
  orgParent: 'Parent',
  orgRoot: 'Root',
  orgTypeCompany: 'Company',
  orgTypeBusinessUnit: 'Business Unit',
  orgTypeDivision: 'Division',
  orgTypeDepartment: 'Department',
  orgTypeTeam: 'Team',
  orgApplyNode: 'Apply Node',
  orgAddChild: 'Add Child',
  orgAddSibling: 'Add Sibling',
  orgDeleteNode: 'Delete Node',
  orgAddCompany: 'Add Company',
  orgAddDepartment: 'Add Department',
  orgAddTeam: 'Add Team',
  orgEmployees: 'Employees',
  orgEmployeeName: 'Name',
  orgEmployeeId: 'Employee ID',
  orgEmployeeTitle: 'Title',
  orgEmployeePhone: 'Phone',
  orgEmployeeParent: 'Department / Parent',
  orgAddEmployee: 'Add Employee',
  orgUpdateEmployee: 'Update Employee',
  orgDeleteEmployee: 'Delete Employee',
  orgEmployeeEmpty: 'No direct employees in this node',
  orgAdvanced: 'Batch Text Edit',
  orgEditTitle: 'Edit Structure (type | code | name | manager)',
  orgTextPlaceholder: 'Company | HQ | Head Office | Alex\n  Department | RD | R&D | Lee',
  orgApplyText: 'Apply Text',
  orgSelectNode: 'Select an organization node first.',
  orgSelectEmployee: 'Select an employee first.',
  orgNameRequired: 'Organization name is required.',
  orgEmployeeNameRequired: 'Employee name is required.',
  orgDeleteConfirm: 'Delete this node and all child units?',
  orgSaveFailed: message => `Save organization failed: ${message}`,
  orgImportFailed: message => `Import organization failed: ${message}`
};

const translations = { 'zh-CN': zh, 'en-US': en };
const page = document.body.getAttribute('data-page') || '';
const languageSelect = document.getElementById('languageSelect');
const refreshBtn = document.getElementById('refreshBtn');
const detailSummary = document.getElementById('detailSummary');
const ipMetricGrid = document.getElementById('ipMetricGrid');
const subnetUsageList = document.getElementById('subnetUsageList');
const ipAlertList = document.getElementById('ipAlertList');
const ipReachabilityInput = document.getElementById('ipReachabilityInput');
const ipReachabilitySummary = document.getElementById('ipReachabilitySummary');
const ipReachabilityResults = document.getElementById('ipReachabilityResults');
const orgChart = document.getElementById('orgChart');
const orgCompanySelect = document.getElementById('orgCompanySelect');
const orgModal = document.getElementById('orgModal');
const orgSummary = document.getElementById('orgSummary');
const orgTree = document.getElementById('orgTree');
const orgText = document.getElementById('orgText');
const orgImportFile = document.getElementById('orgImportFile');
const orgType = document.getElementById('orgType');
const orgCode = document.getElementById('orgCode');
const orgName = document.getElementById('orgName');
const orgManager = document.getElementById('orgManager');
const orgParent = document.getElementById('orgParent');
const orgEmployeeList = document.getElementById('orgEmployeeList');
const orgEmployeeCount = document.getElementById('orgEmployeeCount');
const orgEmployeeName = document.getElementById('orgEmployeeName');
const orgEmployeeId = document.getElementById('orgEmployeeId');
const orgEmployeeTitle = document.getElementById('orgEmployeeTitle');
const orgEmployeePhone = document.getElementById('orgEmployeePhone');
const orgEmployeeParent = document.getElementById('orgEmployeeParent');

languageSelect.value = currentLang;
languageSelect.addEventListener('change', () => {
  currentLang = languageSelect.value;
  localStorage.setItem('assetManagerLang', currentLang);
  applyLanguage();
  renderCurrentPage();
});
refreshBtn.addEventListener('click', loadDetailPage);
bindOptionalClick('ipTestSelectedBtn', () => runReachabilityTest());
bindOptionalClick('ipTestAllBtn', () => runReachabilityTest(allRecordedIps()));
bindOptionalClick('ipClearSelectionBtn', clearReachabilitySelection);
if (ipReachabilityInput) ipReachabilityInput.addEventListener('input', renderReachabilitySummary);
bindOptionalClick('manageOrgBtn', openOrgModal);
bindOptionalClick('orgCenterChartBtn', () => centerOrgChartOnRoot(true));
bindOptionalClick('orgExpandAllBtn', expandOrgChartAll);
bindOptionalClick('orgCollapseAllBtn', collapseOrgChartAll);
bindOptionalClick('orgCancelTopBtn', closeOrgModal);
bindOptionalClick('orgCancelBtn', closeOrgModal);
bindOptionalClick('orgSaveBtn', saveOrganization);
bindOptionalClick('orgApplyNodeBtn', applyOrgNodeEdit);
bindOptionalClick('orgAddChildBtn', addOrgChild);
bindOptionalClick('orgAddSiblingBtn', addOrgSibling);
bindOptionalClick('orgDeleteNodeBtn', deleteOrgNode);
bindOptionalClick('orgAddCompanyBtn', addOrgCompany);
bindOptionalClick('orgAddDepartmentBtn', () => addTypedOrgChildOrRoot('department'));
bindOptionalClick('orgAddTeamBtn', () => addTypedOrgChildOrRoot('team'));
bindOptionalClick('orgAddEmployeeBtn', addOrgEmployee);
bindOptionalClick('orgUpdateEmployeeBtn', updateOrgEmployee);
bindOptionalClick('orgDeleteEmployeeBtn', deleteOrgEmployee);
bindOptionalClick('orgApplyTextBtn', applyOrgText);
bindOptionalClick('orgImportBtn', () => orgImportFile && orgImportFile.click());
bindOptionalClick('orgExportBtn', exportOrganization);
if (orgImportFile) orgImportFile.addEventListener('change', importOrganization);
if (orgCompanySelect) {
  orgCompanySelect.addEventListener('change', () => {
    selectedOrgChartCompany = orgCompanySelect.value;
    localStorage.setItem('selectedOrgChartCompany', selectedOrgChartCompany);
    renderOrgPage();
  });
}

function bindOptionalClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}

applyLanguage();
loadDetailPage().catch(showError);

function t(key, arg) {
  const value = (translations[currentLang] || zh)[key] || key;
  return typeof value === 'function' ? value(arguments.length > 1 ? arg : {}) : value;
}

function applyLanguage() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
}

async function loadDetailPage() {
  if (detailSummary) detailSummary.textContent = t('loading');
  const assetRes = await authedFetch('/api/assets', { cache: 'no-store' });
  if (!assetRes.ok) throw new Error(await assetRes.text());
  assets = await assetRes.json();

  if (page === 'org') {
    const orgRes = await authedFetch('/api/org', { cache: 'no-store' });
    if (!orgRes.ok) throw new Error(await orgRes.text());
    organization = normalizeOrganization(await orgRes.json());
    if (!selectedOrgEditorId) selectedOrgEditorId = firstOrgUnitId(organization.units);
  }

  renderCurrentPage();
}

function renderCurrentPage() {
  if (page === 'org') renderOrgPage();
  else renderIpPage();
}

function showError(error) {
  if (detailSummary) detailSummary.textContent = `${t('loadFailed')}: ${error && error.message ? error.message : error}`;
}

function renderIpPage() {
  if (!ipMetricGrid || !subnetUsageList || !ipAlertList) return;
  const stats = buildIpStats(assets);
  if (detailSummary) detailSummary.textContent = stats.totalIpEntries ? t('ipUsageSummary', stats) : t('ipEmpty');
  ipMetricGrid.innerHTML = [
    renderMetric(t('ipMetricUnique'), stats.uniqueIpCount),
    renderMetric(t('ipMetricDuplicate'), stats.duplicateIpCount, stats.duplicateIpCount ? 'warn' : ''),
    renderMetric(t('ipMetricSubnet'), stats.subnetCount),
    renderMetric(t('ipMetricNoIp'), stats.noIpAssets.length, stats.noIpAssets.length ? 'warn' : '')
  ].join('');
  subnetUsageList.innerHTML = stats.subnets.length
    ? stats.subnets.map(renderSubnetUsage).join('')
    : `<div class="emptyInline">${escapeHtml(t('ipEmpty'))}</div>`;
  subnetUsageList.querySelectorAll('[data-ip-select]').forEach(button => {
    button.addEventListener('click', () => toggleReachabilityIp(button.getAttribute('data-ip-select')));
  });
  const alerts = [];
  if (stats.duplicates.length) {
    alerts.push(renderIpAlertBlock(t('ipDuplicateTitle'), stats.duplicates.map(item => `${item.ip}: ${item.entries.map(entry => assetLabel(entry.asset)).join(' / ')}`)));
  }
  if (stats.linkLocalEntries.length) {
    alerts.push(renderIpAlertBlock(t('ipLinkLocalTitle'), stats.linkLocalEntries.map(entry => `${entry.ip}: ${assetLabel(entry.asset)}`)));
  }
  if (stats.noIpAssets.length) {
    alerts.push(renderIpAlertBlock(t('ipNoAddressTitle'), stats.noIpAssets.map(assetLabel)));
  }
  ipAlertList.innerHTML = alerts.length ? alerts.join('') : `<div class="ipAlert ok">${escapeHtml(t('ipNoAlerts'))}</div>`;
  renderReachabilitySummary();
  renderReachabilityResults();
}

function renderMetric(label, value, tone) {
  return `<div class="metric ${escapeHtml(tone || '')}">
    <div class="metricValue">${escapeHtml(value)}</div>
    <div class="metricLabel">${escapeHtml(label)}</div>
  </div>`;
}

function renderSubnetUsage(subnet) {
  const usedPercent = subnet.total ? Math.min(100, Math.round(subnet.used / subnet.total * 100)) : 0;
  const duplicateCount = Array.from(subnet.hosts.values()).filter(entry => entry.count > 1).length;
  const cells = [];
  for (let host = 1; host <= subnet.total; host++) {
    const entry = subnet.hosts.get(host);
    const classes = ['ipCell'];
    if (entry) {
      classes.push(entry.count > 1 ? 'duplicate' : 'used');
      if (selectedReachabilityIps.has(entry.ip)) classes.push('selected');
      const result = reachabilityResults.find(item => item.ip === entry.ip);
      if (result) classes.push(`reachability-${result.status}`);
    }
    const title = entry ? `${entry.ip} - ${entry.entries.map(item => assetLabel(item.asset)).join(' / ')}` : `${subnet.prefix}.${host}`;
    cells.push(entry
      ? `<button class="${classes.join(' ')}" type="button" title="${escapeHtml(title)}" data-ip-select="${escapeHtml(entry.ip)}" aria-label="${escapeHtml(title)}"></button>`
      : `<span class="${classes.join(' ')}" title="${escapeHtml(title)}"></span>`);
  }
  return `<article class="subnetCard">
    <div class="subnetHeader">
      <div>
        <strong>${escapeHtml(subnet.name)}</strong>
        <small>${escapeHtml(t('ipSubnetUsed', subnet))}</small>
      </div>
      <div class="subnetMeta">
        <span>${usedPercent}%</span>
        ${duplicateCount ? `<span class="warn">${escapeHtml(t('ipMetricDuplicate'))}: ${duplicateCount}</span>` : ''}
        <span>${escapeHtml(t('ipSubnetFree', subnet.total - subnet.used))}</span>
      </div>
    </div>
    <div class="usageBar"><span style="width: ${usedPercent}%"></span></div>
    <div class="ipGrid">${cells.join('')}</div>
  </article>`;
}

function renderIpAlertBlock(title, lines) {
  return `<div class="ipAlert">
    <strong>${escapeHtml(title)}</strong>
    ${lines.slice(0, 12).map(line => `<small>${escapeHtml(line)}</small>`).join('')}
    ${lines.length > 12 ? `<small>${escapeHtml(`+${lines.length - 12}`)}</small>` : ''}
  </div>`;
}

function allRecordedIps() {
  const ips = [];
  (assets || []).forEach(asset => {
    (asset.networkAdapters || []).forEach(nic => {
      (nic.ipAddresses || []).filter(isIpv4).forEach(ip => ips.push(ip));
    });
  });
  return uniqueIps(ips);
}

function uniqueIps(values) {
  const seen = new Set();
  return (values || [])
    .map(value => String(value || '').trim())
    .filter(isIpv4)
    .filter(ip => {
      if (seen.has(ip)) return false;
      seen.add(ip);
      return true;
    })
    .sort(compareIp);
}

function inputReachabilityIps() {
  return uniqueIps(String(ipReachabilityInput ? ipReachabilityInput.value : '').split(/[\s,;，；]+/));
}

function selectedAndInputReachabilityIps() {
  return uniqueIps(Array.from(selectedReachabilityIps).concat(inputReachabilityIps()));
}

function toggleReachabilityIp(ip) {
  if (!isIpv4(ip)) return;
  if (selectedReachabilityIps.has(ip)) selectedReachabilityIps.delete(ip);
  else selectedReachabilityIps.add(ip);
  renderIpPage();
}

function clearReachabilitySelection() {
  selectedReachabilityIps = new Set();
  reachabilityResults = [];
  if (ipReachabilityInput) ipReachabilityInput.value = '';
  renderIpPage();
}

function renderReachabilitySummary() {
  ['ipTestSelectedBtn', 'ipTestAllBtn'].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.disabled = reachabilityRunning;
  });
  if (!ipReachabilitySummary) return;
  if (reachabilityRunning) {
    ipReachabilitySummary.textContent = t('ipReachabilityRunning', selectedAndInputReachabilityIps().length);
    return;
  }
  if (reachabilityResults.length) {
    ipReachabilitySummary.textContent = t('ipReachabilityDone', summarizeReachability(reachabilityResults));
    return;
  }
  const count = selectedAndInputReachabilityIps().length;
  ipReachabilitySummary.textContent = count ? t('ipSelectedSummary', count) : t('ipReachabilityIdle');
}

function summarizeReachability(results) {
  return (results || []).reduce((summary, item) => {
    summary.total++;
    summary[item.status] = (summary[item.status] || 0) + 1;
    return summary;
  }, { total: 0, online: 0, offline: 0, error: 0 });
}

function renderReachabilityResults() {
  if (!ipReachabilityResults) return;
  if (!reachabilityResults.length) {
    ipReachabilityResults.innerHTML = '';
    return;
  }
  const summary = summarizeReachability(reachabilityResults);
  const rows = reachabilityResults
    .slice()
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || compareIp(a.ip, b.ip))
    .map(item => {
      const assetNames = assetLabelsByIp(item.ip);
      const latency = item.latencyMs == null ? '-' : `${item.latencyMs} ms`;
      return `<tr class="reachabilityRow ${escapeHtml(item.status)}">
        <td><span class="reachabilityStatus ${escapeHtml(item.status)}">${escapeHtml(reachabilityStatusLabel(item.status))}</span></td>
        <td><strong>${escapeHtml(item.ip)}</strong>${assetNames ? `<small>${escapeHtml(assetNames)}</small>` : ''}</td>
        <td>${escapeHtml(latency)}</td>
        <td>${escapeHtml(formatTime(item.checkedAt))}</td>
        <td>${escapeHtml(reachabilityMessage(item))}</td>
      </tr>`;
    }).join('');
  ipReachabilityResults.innerHTML = `<div class="reachabilityResultHeader">
      <span class="reachabilityStatus online">${escapeHtml(t('ipStatusOnline'))}: ${summary.online || 0}</span>
      <span class="reachabilityStatus offline">${escapeHtml(t('ipStatusOffline'))}: ${summary.offline || 0}</span>
      ${summary.error ? `<span class="reachabilityStatus error">${escapeHtml(t('ipStatusError'))}: ${summary.error}</span>` : ''}
    </div>
    <div class="reachabilityTableWrap">
      <table class="reachabilityTable">
        <thead><tr><th></th><th>IP</th><th>${escapeHtml(t('ipLatency'))}</th><th>${escapeHtml(t('ipCheckedAt'))}</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function statusRank(status) {
  return { offline: 0, error: 1, online: 2 }[status] == null ? 3 : { offline: 0, error: 1, online: 2 }[status];
}

function reachabilityStatusLabel(status) {
  if (status === 'online') return t('ipStatusOnline');
  if (status === 'error') return t('ipStatusError');
  return t('ipStatusOffline');
}

function reachabilityMessage(item) {
  if (!item) return '';
  if (item.reason === 'reachable' || item.status === 'online') return t('ipReachableMessage');
  if (item.reason === 'timeout' || item.reason === 'no-response' || item.status === 'offline') return t('ipNoResponseMessage');
  if (item.reason === 'error' || item.status === 'error') return t('ipPingFailedMessage');
  const message = String(item.message || '');
  return message.includes('\ufffd') ? t('ipPingFailedMessage') : message;
}

function assetLabelsByIp(ip) {
  const labels = [];
  (assets || []).forEach(asset => {
    const hasIp = (asset.networkAdapters || []).some(nic => (nic.ipAddresses || []).includes(ip));
    if (hasIp) labels.push(assetLabel(asset));
  });
  return labels.join(' / ');
}

function formatTime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return value;
  }
}

async function runReachabilityTest(explicitIps) {
  const ips = uniqueIps(explicitIps || selectedAndInputReachabilityIps());
  if (!ips.length) {
    alert(t('ipReachabilityEmpty'));
    return;
  }
  reachabilityRunning = true;
  reachabilityResults = [];
  if (!explicitIps) selectedReachabilityIps = new Set(ips);
  renderIpPage();
  try {
    const res = await authedFetch('/api/ip/reachability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ips })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || res.statusText);
    reachabilityResults = Array.isArray(data.results) ? data.results : [];
    selectedReachabilityIps = new Set(ips);
  } catch (err) {
    alert(t('ipReachabilityFailed', err && err.message ? err.message : String(err)));
  } finally {
    reachabilityRunning = false;
    renderIpPage();
  }
}

function buildIpStats(items) {
  const entries = [];
  const noIpAssets = [];
  (items || []).forEach(asset => {
    const ips = [];
    (asset.networkAdapters || []).forEach(nic => {
      (nic.ipAddresses || []).filter(isIpv4).forEach(ip => ips.push({ ip, nic }));
    });
    if (!ips.length) noIpAssets.push(asset);
    ips.forEach(item => entries.push({ ip: item.ip, asset, nic: item.nic }));
  });
  const byIp = new Map();
  entries.forEach(entry => {
    if (!byIp.has(entry.ip)) byIp.set(entry.ip, []);
    byIp.get(entry.ip).push(entry);
  });
  const subnets = new Map();
  byIp.forEach((ipEntries, ip) => {
    const parts = ip.split('.').map(Number);
    const prefix = parts.slice(0, 3).join('.');
    const host = parts[3];
    if (!subnets.has(prefix)) {
      subnets.set(prefix, { name: `${prefix}.0/24`, prefix, total: 254, used: 0, hosts: new Map() });
    }
    const subnet = subnets.get(prefix);
    subnet.used++;
    subnet.hosts.set(host, { ip, count: ipEntries.length, entries: ipEntries });
  });
  return {
    totalAssets: (items || []).length,
    totalIpEntries: entries.length,
    uniqueIpCount: byIp.size,
    duplicateIpCount: Array.from(byIp.values()).filter(ipEntries => ipEntries.length > 1).length,
    subnetCount: subnets.size,
    duplicates: Array.from(byIp.entries()).filter(([, ipEntries]) => ipEntries.length > 1).map(([ip, ipEntries]) => ({ ip, entries: ipEntries })).sort((a, b) => compareIp(a.ip, b.ip)),
    noIpAssets,
    linkLocalEntries: entries.filter(entry => entry.ip.startsWith('169.254.')),
    subnets: Array.from(subnets.values()).sort((a, b) => compareIp(`${a.prefix}.0`, `${b.prefix}.0`))
  };
}

function renderOrgPage() {
  if (!orgChart) return;
  const companies = orgCompanyRoots();
  if (orgCompanySelect) {
    if (companies.length > 1) {
      orgCompanySelect.hidden = false;
      orgCompanySelect.innerHTML = companies.map(company => {
        const value = company.id || company.name;
        return `<option value="${escapeHtml(value)}">${escapeHtml(company.name)}</option>`;
      }).join('');
      orgCompanySelect.value = companies.some(company => (company.id || company.name) === selectedOrgChartCompany)
        ? selectedOrgChartCompany
        : (companies[0].id || companies[0].name);
      selectedOrgChartCompany = orgCompanySelect.value;
    } else {
      orgCompanySelect.hidden = true;
      orgCompanySelect.innerHTML = '';
    }
  }
  if (detailSummary) detailSummary.textContent = t('orgChartSummary', organization.stats || buildOrgStats(organization.units));
  const roots = orgChartRootUnits();
  orgChart.innerHTML = roots && roots.length
    ? `<div class="orgChartScroller"><ul class="orgChartLevel orgChartRootLevel">${roots.map(unit => renderOrgChartNode(unit, 0)).join('')}</ul></div>`
    : `<div class="emptyInline">${escapeHtml(t('orgEmpty'))}</div>`;
  centerOrgChartOnRoot();
  orgChart.querySelectorAll('[data-org-chart-node-id]').forEach(button => {
    button.addEventListener('click', event => {
      const key = button.getAttribute('data-org-toggle-id') || '';
      if (key && event.target.closest('.orgChartToggle')) {
        toggleOrgChartNode(key);
        return;
      }
      selectOrgChartNode(button.getAttribute('data-org-chart-node-id'));
    });
  });
  renderOrgEditor();
}

function centerOrgChartOnRoot(force) {
  if (!orgChart) return;
  if (!force && orgChart.dataset.centered === '1') return;
  const root = orgChart.querySelector('.orgChartRootLevel > .orgChartItem > .orgChartNode');
  if (!root) return;
  requestAnimationFrame(() => {
    const chartRect = orgChart.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const target = orgChart.scrollLeft + rootRect.left - chartRect.left - (chartRect.width - rootRect.width) / 2;
    orgChart.scrollLeft = Math.max(0, target);
    orgChart.dataset.centered = '1';
  });
}

function expandOrgChartAll() {
  collapsedOrgChartNodes.clear();
  saveCollapsedOrgChartNodes();
  if (orgChart) orgChart.dataset.centered = '';
  renderOrgPage();
}

function collapseOrgChartAll() {
  collapsedOrgChartNodes = new Set(collectCollapsibleOrgChartKeys(orgChartRootUnits()));
  saveCollapsedOrgChartNodes();
  if (orgChart) orgChart.dataset.centered = '';
  renderOrgPage();
}

function collectCollapsibleOrgChartKeys(units) {
  const keys = [];
  function visit(list) {
    (list || []).forEach(unit => {
      if (unit.children && unit.children.length) keys.push(orgChartNodeKey(unit));
      visit(unit.children);
    });
  }
  visit(units);
  return keys;
}

function loadCollapsedOrgChartNodes() {
  try {
    const values = JSON.parse(localStorage.getItem('collapsedOrgChartNodes') || '[]');
    return new Set(Array.isArray(values) ? values.map(value => String(value)) : []);
  } catch {
    return new Set();
  }
}

function saveCollapsedOrgChartNodes() {
  localStorage.setItem('collapsedOrgChartNodes', JSON.stringify(Array.from(collapsedOrgChartNodes)));
}

function orgChartNodeKey(unit) {
  return String((unit && (unit.id || unit.name)) || '');
}

function toggleOrgChartNode(key) {
  if (!key) return;
  if (collapsedOrgChartNodes.has(key)) collapsedOrgChartNodes.delete(key);
  else collapsedOrgChartNodes.add(key);
  saveCollapsedOrgChartNodes();
  if (orgChart) orgChart.dataset.centered = '';
  renderOrgPage();
}

function selectOrgChartNode(id) {
  const info = findOrgNodeInfo(id);
  if (!info) return;
  selectedOrgEditorId = info.unit.id;
  selectedOrgEmployeeId = '';
  if (orgModal && orgModal.hidden) {
    orgModal.hidden = false;
    if (orgName) requestAnimationFrame(() => orgName.focus());
  }
  renderOrgPage();
}

function renderOrgEditor() {
  if (orgSummary) orgSummary.textContent = t('orgStats', organization.stats || buildOrgStats(organization.units));
  if (orgTree) {
    orgTree.innerHTML = renderOrgTree(organization.units);
    orgTree.querySelectorAll('[data-org-node-id]').forEach(button => {
      button.addEventListener('click', () => selectOrgNode(button.getAttribute('data-org-node-id')));
    });
  }
  if (orgText && orgModal && !orgModal.hidden) orgText.value = serializeOrgText(organization.units);
  fillOrgNodeEditor();
  renderOrgEmployeeEditor();
}

function openOrgModal() {
  if (!orgModal) return;
  if (!selectedOrgEditorId) selectedOrgEditorId = firstOrgUnitId(organization.units);
  if (orgText) orgText.value = serializeOrgText(organization.units);
  orgModal.hidden = false;
  renderOrgEditor();
  if (orgName) orgName.focus();
}

function closeOrgModal() {
  if (orgModal) orgModal.hidden = true;
}

function renderOrgTree(units) {
  if (!units || !units.length) return `<div class="emptyMini">${escapeHtml(t('orgEmpty'))}</div>`;
  return `<ul>${units.map(unit => renderOrgTreeNode(unit)).join('')}</ul>`;
}

function renderOrgTreeNode(unit) {
  const count = organizationAssetCount(unit);
  const directCount = assets.filter(asset => assetDepartment(asset).toLowerCase() === String(unit.name || '').toLowerCase()).length;
  const employeeCount = organizationEmployeeCount(unit);
  const meta = [orgTypeLabel(unit.type), unit.code, unit.manager].filter(Boolean).join(' / ');
  return `<li>
    <button class="orgNode ${unit.id === selectedOrgEditorId ? 'selectedOrgNode' : ''}" type="button" data-org-node-id="${escapeHtml(unit.id)}">
      <span class="orgNodeName">${escapeHtml(unit.name)}</span>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
      <em>${escapeHtml(t('orgAssetCount', count))}${employeeCount ? ` / ${escapeHtml(t('orgEmployeeCount', employeeCount))}` : ''}${directCount !== count ? ` / ${escapeHtml(t('orgDirectAssetCount', directCount))}` : ''}</em>
    </button>
    ${unit.children && unit.children.length ? `<ul>${unit.children.map(child => renderOrgTreeNode(child)).join('')}</ul>` : ''}
  </li>`;
}

function orgTypeLabel(type) {
  const labels = {
    company: t('orgTypeCompany'),
    'business-unit': t('orgTypeBusinessUnit'),
    division: t('orgTypeDivision'),
    department: t('orgTypeDepartment'),
    team: t('orgTypeTeam')
  };
  return labels[normalizeOrgType(type)] || labels.department;
}

function normalizeOrganization(input) {
  const units = normalizeOrgUnits(input && input.units);
  return { units, flatUnits: flattenOrgUnits(units), stats: Object.assign({}, buildOrgStats(units), input && input.stats ? input.stats : {}) };
}

function normalizeOrgUnits(units) {
  const seen = new Set();
  function visit(list, parentPath = '') {
    if (!Array.isArray(list)) return [];
    return list.map((unit, index) => {
      const name = String((unit || {}).name || '').trim();
      if (!name) return null;
      const pathKey = parentPath ? `${parentPath}/${name}` : name;
      const fallbackId = `org-${hashText(`${pathKey}-${index}`)}`;
      let id = String((unit || {}).id || fallbackId).trim();
      while (seen.has(id.toLowerCase())) id = `${fallbackId}-${seen.size}`;
      seen.add(id.toLowerCase());
      return {
        id,
        type: normalizeOrgType((unit || {}).type),
        code: String((unit || {}).code || '').trim(),
        name,
        manager: String((unit || {}).manager || '').trim(),
        employees: normalizeOrgEmployees(unit.employees, pathKey),
        children: visit((unit || {}).children, pathKey)
      };
    }).filter(Boolean);
  }
  return visit(units);
}

function normalizeOrgEmployees(employees, parentKey = '') {
  const seen = new Set();
  return (Array.isArray(employees) ? employees : [])
    .map((employee, index) => {
      if (!employee || typeof employee !== 'object') return null;
      const name = String(employee.name || '').trim();
      const employeeId = String(employee.employeeId || employee.id || '').trim();
      if (!name && !employeeId) return null;
      const fallbackId = `emp-${hashText(`${parentKey}-${name}-${employeeId}-${index}`)}`;
      let id = String(employee.id || fallbackId).trim();
      while (seen.has(id.toLowerCase())) id = `${fallbackId}-${seen.size}`;
      seen.add(id.toLowerCase());
      return {
        id,
        name,
        employeeId,
        title: String(employee.title || '').trim(),
        phone: String(employee.phone || '').trim()
      };
    })
    .filter(Boolean);
}

function flattenOrgUnits(units, depth = 0) {
  return (units || []).flatMap(unit => [{ id: unit.id, type: unit.type, name: unit.name, depth }, ...flattenOrgUnits(unit.children, depth + 1)]);
}

function orgCompanyRoots() {
  return (organization.units || []).filter(unit => normalizeOrgType(unit.type) === 'company');
}

function orgChartRootUnits() {
  const companies = orgCompanyRoots();
  if (companies.length <= 1) {
    return organization.units || [];
  }
  let selected = companies.find(unit => unit.id === selectedOrgChartCompany || unit.name === selectedOrgChartCompany);
  if (!selected) selected = companies[0];
  selectedOrgChartCompany = selected ? selected.id : '';
  localStorage.setItem('selectedOrgChartCompany', selectedOrgChartCompany);
  return selected ? [selected] : organization.units || [];
}

function renderOrgChartNode(unit, depth = 0) {
  const count = organizationAssetCount(unit);
  const directCount = assets.filter(asset => assetDepartment(asset).toLowerCase() === String(unit.name || '').toLowerCase()).length;
  const employeeCount = organizationEmployeeCount(unit);
  const meta = [unit.code, unit.manager].filter(Boolean).join(' / ');
  const children = unit.children || [];
  const key = orgChartNodeKey(unit);
  const collapsed = children.length > 0 && collapsedOrgChartNodes.has(key);
  const type = normalizeOrgType(unit.type);
  const selected = unit.id === selectedOrgEditorId;
  return `<li class="orgChartItem ${children.length ? 'hasChildren' : 'isLeaf'} ${collapsed ? 'isCollapsed' : ''}" data-depth="${depth}">
    <button class="orgChartNode orgChartType-${escapeHtml(type)} ${selected ? 'selectedOrgChartNode' : ''}" type="button" data-org-chart-node-id="${escapeHtml(unit.id)}" ${children.length ? `data-org-toggle-id="${escapeHtml(key)}" aria-expanded="${collapsed ? 'false' : 'true'}"` : ''}>
      ${children.length ? `<span class="orgChartToggle" aria-hidden="true">${collapsed ? '+' : '-'}</span>` : ''}
      <span class="orgChartTypeLabel">${escapeHtml(orgTypeLabel(type))}</span>
      <strong>${escapeHtml(unit.name)}</strong>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
      <span class="orgChartStats">${escapeHtml(orgChartStatsText(count, employeeCount, directCount))}</span>
    </button>
    ${children.length && !collapsed ? `<ul class="orgChartLevel">${children.map(child => renderOrgChartNode(child, depth + 1)).join('')}</ul>` : ''}
  </li>`;
}

function orgChartStatsText(assetCount, employeeCount, directAssetCount) {
  const parts = [];
  parts.push(t('orgAssetCount', assetCount));
  if (employeeCount) parts.push(t('orgEmployeeCount', employeeCount));
  if (directAssetCount !== assetCount) parts.push(t('orgDirectAssetCount', directAssetCount));
  return parts.join(' · ');
}

function firstOrgUnitId(units) {
  const first = (units || [])[0];
  return first ? first.id : '';
}

function findOrgNodeInfo(id) {
  const target = String(id || '');
  let result = null;
  function visit(list, parent) {
    (list || []).some((unit, index) => {
      if (unit.id === target) {
        result = { unit, parent, siblings: list, index };
        return true;
      }
      visit(unit.children, unit);
      return Boolean(result);
    });
  }
  visit(organization.units, null);
  return result;
}

function selectOrgNode(id) {
  selectedOrgEditorId = id || '';
  selectedOrgEmployeeId = '';
  renderOrgEditor();
}

function fillOrgNodeEditor() {
  const info = findOrgNodeInfo(selectedOrgEditorId);
  const unit = info && info.unit;
  if (orgType) orgType.value = unit ? normalizeOrgType(unit.type) : 'department';
  if (orgCode) orgCode.value = unit ? unit.code || '' : '';
  if (orgName) orgName.value = unit ? unit.name || '' : '';
  if (orgManager) orgManager.value = unit ? unit.manager || '' : '';
  fillOrgParentOptions(info);
}

function fillOrgParentOptions(info) {
  if (!orgParent) return;
  const selectedUnit = info && info.unit;
  const blockedIds = selectedUnit ? collectOrgDescendantIds(selectedUnit) : new Set();
  if (selectedUnit) blockedIds.add(selectedUnit.id);
  const nodes = flattenOrgUnits(organization.units).filter(node => !blockedIds.has(node.id));
  orgParent.innerHTML = `<option value="">${escapeHtml(t('orgRoot'))}</option>` + nodes.map(node => {
    const prefix = node.depth > 0 ? `${'  '.repeat(node.depth)}` : '';
    return `<option value="${escapeHtml(node.id)}">${escapeHtml(prefix + node.name)}</option>`;
  }).join('');
  orgParent.value = info && info.parent ? info.parent.id : '';
}

function collectOrgDescendantIds(unit) {
  const ids = new Set();
  function visit(item) {
    (item && item.children || []).forEach(child => {
      ids.add(child.id);
      visit(child);
    });
  }
  visit(unit);
  return ids;
}

function readOrgNodeForm() {
  return {
    type: normalizeOrgType(orgType ? orgType.value : 'department'),
    code: orgCode ? orgCode.value.trim() : '',
    name: orgName ? orgName.value.trim() : '',
    manager: orgManager ? orgManager.value.trim() : ''
  };
}

function createOrgUnit(type) {
  const labels = {
    company: currentLang === 'zh-CN' ? '\u65b0\u516c\u53f8' : 'New Company',
    department: currentLang === 'zh-CN' ? '\u65b0\u90e8\u95e8' : 'New Department',
    team: currentLang === 'zh-CN' ? '\u65b0\u5c0f\u7ec4' : 'New Team'
  };
  const normalizedType = normalizeOrgType(type || 'department');
  return {
    id: `org-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: normalizedType,
    code: '',
    name: labels[normalizedType] || labels.department,
    manager: '',
    employees: [],
    children: []
  };
}

function applyOrgNodeEdit() {
  const info = findOrgNodeInfo(selectedOrgEditorId);
  if (!info) return alert(t('orgSelectNode'));
  const form = readOrgNodeForm();
  if (!form.name) return alert(t('orgNameRequired'));
  Object.assign(info.unit, form);
  const targetParentId = orgParent ? orgParent.value : (info.parent ? info.parent.id : '');
  const currentParentId = info.parent ? info.parent.id : '';
  if (targetParentId !== currentParentId) {
    const movingUnit = info.unit;
    info.siblings.splice(info.index, 1);
    if (targetParentId) {
      const targetInfo = findOrgNodeInfo(targetParentId);
      if (!targetInfo) {
        info.siblings.splice(info.index, 0, movingUnit);
        return alert(t('orgSelectNode'));
      }
      targetInfo.unit.children = targetInfo.unit.children || [];
      targetInfo.unit.children.push(movingUnit);
    } else {
      organization.units.push(movingUnit);
    }
  }
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEditorId = info.unit.id;
  renderOrgPage();
}

function addOrgChild() {
  const info = findOrgNodeInfo(selectedOrgEditorId);
  const unit = createOrgUnit('department');
  if (info) info.unit.children.push(unit);
  else organization.units.push(unit);
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEditorId = unit.id;
  selectedOrgEmployeeId = '';
  renderOrgPage();
}

function addOrgSibling() {
  const info = findOrgNodeInfo(selectedOrgEditorId);
  const unit = createOrgUnit('department');
  if (info) info.siblings.splice(info.index + 1, 0, unit);
  else organization.units.push(unit);
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEditorId = unit.id;
  selectedOrgEmployeeId = '';
  renderOrgPage();
}

function addOrgCompany() {
  const unit = createOrgUnit('company');
  organization.units.push(unit);
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEditorId = unit.id;
  selectedOrgEmployeeId = '';
  renderOrgPage();
}

function addTypedOrgChildOrRoot(type) {
  const info = findOrgNodeInfo(selectedOrgEditorId);
  const unit = createOrgUnit(type);
  if (info) info.unit.children.push(unit);
  else organization.units.push(unit);
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEditorId = unit.id;
  selectedOrgEmployeeId = '';
  renderOrgPage();
}

function deleteOrgNode() {
  const info = findOrgNodeInfo(selectedOrgEditorId);
  if (!info) return alert(t('orgSelectNode'));
  if (!confirm(t('orgDeleteConfirm'))) return;
  info.siblings.splice(info.index, 1);
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEditorId = firstOrgUnitId(organization.units);
  selectedOrgEmployeeId = '';
  renderOrgPage();
}

function renderOrgEmployeeEditor() {
  const info = findOrgNodeInfo(selectedOrgEditorId);
  const employees = info && info.unit ? info.unit.employees || [] : [];
  const selected = employees.find(employee => employee.id === selectedOrgEmployeeId);
  if (orgEmployeeCount) orgEmployeeCount.textContent = t('orgEmployeeCount', employees.length);
  if (orgEmployeeList) {
    orgEmployeeList.innerHTML = employees.length
      ? employees.map(employee => renderOrgEmployeeItem(employee)).join('')
      : `<div class="emptyMini">${escapeHtml(t('orgEmployeeEmpty'))}</div>`;
    orgEmployeeList.querySelectorAll('[data-org-employee-id]').forEach(button => {
      button.addEventListener('click', () => selectOrgEmployee(button.getAttribute('data-org-employee-id')));
    });
  }
  fillOrgEmployeeForm(selected);
}

function renderOrgEmployeeItem(employee) {
  const meta = [employee.employeeId, employee.title, employee.phone].filter(Boolean).join(' / ');
  return `<button class="orgEmployeeItem ${employee.id === selectedOrgEmployeeId ? 'selectedOrgEmployee' : ''}" type="button" data-org-employee-id="${escapeHtml(employee.id)}">
    <strong>${escapeHtml(employee.name || employee.employeeId || '-')}</strong>
    ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
  </button>`;
}

function selectOrgEmployee(id) {
  selectedOrgEmployeeId = id || '';
  renderOrgEmployeeEditor();
}

function fillOrgEmployeeForm(employee) {
  if (orgEmployeeName) orgEmployeeName.value = employee ? employee.name || '' : '';
  if (orgEmployeeId) orgEmployeeId.value = employee ? employee.employeeId || '' : '';
  if (orgEmployeeTitle) orgEmployeeTitle.value = employee ? employee.title || '' : '';
  if (orgEmployeePhone) orgEmployeePhone.value = employee ? employee.phone || '' : '';
  if (orgEmployeeParent) {
    const nodes = flattenOrgUnits(organization.units);
    orgEmployeeParent.innerHTML = nodes.map(node => `<option value="${escapeHtml(node.id)}">${escapeHtml(`${'  '.repeat(node.depth)}${node.name}`)}</option>`).join('');
    orgEmployeeParent.value = nodes.some(node => node.id === selectedOrgEditorId) ? selectedOrgEditorId : firstOrgUnitId(organization.units);
  }
}

function readOrgEmployeeForm() {
  return {
    id: selectedOrgEmployeeId || `emp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: orgEmployeeName ? orgEmployeeName.value.trim() : '',
    employeeId: orgEmployeeId ? orgEmployeeId.value.trim() : '',
    title: orgEmployeeTitle ? orgEmployeeTitle.value.trim() : '',
    phone: orgEmployeePhone ? orgEmployeePhone.value.trim() : ''
  };
}

function selectedOrgEmployeeParentInfo() {
  const targetId = orgEmployeeParent && orgEmployeeParent.value ? orgEmployeeParent.value : selectedOrgEditorId;
  return findOrgNodeInfo(targetId);
}

function addOrgEmployee() {
  const info = selectedOrgEmployeeParentInfo() || findOrgNodeInfo(selectedOrgEditorId);
  if (!info) return alert(t('orgSelectNode'));
  const employee = readOrgEmployeeForm();
  if (!employee.name) return alert(t('orgEmployeeNameRequired'));
  employee.id = `emp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  info.unit.employees = info.unit.employees || [];
  info.unit.employees.push(employee);
  selectedOrgEditorId = info.unit.id;
  selectedOrgEmployeeId = employee.id;
  organization = normalizeOrganization({ units: organization.units });
  renderOrgPage();
}

function updateOrgEmployee() {
  const sourceInfo = findOrgNodeInfo(selectedOrgEditorId);
  if (!sourceInfo) return alert(t('orgSelectNode'));
  const employees = sourceInfo.unit.employees || [];
  const index = employees.findIndex(employee => employee.id === selectedOrgEmployeeId);
  if (index < 0) return alert(t('orgSelectEmployee'));
  const employee = readOrgEmployeeForm();
  if (!employee.name) return alert(t('orgEmployeeNameRequired'));
  const targetInfo = selectedOrgEmployeeParentInfo() || sourceInfo;
  if (targetInfo.unit.id === sourceInfo.unit.id) employees[index] = employee;
  else {
    employees.splice(index, 1);
    targetInfo.unit.employees = targetInfo.unit.employees || [];
    targetInfo.unit.employees.push(employee);
    selectedOrgEditorId = targetInfo.unit.id;
  }
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEmployeeId = employee.id;
  renderOrgPage();
}

function deleteOrgEmployee() {
  const info = findOrgNodeInfo(selectedOrgEditorId);
  if (!info) return alert(t('orgSelectNode'));
  const employees = info.unit.employees || [];
  const index = employees.findIndex(employee => employee.id === selectedOrgEmployeeId);
  if (index < 0) return alert(t('orgSelectEmployee'));
  employees.splice(index, 1);
  selectedOrgEmployeeId = '';
  organization = normalizeOrganization({ units: organization.units });
  renderOrgPage();
}

function serializeOrgText(units, depth = 0) {
  return (units || []).map(unit => {
    const line = `${'  '.repeat(depth)}${orgTypeLabel(unit.type)} | ${unit.code || ''} | ${unit.name} | ${unit.manager || ''}`;
    const children = serializeOrgText(unit.children, depth + 1);
    return children ? `${line}\n${children}` : line;
  }).join('\n');
}

function parseOrgText(value) {
  const roots = [];
  const stack = [{ depth: -1, children: roots }];
  String(value || '').split(/\r?\n/).forEach(line => {
    const name = line.trim();
    if (!name) return;
    const indent = (line.match(/^\s*/) || [''])[0].replace(/\t/g, '  ').length;
    const depth = Math.floor(indent / 2);
    const parts = name.split('|').map(item => item.trim());
    const unitName = parts.length >= 3 ? parts[2] : name;
    const unit = {
      id: `org-${hashText(`${unitName}-${parts[1] || ''}-${depth}`)}`,
      type: parts.length >= 3 ? normalizeOrgType(parts[0]) : 'department',
      code: parts.length >= 3 ? parts[1] : '',
      name: unitName,
      manager: parts.length >= 4 ? parts[3] : '',
      employees: [],
      children: []
    };
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
    stack[stack.length - 1].children.push(unit);
    stack.push({ depth, children: unit.children });
  });
  return normalizeOrgUnits(roots);
}

function applyOrgText() {
  organization = normalizeOrganization({ units: parseOrgText(orgText ? orgText.value : '') });
  selectedOrgEditorId = firstOrgUnitId(organization.units);
  selectedOrgEmployeeId = '';
  renderOrgPage();
}

function exportOrganization() {
  const payload = { kind: 'it-asset-organization', version: 2, exportedAt: new Date().toISOString(), units: organization.units };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `it-asset-organization-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

async function importOrganization() {
  const file = orgImportFile && orgImportFile.files && orgImportFile.files[0];
  if (!file) return;
  try {
    const input = JSON.parse(await readTextFile(file));
    const units = Array.isArray(input) ? input : input.units;
    organization = normalizeOrganization({ units });
    selectedOrgEditorId = firstOrgUnitId(organization.units);
    selectedOrgEmployeeId = '';
    renderOrgPage();
  } catch (err) {
    alert(t('orgImportFailed', err && err.message ? err.message : String(err)));
  } finally {
    orgImportFile.value = '';
  }
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Read failed'));
    reader.readAsText(file, 'utf-8');
  });
}

async function saveOrganization() {
  const res = await authedFetch('/api/org', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ units: organization.units })
  });
  if (!res.ok) return alert(t('orgSaveFailed', await res.text()));
  organization = normalizeOrganization(await res.json());
  closeOrgModal();
  renderOrgPage();
}

function buildOrgStats(units) {
  return {
    totalUnits: flattenOrgUnits(units).length,
    totalEmployees: organizationEmployeeCount({ children: units || [] }),
    totalAssets: assets.length
  };
}

function organizationAssetCount(unit) {
  const names = new Set();
  const employees = new Set();
  (function collect(item) {
    if (item && item.name) names.add(String(item.name).toLowerCase());
    (item.employees || []).forEach(employee => {
      if (employee.name) employees.add(String(employee.name).toLowerCase());
      if (employee.employeeId) employees.add(String(employee.employeeId).toLowerCase());
    });
    (item.children || []).forEach(collect);
  })(unit);
  return assets.filter(asset => {
    const user = asset.user || {};
    return names.has(assetDepartment(asset).toLowerCase())
      || employees.has(String(user.name || '').trim().toLowerCase())
      || employees.has(String(user.employeeId || '').trim().toLowerCase());
  }).length;
}

function organizationEmployeeCount(unit) {
  const employees = new Set();
  (function collect(item) {
    (item && item.employees || []).forEach(employee => {
      const employeeId = String((employee || {}).employeeId || '').trim().toLowerCase();
      const name = String((employee || {}).name || '').trim().toLowerCase();
      if (employeeId) employees.add(`id:${employeeId}`);
      else if (name) employees.add(`name:${name}`);
    });
    (item.children || []).forEach(collect);
  })(unit);
  return employees.size;
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

function assetDepartment(asset) {
  return String((asset.user || {}).department || (asset.metadata || {}).category || '').trim();
}

function assetLabel(asset) {
  const system = asset.system || {};
  const user = asset.user || {};
  return compact([system.computerCode || system.computerName, user.name, user.department]);
}

function compact(values) {
  return values.map(value => String(value || '').trim()).filter(Boolean).join(' / ') || '-';
}

function compareIp(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let i = 0; i < 4; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  }
  return 0;
}

function isIpv4(value) {
  const text = String(value || '').trim();
  return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(text);
}

function normalizeOrgType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['company', 'business-unit', 'division', 'department', 'team'].includes(raw)) return raw;
  if (['\u516c\u53f8', '\u96c6\u56e2', '\u603b\u516c\u53f8'].includes(raw)) return 'company';
  if (['\u4e8b\u4e1a\u90e8', '\u4e1a\u52a1\u5355\u5143'].includes(raw)) return 'business-unit';
  if (['\u4e2d\u5fc3', '\u5206\u90e8'].includes(raw)) return 'division';
  if (['\u90e8\u95e8', '\u90e8'].includes(raw)) return 'department';
  if (['\u5c0f\u7ec4', '\u7ec4', '\u73ed\u7ec4'].includes(raw)) return 'team';
  return 'department';
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
