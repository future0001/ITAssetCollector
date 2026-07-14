let assets = [];
let selectedAsset = null;
let isCreatingAsset = false;
let currentLang = localStorage.getItem('assetManagerLang') || 'zh-CN';
let serverKey = localStorage.getItem('assetServerKey') || '';
let cleanupSourceResolver = null;
let expandedCategoryKeys = loadExpandedCategoryKeys();
let expandedDepartmentKeys = loadExpandedDepartmentKeys();
let hasSavedExpandedDepartmentKeys = localStorage.getItem('expandedAssetDepartments') != null;
let selectedMissingFields = new Set();
let visualAssetFilter = null;
let isIpDashboardExpanded = localStorage.getItem('ipDashboardExpanded') === '1';
let organization = { units: [] };
let selectedOrgUnit = localStorage.getItem('selectedOrgUnit') || '';
let selectedOrgChartCompany = localStorage.getItem('selectedOrgChartCompany') || '';
let collapsedOrgChartNodes = loadCollapsedOrgChartNodes();
let selectedOrgEditorId = '';
let selectedOrgEmployeeId = '';
let presetCategories = [];
let editingCategories = [];
let pendingCategoryIds = [];
let selectedBatchCategory = '';

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

const MISSING_FIELD_FILTERS = [
  { id: 'computerName', labelKey: 'missingFieldComputerName', path: ['system', 'computerName'] },
  { id: 'computerCode', labelKey: 'missingFieldComputerCode', path: ['system', 'computerCode'] },
  { id: 'userName', labelKey: 'missingFieldUserName', path: ['user', 'name'] },
  { id: 'department', labelKey: 'missingFieldDepartment', path: ['user', 'department'] },
  { id: 'location', labelKey: 'missingFieldLocation', path: ['user', 'location'] },
  { id: 'ipAddress', labelKey: 'missingFieldIpAddress', isMissing: asset => assetIpv4List(asset).length === 0 },
  { id: 'macAddress', labelKey: 'missingFieldMacAddress', isMissing: asset => !((asset.networkAdapters || []).some(nic => String(nic.macAddress || '').trim())) },
  { id: 'boardManufacturer', labelKey: 'missingFieldBoardManufacturer', path: ['baseBoard', 'manufacturer'] },
  { id: 'boardProduct', labelKey: 'missingFieldBoardProduct', path: ['baseBoard', 'product'] },
  { id: 'boardSerial', labelKey: 'missingFieldBoardSerial', path: ['baseBoard', 'serialNumber'] },
  { id: 'diskSerial', labelKey: 'missingFieldDiskSerial', isMissing: asset => !((asset.disks || []).some(disk => String(disk.serialNumber || '').trim())) },
  { id: 'osCaption', labelKey: 'missingFieldOsCaption', path: ['system', 'osCaption'] }
];

selectedMissingFields = loadSelectedMissingFields();

const zh = {
  appTitle: '\u0049\u0054 \u8d44\u4ea7\u7ba1\u7406',
  navAssets: '\u8d44\u4ea7\u53f0\u8d26',
  loading: '\u6b63\u5728\u52a0\u8f7d...',
  loadFailed: '\u52a0\u8f7d\u5931\u8d25',
  authRequired: '\u8bf7\u8f93\u5165\u670d\u52a1\u7aef\u5bc6\u94a5',
  authFailed: '\u5bc6\u94a5\u9519\u8bef\u6216\u5df2\u8fc7\u671f',
  importOffline: '\u5bfc\u5165\u79bb\u7ebf\u8bb0\u5f55',
  importOfflineDone: stats => `\u5bfc\u5165\u5b8c\u6210\uff1a\u5bfc\u5165 ${stats.imported} \u6761\uff0c\u65b0\u589e ${stats.created} \u6761\uff0c\u66f4\u65b0 ${stats.updated} \u6761\uff0c\u8df3\u8fc7 ${stats.skipped} \u6761`,
  importOfflineFailed: message => `\u5bfc\u5165\u79bb\u7ebf\u8bb0\u5f55\u5931\u8d25\uff1a${message}`,
  downloadBackup: '\u4e0b\u8f7d\u5907\u4efd',
  restoreBackup: '\u6062\u590d\u5907\u4efd',
  restoreBackupConfirm: '\u786e\u5b9a\u7528\u8be5\u5907\u4efd\u66ff\u6362\u5f53\u524d\u670d\u52a1\u7aef\u6570\u636e\u5417\uff1f\u6062\u590d\u524d\u670d\u52a1\u7aef\u4f1a\u81ea\u52a8\u4fdd\u7559\u4e00\u4efd\u5f53\u524d\u6570\u636e\u5feb\u7167\u3002',
  restoreBackupDone: stats => `\u5907\u4efd\u6062\u590d\u5b8c\u6210\uff1a\u6062\u590d ${stats.restored || stats.imported || 0} \u6761\uff0c\u8df3\u8fc7 ${stats.skipped || 0} \u6761`,
  restoreBackupFailed: message => `\u5907\u4efd\u6062\u590d\u5931\u8d25\uff1a${message}`,
  total: count => `\u5171 ${count} \u6761\u8bb0\u5f55`,
  assetOverviewTitle: '\u8d44\u4ea7\u53ef\u89c6\u5316\u6982\u89c8',
  assetOverviewHint: '\u8ddf\u968f\u5f53\u524d\u7b5b\u9009\u548c\u641c\u7d22\u7ed3\u679c\u52a8\u6001\u66f4\u65b0\u3002',
  assetHealthScore: score => `\u5065\u5eb7\u5ea6 ${score}%`,
  assetMetricTotal: '\u5f53\u524d\u8d44\u4ea7',
  assetMetricComplete: '\u5b8c\u6574\u6863\u6848',
  assetMetricMissing: '\u7f3a\u5931\u5b57\u6bb5',
  assetMetricAbnormal: '\u5f02\u5e38\u786c\u76d8',
  assetCategoryDistribution: '\u5206\u7c7b\u5206\u5e03',
  assetDepartmentTop: '\u90e8\u95e8 Top',
  assetIssueOverview: '\u95ee\u9898\u6982\u89c8',
  assetNoChartData: '\u6682\u65e0\u6570\u636e',
  assetCompleteCount: stats => `${stats.complete} / ${stats.total}`,
  assetIssueCount: count => `${count} \u9879`,
  assetVisualFilterActive: label => `\u5df2\u4e0b\u94bb\uff1a${label}`,
  clearVisualFilter: '\u6e05\u9664\u4e0b\u94bb',
  filteredTotal: stats => `\u663e\u793a ${stats.filtered} \u6761 / \u5171 ${stats.total} \u6761\u8bb0\u5f55`,
  missingResultTitle: stats => `\u547d\u4e2d ${stats.filtered} \u6761 / \u5f53\u524d\u8303\u56f4 ${stats.scoped} \u6761 / \u5168\u90e8 ${stats.total} \u6761`,
  missingResultItem: item => `${item.label}: ${item.count}`,
  missingResultMore: count => `\u5176\u4ed6 ${count} \u9879`,
  missingFieldOptionCount: count => `${count} \u6761\u7f3a\u5931`,
  searchPlaceholder: '\u641c\u7d22\u4f7f\u7528\u4eba\u3001\u90e8\u95e8\u3001\u5206\u7c7b\u3001\u6807\u7b7e\u3001\u8d44\u4ea7\u7f16\u53f7\u3001\u8ba1\u7b97\u673a\u540d\u3001\u5e8f\u5217\u53f7',
  addRecord: '\u65b0\u589e\u8bb0\u5f55',
  refresh: '\u5237\u65b0',
  moreActions: '\u66f4\u591a\u64cd\u4f5c',
  menuDataOps: '\u6570\u636e\u64cd\u4f5c',
  menuMaintainOps: '\u7ef4\u62a4\u64cd\u4f5c',
  menuDangerOps: '\u5371\u9669\u64cd\u4f5c',
  exportSelected: '\u5bfc\u51fa\u9009\u4e2d',
  collectAgents: '\u4e00\u952e\u6536\u96c6\u5ba2\u6237\u7aef',
  clientManagement: '\u5ba2\u6237\u7aef\u7ba1\u7406',
  collectAgentsDone: request => `\u5df2\u4e0b\u53d1\u6536\u96c6\u4efb\u52a1\uff1a${request.id}\uff0c\u5ba2\u6237\u7aef\u5c06\u5728\u540e\u53f0\u81ea\u52a8\u4e0a\u62a5\u3002`,
  collectAgentsFailed: message => `\u4e0b\u53d1\u6536\u96c6\u4efb\u52a1\u5931\u8d25\uff1a${message}`,
  checkClients: '\u68c0\u6d4b\u5ba2\u6237\u7aef\u5b89\u88c5\u72b6\u6001',
  checkClientsFailed: message => `\u68c0\u6d4b\u5ba2\u6237\u7aef\u5b89\u88c5\u72b6\u6001\u5931\u8d25\uff1a${message}`,
  checkClientsSummary: stats => `\u5ba2\u6237\u7aef\u5b89\u88c5\u72b6\u6001\n\u8d44\u4ea7\u603b\u6570\uff1a${stats.totalAssets}\n\u5df2\u68c0\u6d4b\u5b89\u88c5\uff1a${stats.installed}\n\u8fd1 5 \u5206\u949f\u5728\u7ebf\uff1a${stats.online}\n\u672a\u68c0\u6d4b\u5230\uff1a${stats.notDetected}\n\u989d\u5916\u6709\u5fc3\u8df3\u4f46\u672a\u5efa\u6863\uff1a${stats.extraInstalled}`,
  checkClientsMissingTitle: count => `\n\n\u672a\u68c0\u6d4b\u5230\u5ba2\u6237\u7aef\u7684\u7535\u8111\uff08\u6700\u591a\u663e\u793a ${count} \u6761\uff09\uff1a`,
  checkClientsExtraTitle: count => `\n\n\u6709\u5ba2\u6237\u7aef\u5fc3\u8df3\u4f46\u672a\u5728\u8d44\u4ea7\u4e2d\u5efa\u6863\uff08\u6700\u591a\u663e\u793a ${count} \u6761\uff09\uff1a`,
  reviewCollect: '\u91cd\u65b0\u91c7\u96c6\u9009\u4e2d\u5e76\u6bd4\u5bf9',
  reviewDiffs: '\u67e5\u770b\u91c7\u96c6\u5dee\u5f02',
  reviewCollectNoSelection: '\u8bf7\u5148\u9009\u62e9\u8981\u91cd\u65b0\u91c7\u96c6\u7684\u8bb0\u5f55\u3002',
  reviewCollectNoComputer: '\u9009\u4e2d\u8bb0\u5f55\u4e2d\u6ca1\u6709\u53ef\u7528\u7684\u8ba1\u7b97\u673a\u540d\u3002',
  reviewCollectDone: request => `\u5df2\u4e0b\u53d1\u6307\u5b9a\u91cd\u65b0\u91c7\u96c6\u4efb\u52a1\uff1a${request.id}\n\u76ee\u6807\uff1a${(request.targets || []).join(', ')}\n\u5ba2\u6237\u7aef\u56de\u62a5\u540e\uff0c\u8bf7\u5230\u201c\u5ba2\u6237\u7aef\u7ba1\u7406\u201d\u9875\u9762\u5ba1\u6838\u91c7\u96c6\u5dee\u5f02\u3002`,
  reviewCollectFailed: message => `\u4e0b\u53d1\u91cd\u65b0\u91c7\u96c6\u4efb\u52a1\u5931\u8d25\uff1a${message}`,
  reviewDiffsEmpty: '\u6682\u65e0\u5f85\u786e\u8ba4\u7684\u91c7\u96c6\u5dee\u5f02\u3002',
  reviewDiffConfirm: text => `${text}\n\n\u662f\u5426\u5e94\u7528\u8fd9\u6b21\u91c7\u96c6\u7ed3\u679c\uff1f\n\u5df2\u6709\u7684\u624b\u52a8\u5206\u7c7b\u548c\u6807\u7b7e\u4f1a\u4fdd\u7559\u3002`,
  reviewDiffApplied: '\u5df2\u5e94\u7528\u91c7\u96c6\u66f4\u65b0\u3002',
  reviewDiffFailed: message => `\u5904\u7406\u91c7\u96c6\u5dee\u5f02\u5931\u8d25\uff1a${message}`,
  setCategory: '\u8bbe\u7f6e\u5206\u7c7b',
  manageCategories: '\u7ba1\u7406\u5206\u7c7b\u9884\u8bbe',
  manageClientVersions: '\u5ba2\u6237\u7aef\u7248\u672c\u7ba1\u7406',
  manageClientKey: '\u5ba2\u6237\u7aef\u5371\u9669\u64cd\u4f5c\u5bc6\u94a5',
  clientKeyPrompt: '\u8bf7\u8f93\u5165\u65b0\u7684\u5ba2\u6237\u7aef\u5371\u9669\u64cd\u4f5c\u5bc6\u94a5',
  clientKeyEmpty: '\u5bc6\u94a5\u4e0d\u80fd\u4e3a\u7a7a\u3002',
  clientKeySaved: '\u5ba2\u6237\u7aef\u5371\u9669\u64cd\u4f5c\u5bc6\u94a5\u5df2\u66f4\u65b0\u3002',
  clientKeySaveFailed: message => `\u4fdd\u5b58\u5ba2\u6237\u7aef\u5371\u9669\u64cd\u4f5c\u5bc6\u94a5\u5931\u8d25\uff1a${message}`,
  categoryManageTitle: '\u5206\u7c7b\u9884\u8bbe',
  categoryManageHint: '\u7ef4\u62a4\u53ef\u9009\u7684\u5206\u7c7b\u540d\uff0c\u7528\u4e8e\u7b5b\u9009\u3001\u624b\u52a8\u7f16\u8f91\u548c\u6279\u91cf\u8bbe\u7f6e\u5206\u7c7b\u3002',
  categoryPresetAdd: '\u65b0\u589e\u5206\u7c7b',
  categoryPresetPlaceholder: '\u8f93\u5165\u5206\u7c7b\u540d',
  categoryPresetAddBtn: '\u6dfb\u52a0',
  categoryPresetList: '\u9884\u8bbe\u5206\u7c7b',
  categoryPresetCount: count => `${count} \u4e2a`,
  categoryPresetEmpty: '\u6682\u65e0\u9884\u8bbe\u5206\u7c7b',
  categorySelectTitle: '\u9009\u62e9\u5206\u7c7b',
  categorySelectHint: count => `\u5c06\u4e3a ${count} \u6761\u9009\u4e2d\u8bb0\u5f55\u8bbe\u7f6e\u5206\u7c7b`,
  categoryCustomLabel: '\u65b0\u5206\u7c7b\u6216\u81ea\u5b9a\u4e49\u5206\u7c7b',
  categoryInUse: count => `${count} \u6761`,
  categoryUseThis: '\u9009\u62e9',
  clearCategory: '\u6e05\u9664\u5206\u7c7b',
  applyCategory: '\u5e94\u7528',
  versionManageTitle: '\u5ba2\u6237\u7aef\u7248\u672c\u7ba1\u7406',
  versionManageHint: '\u53d1\u5e03\u666e\u901a\u5ba2\u6237\u7aef\u548c XP \u5ba2\u6237\u7aef\u7684\u81ea\u52a8\u5347\u7ea7\u5305\u3002',
  versionWinTitle: '\u666e\u901a\u5ba2\u6237\u7aef',
  versionXpTitle: 'XP \u5ba2\u6237\u7aef',
  versionNumber: '\u7248\u672c\u53f7',
  versionExeFile: 'EXE \u6587\u4ef6',
  versionConfigFile: 'Config \u6587\u4ef6',
  versionNotes: '\u53d1\u5e03\u8bf4\u660e',
  publishVersion: '\u53d1\u5e03',
  versionCurrent: item => `${item.label}\uff1a${item.version || '\u672a\u53d1\u5e03'}`,
  versionMeta: item => `\u6587\u4ef6\uff1a${item.fileName || '-'} / \u5927\u5c0f\uff1a${item.size || 0} B / \u65f6\u95f4\uff1a${item.publishedAt || '-'}`,
  versionPublishDone: '\u7248\u672c\u5df2\u53d1\u5e03\u3002',
  versionPublishFailed: message => `\u53d1\u5e03\u7248\u672c\u5931\u8d25\uff1a${message}`,
  versionLoadFailed: message => `\u8bfb\u53d6\u7248\u672c\u4fe1\u606f\u5931\u8d25\uff1a${message}`,
  versionRequired: '\u8bf7\u586b\u5199\u7248\u672c\u53f7\u5e76\u9009\u62e9 EXE \u6587\u4ef6\u3002',
  cleanupAbnormal: '\u6e05\u9664\u5f02\u5e38\u8bbe\u5907',
  cleanupSourceTitle: '\u9009\u62e9\u5f02\u5e38\u6570\u636e\u6e90',
  cleanupSourceHint: '\u53ea\u4f1a\u6e05\u9664\u52fe\u9009\u7684\u5f02\u5e38\u6765\u6e90\u3002',
  cleanupSourceCount: count => `\u547d\u4e2d ${count} \u4e2a\u786c\u76d8\u9879`,
  cleanupSourceRequired: '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u8981\u6e05\u9664\u7684\u5f02\u5e38\u6570\u636e\u6e90\u3002',
  cleanupNoAbnormalSources: '\u5f53\u524d\u6ca1\u6709\u68c0\u6d4b\u5230\u53ef\u6e05\u7406\u7684\u5f02\u5e38\u786c\u76d8\u6765\u6e90\u3002',
  cleanupRun: '\u6e05\u9664\u9009\u4e2d',
  cleanupAbnormalConfirm: names => `\u786e\u5b9a\u6e05\u9664\u4ee5\u4e0b\u5f02\u5e38\u6765\u6e90\u7684\u786c\u76d8\u9879\u5417\uff1f\n${names}\n\u5199\u5165\u524d\u670d\u52a1\u7aef\u4f1a\u81ea\u52a8\u5907\u4efd\u5f53\u524d\u6570\u636e\u3002`,
  cleanupAbnormalDone: stats => `\u6e05\u7406\u5b8c\u6210\uff1a\u66f4\u65b0 ${stats.recordsUpdated} \u6761\u8bb0\u5f55\uff0c\u79fb\u9664 ${stats.disksRemoved} \u4e2a\u5f02\u5e38\u786c\u76d8\u9879`,
  cleanupAbnormalFailed: message => `\u6e05\u7406\u5f02\u5e38\u8bbe\u5907\u5931\u8d25\uff1a${message}`,
  cancel: '\u53d6\u6d88',
  deleteSelected: '\u5220\u9664\u9009\u4e2d',
  exportAll: '\u5bfc\u51fa\u5168\u90e8',
  allCategories: '\u5168\u90e8\u5206\u7c7b',
  categoryFilter: '\u6309\u5206\u7c7b\u7b5b\u9009',
  allOrganizations: '\u5168\u90e8\u7ec4\u7ec7',
  orgFilter: '\u6309\u7ec4\u7ec7\u67b6\u6784\u7b5b\u9009',
  manageOrg: '\u7ec4\u7ec7\u67b6\u6784',
  orgTitle: '\u7ec4\u7ec7\u67b6\u6784',
  orgHint: '\u9762\u5411\u4f01\u4e1a\u7ec4\u7ec7\uff1a\u652f\u6301\u516c\u53f8\u3001\u4e8b\u4e1a\u90e8\u3001\u4e2d\u5fc3\u3001\u90e8\u95e8\u3001\u5c0f\u7ec4\uff0c\u7528\u7f29\u8fdb\u8868\u793a\u4e0a\u4e0b\u7ea7\u3002',
  orgPreviewTitle: '\u5f53\u524d\u7ed3\u6784',
  orgEditTitle: '\u7f16\u8f91\u7ed3\u6784\uff08\u7c7b\u578b | \u7f16\u7801 | \u540d\u79f0 | \u8d1f\u8d23\u4eba\uff09',
  orgTextPlaceholder: '\u516c\u53f8 | HQ | \u603b\u90e8 | \u5f20\u4e09\n  \u4e8b\u4e1a\u90e8 | BU-RD | \u7814\u53d1\u4e8b\u4e1a\u90e8 | \u674e\u56db\n    \u90e8\u95e8 | RD-SW | \u8f6f\u4ef6\u90e8 | \u738b\u4e94',
  orgSaveFailed: message => `\u4fdd\u5b58\u7ec4\u7ec7\u67b6\u6784\u5931\u8d25\uff1a${message}`,
  orgEmpty: '\u6682\u65e0\u7ec4\u7ec7\u67b6\u6784',
  orgStats: stats => `\u5171 ${stats.totalUnits} \u4e2a\u7ec4\u7ec7\u8282\u70b9\uff0c${stats.totalEmployees || 0} \u4eba\uff0c${stats.totalAssets} \u53f0\u8d44\u4ea7\uff0c${stats.unmatchedAssets} \u53f0\u672a\u5339\u914d\u7ec4\u7ec7`,
  orgChartTitle: '\u7ec4\u7ec7\u56fe\u793a',
  orgChartSummary: stats => `${stats.totalUnits} \u4e2a\u8282\u70b9 / ${stats.totalEmployees || 0} \u4eba / ${stats.totalAssets} \u53f0\u8d44\u4ea7`,
  orgCompanySelectTitle: '\u9009\u62e9\u7ec4\u7ec7\u67b6\u6784',
  orgAssetCount: count => `${count} \u53f0\u8d44\u4ea7`,
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
  orgAddCompany: '\u65b0\u589e\u516c\u53f8',
  orgAddDepartment: '\u65b0\u589e\u90e8\u95e8',
  orgAddTeam: '\u65b0\u589e\u5c0f\u7ec4',
  orgEmployees: '\u76f4\u5c5e\u5458\u5de5',
  orgEmployeeName: '\u59d3\u540d',
  orgEmployeeId: '\u5de5\u53f7',
  orgEmployeeTitle: '\u804c\u4f4d',
  orgEmployeePhone: '\u7535\u8bdd',
  orgEmployeeParent: '\u6240\u5c5e\u90e8\u95e8 / \u4e0a\u7ea7',
  orgEmployeeCopyTargets: '\u590d\u5236\u76ee\u6807',
  orgAddEmployee: '\u65b0\u589e\u5458\u5de5',
  orgUpdateEmployee: '\u66f4\u65b0\u5458\u5de5',
  orgCopyEmployee: '\u590d\u5236\u5230\u8282\u70b9',
  orgCopyEmployeeDone: stats => `\u590d\u5236\u5b8c\u6210\uff1a\u65b0\u589e ${stats.created} \u4e2a\uff0c\u5df2\u5b58\u5728 ${stats.skipped} \u4e2a`,
  orgDeleteEmployee: '\u5220\u9664\u5458\u5de5',
  orgEmployeeCount: count => `${count} \u4eba`,
  orgEmployeeEmpty: '\u5f53\u524d\u8282\u70b9\u6682\u65e0\u76f4\u5c5e\u5458\u5de5',
  orgEmployeeNameRequired: '\u5458\u5de5\u59d3\u540d\u4e0d\u80fd\u4e3a\u7a7a\u3002',
  orgSelectEmployee: '\u8bf7\u5148\u9009\u62e9\u5458\u5de5\u3002',
  orgDeleteNode: '\u5220\u9664\u8282\u70b9',
  orgAdvanced: '\u6279\u91cf\u6587\u672c\u7f16\u8f91',
  orgApplyText: '\u5e94\u7528\u6587\u672c',
  orgSelectNode: '\u8bf7\u5148\u9009\u62e9\u7ec4\u7ec7\u8282\u70b9\u3002',
  orgNameRequired: '\u7ec4\u7ec7\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002',
  orgDeleteConfirm: '\u786e\u5b9a\u5220\u9664\u8be5\u8282\u70b9\u53ca\u5176\u4e0b\u7ea7\u7ec4\u7ec7\u5417\uff1f',
  orgImportFailed: message => `\u5bfc\u5165\u7ec4\u7ec7\u67b6\u6784\u5931\u8d25\uff1a${message}`,
  categoryGroupCount: count => `${count} \u6761\u8bb0\u5f55`,
  categoryGroupIps: count => `${count} \u4e2a IP`,
  categoryGroupAbnormal: count => `${count} \u4e2a\u5f02\u5e38\u786c\u76d8`,
  categoryGroupNoAbnormal: '\u786c\u76d8\u6b63\u5e38',
  categoryGroupLatest: value => `\u6700\u8fd1\u66f4\u65b0\uff1a${value}`,
  expandCategory: '\u5c55\u5f00\u5206\u7c7b',
  collapseCategory: '\u6536\u8d77\u5206\u7c7b',
  unassignedDepartment: '\u672a\u586b\u5199\u90e8\u95e8',
  expandDepartment: '\u5c55\u5f00\u90e8\u95e8',
  collapseDepartment: '\u6536\u8d77\u90e8\u95e8',
  missingFieldFilter: '\u7f3a\u5931\u5b57\u6bb5',
  missingFieldFilterActive: count => `\u7f3a\u5931\u5b57\u6bb5 (${count})`,
  clearMissingFilters: '\u6e05\u7a7a',
  missingFieldComputerName: '\u4e3b\u673a\u540d',
  missingFieldComputerCode: '\u8d44\u4ea7\u7f16\u53f7',
  missingFieldUserName: '\u4f7f\u7528\u4eba',
  missingFieldDepartment: '\u90e8\u95e8',
  missingFieldLocation: '\u4f4d\u7f6e',
  missingFieldIpAddress: 'IP \u5730\u5740',
  missingFieldMacAddress: 'MAC \u5730\u5740',
  missingFieldBoardManufacturer: '\u4e3b\u677f\u54c1\u724c',
  missingFieldBoardProduct: '\u4e3b\u677f\u578b\u53f7',
  missingFieldBoardSerial: '\u4e3b\u677f\u5e8f\u5217\u53f7',
  missingFieldDiskSerial: '\u786c\u76d8\u5e8f\u5217\u53f7',
  missingFieldOsCaption: '\u64cd\u4f5c\u7cfb\u7edf',
  ipUsageTitle: '\u0049\u0050 \u8d44\u6e90\u4f7f\u7528\u60c5\u51b5',
  ipDetails: '\u0049\u0050 \u8be6\u60c5',
  ipUsageSummary: stats => `\u5171 ${stats.totalAssets} \u53f0\u8bbe\u5907\uff0c\u8bb0\u5f55 ${stats.totalIpEntries} \u4e2a IPv4\uff0c\u8986\u76d6 ${stats.subnetCount} \u4e2a\u7f51\u6bb5`,
  ipMetricUnique: '\u5df2\u7528 IP',
  ipMetricDuplicate: '\u91cd\u590d IP',
  ipMetricNoIp: '\u65e0 IP \u8bbe\u5907',
  ipMetricLinkLocal: '\u81ea\u52a8\u79c1\u6709\u5730\u5740',
  ipSubnetUsed: stats => `${stats.used} \u5df2\u7528 / ${stats.total} \u53ef\u7528`,
  ipSubnetFree: count => `\u5269\u4f59 ${count}`,
  ipDuplicateTitle: '\u91cd\u590d IP',
  ipNoIpTitle: '\u65e0 IP \u8bbe\u5907',
  ipLinkLocalTitle: '\u9700\u68c0\u67e5\u7684 169.254 \u5730\u5740',
  ipNoAlerts: '\u672a\u53d1\u73b0 IP \u51b2\u7a81\u6216\u5f02\u5e38\u5730\u5740',
  ipEmpty: '\u6682\u65e0 IP \u6570\u636e',
  expandIpDashboard: '\u5c55\u5f00 IP \u8be6\u60c5',
  collapseIpDashboard: '\u6536\u8d77 IP \u8be6\u60c5',
  categoryTags: '\u5206\u7c7b / \u6807\u7b7e',
  user: '\u4f7f\u7528\u4eba',
  computer: '\u8ba1\u7b97\u673a',
  nics: '\u7269\u7406\u7f51\u5361',
  disks: '\u7269\u7406\u786c\u76d8',
  mainboard: '\u4e3b\u677f',
  time: '\u65f6\u95f4',
  action: '\u64cd\u4f5c',
  noRecords: '\u6682\u65e0\u8bb0\u5f55',
  editRecord: '\u7f16\u8f91\u8bb0\u5f55',
  editorHint: '\u9009\u62e9\u4e00\u6761\u8bb0\u5f55\u540e\u53ef\u4fee\u6539',
  newRecordHint: '\u6b63\u5728\u65b0\u589e\u624b\u52a8\u8bb0\u5f55',
  category: '\u5206\u7c7b',
  tags: '\u6807\u7b7e',
  optionalTags: '\u53ef\u9009\u6807\u7b7e',
  tagsPlaceholder: '\u591a\u4e2a\u6807\u7b7e\u7528\u9017\u53f7\u6216\u7a7a\u683c\u5206\u9694\uff0c\u5982\uff1a\u670d\u52a1\u5668, \u751f\u4ea7\u73af\u5883',
  name: '\u59d3\u540d',
  department: '\u90e8\u95e8',
  employeeId: '\u5de5\u53f7',
  location: '\u4f4d\u7f6e',
  phone: '\u7535\u8bdd',
  assetCode: '\u8d44\u4ea7\u7f16\u53f7',
  computerName: '\u8ba1\u7b97\u673a\u540d',
  note: '\u5907\u6ce8',
  os: '\u7cfb\u7edf',
  installTime: '\u5b89\u88c5\u65f6\u95f4',
  boardMaker: '\u4e3b\u677f\u5382\u5546',
  boardModel: '\u4e3b\u677f\u578b\u53f7',
  boardSerial: '\u4e3b\u677f\u5e8f\u5217\u53f7',
  save: '\u4fdd\u5b58',
  delete: '\u5220\u9664',
  nicsPlaceholder: '\u6bcf\u884c\u4e00\u6761\uff1a\u540d\u79f0 | mac | ipv4,ipv4',
  ipConflictOk: '\u5f53\u524d IP \u672a\u88ab\u5176\u4ed6\u8bb0\u5f55\u5360\u7528',
  ipConflictTitle: '\u68c0\u6d4b\u5230 IP \u5df2\u88ab\u5360\u7528',
  ipConflictLine: item => `${item.ip} \u5df2\u88ab ${item.owner} \u4f7f\u7528`,
  ipConflictConfirm: lines => `\u4ee5\u4e0b IP \u5df2\u88ab\u5176\u4ed6\u8bb0\u5f55\u5360\u7528\uff1a\n${lines}\n\n\u662f\u5426\u4ecd\u7136\u4fdd\u5b58\uff1f`,
  disksPlaceholder: '\u6bcf\u884c\u4e00\u6761\uff1a\u578b\u53f7 | \u5e8f\u5217\u53f7 | \u5bb9\u91cf',
  selectExportFirst: '\u8bf7\u5148\u9009\u62e9\u8981\u5bfc\u51fa\u7684\u8bb0\u5f55\u3002',
  selectDeleteFirst: '\u8bf7\u5148\u9009\u62e9\u8981\u5220\u9664\u7684\u8bb0\u5f55\u3002',
  categoryPrompt: '\u8bf7\u8f93\u5165\u5206\u7c7b\u540d\uff08\u7559\u7a7a\u53ef\u6e05\u9664\u5206\u7c7b\uff09',
  categoryManageNoSelection: '\u8bf7\u5148\u9009\u62e9\u8981\u8bbe\u7f6e\u5206\u7c7b\u7684\u8bb0\u5f55\u3002',
  categoryUpdated: count => `\u5df2\u66f4\u65b0 ${count} \u6761\u8bb0\u5f55\u7684\u5206\u7c7b`,
  categoryUpdateFailed: message => `\u8bbe\u7f6e\u5206\u7c7b\u5931\u8d25\uff1a${message}`,
  tagsNoSelection: '\u8bf7\u5148\u9009\u62e9\u8981\u8bbe\u7f6e\u6807\u7b7e\u7684\u8bb0\u5f55\u3002',
  tagsUpdated: count => `\u5df2\u66f4\u65b0 ${count} \u6761\u8bb0\u5f55\u7684\u6807\u7b7e`,
  tagsUpdateFailed: message => `\u8bbe\u7f6e\u6807\u7b7e\u5931\u8d25\uff1a${message}`,
  confirmDeleteSelected: count => `\u786e\u5b9a\u5220\u9664\u9009\u4e2d\u7684 ${count} \u6761\u8bb0\u5f55\u5417\uff1f`,
  batchDeleteFailed: message => `\u6279\u91cf\u5220\u9664\u5931\u8d25\uff1a${message}`,
  unnamedComputer: '\u672a\u547d\u540d\u7535\u8111',
  noUser: '\u672a\u586b\u5199\u4f7f\u7528\u4eba',
  saveFailed: message => `\u4fdd\u5b58\u5931\u8d25\uff1a${message}`,
  createFailed: message => `\u65b0\u589e\u8bb0\u5f55\u5931\u8d25\uff1a${message}`,
  confirmDeleteOne: '\u786e\u5b9a\u5220\u9664\u8fd9\u6761\u8bb0\u5f55\u5417\uff1f',
  deleteFailed: message => `\u5220\u9664\u5931\u8d25\uff1a${message}`,
  nicIndex: index => `\u7f51\u5361 ${index}`,
  diskIndex: index => `\u786c\u76d8 ${index}`,
  size: '\u5bb9\u91cf',
  computerLabel: '\u8ba1\u7b97\u673a\u540d',
  installLabel: '\u5b89\u88c5',
  updatedLabel: '\u66f4\u65b0',
  edit: '\u7f16\u8f91',
  uncategorized: '\u672a\u5206\u7c7b'
};

const en = {
  appTitle: 'IT Asset Manager',
  navAssets: 'Assets',
  loading: 'Loading...',
  loadFailed: 'Load failed',
  authRequired: 'Enter server key',
  authFailed: 'Server key is incorrect or expired',
  importOffline: 'Import Offline',
  importOfflineDone: stats => `Import finished: ${stats.imported} imported, ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped`,
  importOfflineFailed: message => `Import offline records failed: ${message}`,
  downloadBackup: 'Download Backup',
  restoreBackup: 'Restore Backup',
  restoreBackupConfirm: 'Replace current server data with this backup file? The server will keep an automatic snapshot before restoring.',
  restoreBackupDone: stats => `Backup restored: ${stats.restored || stats.imported || 0} restored, ${stats.skipped || 0} skipped`,
  restoreBackupFailed: message => `Restore backup failed: ${message}`,
  total: count => `Total ${count} records`,
  assetOverviewTitle: 'Asset Visual Overview',
  assetOverviewHint: 'Updates with the current filters and search results.',
  assetHealthScore: score => `Health ${score}%`,
  assetMetricTotal: 'Current Assets',
  assetMetricComplete: 'Complete Records',
  assetMetricMissing: 'Missing Fields',
  assetMetricAbnormal: 'Abnormal Disks',
  assetCategoryDistribution: 'Category Distribution',
  assetDepartmentTop: 'Department Top',
  assetIssueOverview: 'Issue Overview',
  assetNoChartData: 'No data',
  assetCompleteCount: stats => `${stats.complete} / ${stats.total}`,
  assetIssueCount: count => `${count} item(s)`,
  assetVisualFilterActive: label => `Drilldown: ${label}`,
  clearVisualFilter: 'Clear drilldown',
  filteredTotal: stats => `Showing ${stats.filtered} / ${stats.total} records`,
  missingResultTitle: stats => `Matched ${stats.filtered} / current scope ${stats.scoped} / total ${stats.total}`,
  missingResultItem: item => `${item.label}: ${item.count}`,
  missingResultMore: count => `${count} more`,
  missingFieldOptionCount: count => `${count} missing`,
  searchPlaceholder: 'Search user, dept, category, tags, asset code, computer, serial',
  addRecord: 'Add Record',
  refresh: 'Refresh',
  moreActions: 'More Actions',
  menuDataOps: 'Data',
  menuMaintainOps: 'Maintain',
  menuDangerOps: 'Danger',
  exportSelected: 'Export Selected',
  collectAgents: 'Collect Installed Clients',
  clientManagement: 'Client Management',
  collectAgentsDone: request => `Collection request created: ${request.id}. Installed clients will report in the background.`,
  collectAgentsFailed: message => `Create collection request failed: ${message}`,
  checkClients: 'Check Client Installations',
  checkClientsFailed: message => `Check client installation status failed: ${message}`,
  checkClientsSummary: stats => `Client installation status\nTotal assets: ${stats.totalAssets}\nDetected installed: ${stats.installed}\nOnline in last 5 minutes: ${stats.online}\nNot detected: ${stats.notDetected}\nHeartbeat without asset record: ${stats.extraInstalled}`,
  checkClientsMissingTitle: count => `\n\nComputers without detected client (showing up to ${count}):`,
  checkClientsExtraTitle: count => `\n\nClients with heartbeat but no asset record (showing up to ${count}):`,
  reviewCollect: 'Review Re-collect Selected',
  reviewDiffs: 'Review Collection Diffs',
  reviewCollectNoSelection: 'Select records to re-collect first.',
  reviewCollectNoComputer: 'Selected records have no usable computer name.',
  reviewCollectDone: request => `Review collection request created: ${request.id}\nTargets: ${(request.targets || []).join(', ')}\nAfter clients report, open "Client Management" to review collection diffs.`,
  reviewCollectFailed: message => `Create review collection request failed: ${message}`,
  reviewDiffsEmpty: 'No pending collection diffs.',
  reviewDiffConfirm: text => `${text}\n\nApply this collection result?\nExisting manual categories and tags will be preserved.`,
  reviewDiffApplied: 'Collection update applied.',
  reviewDiffFailed: message => `Handle collection diff failed: ${message}`,
  setCategory: 'Set Category',
  manageCategories: 'Manage Category Presets',
  manageClientVersions: 'Client Versions',
  manageClientKey: 'Client Operation Key',
  clientKeyPrompt: 'Enter the new client dangerous operation key',
  clientKeyEmpty: 'Key cannot be empty.',
  clientKeySaved: 'Client dangerous operation key has been updated.',
  clientKeySaveFailed: message => `Failed to save client dangerous operation key: ${message}`,
  categoryManageTitle: 'Category Presets',
  categoryManageHint: 'Maintain category names used by filters, manual editing, and batch category setting.',
  categoryPresetAdd: 'Add category',
  categoryPresetPlaceholder: 'Category name',
  categoryPresetAddBtn: 'Add',
  categoryPresetList: 'Preset categories',
  categoryPresetCount: count => `${count} item(s)`,
  categoryPresetEmpty: 'No preset categories',
  categorySelectTitle: 'Choose category',
  categorySelectHint: count => `Set category for ${count} selected record(s)`,
  categoryCustomLabel: 'New or custom category',
  categoryInUse: count => `${count} record(s)`,
  categoryUseThis: 'Select',
  clearCategory: 'Clear category',
  applyCategory: 'Apply',
  versionManageTitle: 'Client Version Management',
  versionManageHint: 'Publish auto-update packages for standard and XP clients.',
  versionWinTitle: 'Standard client',
  versionXpTitle: 'XP client',
  versionNumber: 'Version',
  versionExeFile: 'EXE file',
  versionConfigFile: 'Config file',
  versionNotes: 'Release notes',
  publishVersion: 'Publish',
  versionCurrent: item => `${item.label}: ${item.version || 'Not published'}`,
  versionMeta: item => `File: ${item.fileName || '-'} / Size: ${item.size || 0} B / Time: ${item.publishedAt || '-'}`,
  versionPublishDone: 'Version published.',
  versionPublishFailed: message => `Publish version failed: ${message}`,
  versionLoadFailed: message => `Load version info failed: ${message}`,
  versionRequired: 'Enter a version and choose an EXE file.',
  cleanupAbnormal: 'Clean Abnormal Devices',
  cleanupSourceTitle: 'Select abnormal data sources',
  cleanupSourceHint: 'Only selected sources will be removed.',
  cleanupSourceCount: count => `${count} disk item(s) matched`,
  cleanupSourceRequired: 'Select at least one abnormal data source to clean.',
  cleanupNoAbnormalSources: 'No cleanable abnormal disk sources were detected.',
  cleanupRun: 'Clean Selected',
  cleanupAbnormalConfirm: names => `Remove disk items from these abnormal sources?\n${names}\nThe server will back up current data before writing.`,
  cleanupAbnormalDone: stats => `Cleanup finished: updated ${stats.recordsUpdated} record(s), removed ${stats.disksRemoved} abnormal disk item(s)`,
  cleanupAbnormalFailed: message => `Clean abnormal devices failed: ${message}`,
  cancel: 'Cancel',
  deleteSelected: 'Delete Selected',
  exportAll: 'Export All',
  allCategories: 'All Categories',
  categoryFilter: 'Filter by category',
  allOrganizations: 'All Organizations',
  orgFilter: 'Filter by organization',
  manageOrg: 'Organization',
  orgTitle: 'Organization',
  orgHint: 'Enterprise org chart: company, business unit, division, department, and team. Use indentation for hierarchy.',
  orgPreviewTitle: 'Current Structure',
  orgEditTitle: 'Edit Structure (type | code | name | manager)',
  orgTextPlaceholder: 'Company | HQ | Head Office | Alex\n  Business Unit | BU-RD | R&D Business Unit | Lee\n    Department | RD-SW | Software | Wang',
  orgSaveFailed: message => `Save organization failed: ${message}`,
  orgEmpty: 'No organization structure',
  orgStats: stats => `${stats.totalUnits} org unit(s), ${stats.totalEmployees || 0} employee(s), ${stats.totalAssets} asset(s), ${stats.unmatchedAssets} unmatched`,
  orgChartTitle: 'Organization Chart',
  orgChartSummary: stats => `${stats.totalUnits} node(s) / ${stats.totalEmployees || 0} employee(s) / ${stats.totalAssets} asset(s)`,
  orgCompanySelectTitle: 'Select organization',
  orgAssetCount: count => `${count} asset(s)`,
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
  orgAddCompany: 'Add Company',
  orgAddDepartment: 'Add Department',
  orgAddTeam: 'Add Team',
  orgEmployees: 'Employees',
  orgEmployeeName: 'Name',
  orgEmployeeId: 'Employee ID',
  orgEmployeeTitle: 'Title',
  orgEmployeePhone: 'Phone',
  orgEmployeeParent: 'Department / Parent',
  orgEmployeeCopyTargets: 'Copy Targets',
  orgAddEmployee: 'Add Employee',
  orgUpdateEmployee: 'Update Employee',
  orgCopyEmployee: 'Copy to Node',
  orgCopyEmployeeDone: stats => `Copy finished: ${stats.created} added, ${stats.skipped} already existed`,
  orgDeleteEmployee: 'Delete Employee',
  orgEmployeeCount: count => `${count} employee(s)`,
  orgEmployeeEmpty: 'No direct employees in this node',
  orgEmployeeNameRequired: 'Employee name is required.',
  orgSelectEmployee: 'Select an employee first.',
  orgDeleteNode: 'Delete Node',
  orgAdvanced: 'Batch Text Edit',
  orgApplyText: 'Apply Text',
  orgSelectNode: 'Select an organization node first.',
  orgNameRequired: 'Organization name is required.',
  orgDeleteConfirm: 'Delete this node and all child units?',
  orgImportFailed: message => `Import organization failed: ${message}`,
  categoryGroupCount: count => `${count} record(s)`,
  categoryGroupIps: count => `${count} IP(s)`,
  categoryGroupAbnormal: count => `${count} abnormal disk(s)`,
  categoryGroupNoAbnormal: 'Disks normal',
  categoryGroupLatest: value => `Latest update: ${value}`,
  expandCategory: 'Expand category',
  collapseCategory: 'Collapse category',
  unassignedDepartment: 'No Department',
  expandDepartment: 'Expand department',
  collapseDepartment: 'Collapse department',
  missingFieldFilter: 'Missing Fields',
  missingFieldFilterActive: count => `Missing Fields (${count})`,
  clearMissingFilters: 'Clear',
  missingFieldComputerName: 'Host Name',
  missingFieldComputerCode: 'Asset Code',
  missingFieldUserName: 'User',
  missingFieldDepartment: 'Department',
  missingFieldLocation: 'Location',
  missingFieldIpAddress: 'IP Address',
  missingFieldMacAddress: 'MAC Address',
  missingFieldBoardManufacturer: 'Board Brand',
  missingFieldBoardProduct: 'Board Model',
  missingFieldBoardSerial: 'Board Serial',
  missingFieldDiskSerial: 'Disk Serial',
  missingFieldOsCaption: 'OS',
  ipUsageTitle: 'IP Resource Usage',
  ipDetails: 'IP Details',
  ipUsageSummary: stats => `${stats.totalAssets} devices, ${stats.totalIpEntries} IPv4 entries, ${stats.subnetCount} subnet(s)`,
  ipMetricUnique: 'Used IPs',
  ipMetricDuplicate: 'Duplicate IPs',
  ipMetricNoIp: 'No-IP Devices',
  ipMetricLinkLocal: 'Link-local IPs',
  ipSubnetUsed: stats => `${stats.used} used / ${stats.total} available`,
  ipSubnetFree: count => `${count} free`,
  ipDuplicateTitle: 'Duplicate IPs',
  ipNoIpTitle: 'Devices Without IP',
  ipLinkLocalTitle: '169.254 Addresses',
  ipNoAlerts: 'No IP conflicts or abnormal addresses found',
  ipEmpty: 'No IP data',
  expandIpDashboard: 'Expand IP Details',
  collapseIpDashboard: 'Collapse IP Details',
  categoryTags: 'Category / Tags',
  user: 'User',
  computer: 'Computer',
  nics: 'Physical NICs',
  disks: 'Physical Disks',
  mainboard: 'Mainboard',
  time: 'Time',
  action: 'Action',
  noRecords: 'No records',
  editRecord: 'Edit Record',
  editorHint: 'Select a record to edit',
  newRecordHint: 'Adding a manual record',
  category: 'Category',
  tags: 'Tags',
  optionalTags: 'Optional tags',
  tagsPlaceholder: 'Separate tags with commas or spaces, e.g. server, production',
  name: 'Name',
  department: 'Department',
  employeeId: 'Employee ID',
  location: 'Location',
  phone: 'Phone',
  assetCode: 'Asset Code',
  computerName: 'Computer Name',
  note: 'Note',
  os: 'OS',
  installTime: 'Install Time',
  boardMaker: 'Board Maker',
  boardModel: 'Board Model',
  boardSerial: 'Board Serial',
  save: 'Save',
  delete: 'Delete',
  nicsPlaceholder: 'One per line: name | mac | ipv4,ipv4',
  ipConflictOk: 'Current IPs are not used by other records',
  ipConflictTitle: 'IP already in use',
  ipConflictLine: item => `${item.ip} is used by ${item.owner}`,
  ipConflictConfirm: lines => `These IPs are already used by other records:\n${lines}\n\nSave anyway?`,
  disksPlaceholder: 'One per line: model | serial | size',
  selectExportFirst: 'Please select records to export.',
  selectDeleteFirst: 'Please select records to delete.',
  categoryPrompt: 'Enter category name. Leave empty to clear category.',
  categoryManageNoSelection: 'Select records before setting category.',
  categoryUpdated: count => `Updated category for ${count} record(s)`,
  categoryUpdateFailed: message => `Set category failed: ${message}`,
  tagsNoSelection: 'Select records before setting tags.',
  tagsUpdated: count => `Updated tags for ${count} record(s)`,
  tagsUpdateFailed: message => `Set tags failed: ${message}`,
  confirmDeleteSelected: count => `Delete ${count} selected record(s)?`,
  batchDeleteFailed: message => `Batch delete failed: ${message}`,
  unnamedComputer: 'Unnamed computer',
  noUser: 'No user',
  saveFailed: message => `Save failed: ${message}`,
  createFailed: message => `Create record failed: ${message}`,
  confirmDeleteOne: 'Delete this record?',
  deleteFailed: message => `Delete failed: ${message}`,
  nicIndex: index => `NIC ${index}`,
  diskIndex: index => `Disk ${index}`,
  size: 'Size',
  computerLabel: 'Computer',
  installLabel: 'Install',
  updatedLabel: 'Updated',
  edit: 'Edit',
  uncategorized: 'Uncategorized'
};

const translations = { 'zh-CN': zh, 'en-US': en };

const rows = document.getElementById('assetRows');
const emptyState = document.getElementById('emptyState');
const totalText = document.getElementById('totalText');
const assetOverviewHint = document.getElementById('assetOverviewHint');
const assetHealthScore = document.getElementById('assetHealthScore');
const assetMetricGrid = document.getElementById('assetMetricGrid');
const assetCategoryBars = document.getElementById('assetCategoryBars');
const assetDepartmentBars = document.getElementById('assetDepartmentBars');
const assetIssueList = document.getElementById('assetIssueList');
const assetCategoryCount = document.getElementById('assetCategoryCount');
const assetDepartmentCount = document.getElementById('assetDepartmentCount');
const assetIssueCount = document.getElementById('assetIssueCount');
const clearAssetVisualFilterBtn = document.getElementById('clearAssetVisualFilterBtn');
const searchInput = document.getElementById('searchInput');
const layout = document.querySelector('.layout');
const topbar = document.querySelector('.topbar');
const editor = document.getElementById('editor');
const editorHint = document.getElementById('editorHint');
const selectAll = document.getElementById('selectAll');
const languageSelect = document.getElementById('languageSelect');
const categoryFilter = document.getElementById('categoryFilter');
const orgFilter = document.getElementById('orgFilter');
const categoryOptions = document.getElementById('categoryOptions');
const departmentOptions = document.getElementById('departmentOptions');
const missingFieldSummary = document.getElementById('missingFieldSummary');
const missingFieldFilters = document.getElementById('missingFieldFilters');
const clearMissingFiltersBtn = document.getElementById('clearMissingFiltersBtn');
const ipUsageSummary = document.getElementById('ipUsageSummary');
const ipDashboardBody = document.getElementById('ipDashboardBody');
const toggleIpDashboardBtn = document.getElementById('toggleIpDashboardBtn');
const ipMetricGrid = document.getElementById('ipMetricGrid');
const subnetUsageList = document.getElementById('subnetUsageList');
const ipAlertList = document.getElementById('ipAlertList');
const importOfflineFile = document.getElementById('importOfflineFile');
const restoreBackupFile = document.getElementById('restoreBackupFile');
const cleanupModal = document.getElementById('cleanupModal');
const cleanupSourceList = document.getElementById('cleanupSourceList');
const categoryModal = document.getElementById('categoryModal');
const categoryPresetInput = document.getElementById('categoryPresetInput');
const categoryPresetList = document.getElementById('categoryPresetList');
const categoryPresetCount = document.getElementById('categoryPresetCount');
const categorySelectModal = document.getElementById('categorySelectModal');
const categorySelectHint = document.getElementById('categorySelectHint');
const categoryQuickList = document.getElementById('categoryQuickList');
const categoryCustomInput = document.getElementById('categoryCustomInput');
const clientVersionModal = document.getElementById('clientVersionModal');
const versionStatusList = document.getElementById('versionStatusList');
const versionWinNumber = document.getElementById('versionWinNumber');
const versionWinExe = document.getElementById('versionWinExe');
const versionWinConfig = document.getElementById('versionWinConfig');
const versionWinNotes = document.getElementById('versionWinNotes');
const versionXpNumber = document.getElementById('versionXpNumber');
const versionXpExe = document.getElementById('versionXpExe');
const versionXpConfig = document.getElementById('versionXpConfig');
const versionXpNotes = document.getElementById('versionXpNotes');
const orgModal = document.getElementById('orgModal');
const orgChart = document.getElementById('orgChart');
const orgChartSummary = document.getElementById('orgChartSummary');
const orgCompanySelect = document.getElementById('orgCompanySelect');
const orgTree = document.getElementById('orgTree');
const orgSummary = document.getElementById('orgSummary');
const orgText = document.getElementById('orgText');
const orgType = document.getElementById('orgType');
const orgCode = document.getElementById('orgCode');
const orgName = document.getElementById('orgName');
const orgManager = document.getElementById('orgManager');
const orgParent = document.getElementById('orgParent');
const orgImportFile = document.getElementById('orgImportFile');
const orgEmployeeList = document.getElementById('orgEmployeeList');
const orgEmployeeCount = document.getElementById('orgEmployeeCount');
const orgEmployeeName = document.getElementById('orgEmployeeName');
const orgEmployeeId = document.getElementById('orgEmployeeId');
const orgEmployeeTitle = document.getElementById('orgEmployeeTitle');
const orgEmployeePhone = document.getElementById('orgEmployeePhone');
const orgEmployeeParent = document.getElementById('orgEmployeeParent');
const orgEmployeeCopyTargets = document.getElementById('orgEmployeeCopyTargets');
const nicsInput = document.getElementById('nics');
const ipConflictHint = document.getElementById('ipConflictHint');

languageSelect.value = currentLang;
languageSelect.addEventListener('change', () => {
  currentLang = languageSelect.value;
  localStorage.setItem('assetManagerLang', currentLang);
  applyLanguage();
  rebuildCategoryFilter();
  renderOrganization();
  renderMissingFieldFilters();
  renderIpDashboard();
  renderRows();
  if (selectedAsset) fillEditor(selectedAsset);
  updateStickyOffsets();
});

document.getElementById('refreshBtn').addEventListener('click', loadAssets);
document.getElementById('addAssetBtn').addEventListener('click', startNewAsset);
document.getElementById('exportAllLink').addEventListener('click', exportAllAssets);
document.getElementById('importOfflineBtn').addEventListener('click', () => importOfflineFile.click());
importOfflineFile.addEventListener('change', importOfflineAssets);
document.getElementById('downloadBackupBtn').addEventListener('click', downloadBackup);
document.getElementById('restoreBackupBtn').addEventListener('click', () => restoreBackupFile.click());
restoreBackupFile.addEventListener('change', restoreBackup);
document.getElementById('closeEditorBtn').addEventListener('click', clearEditor);
document.getElementById('assetForm').addEventListener('submit', saveAsset);
nicsInput.addEventListener('input', renderIpConflictHint);
document.getElementById('deleteBtn').addEventListener('click', deleteAsset);
document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedAssets);
document.getElementById('exportSelectedBtn').addEventListener('click', exportSelectedAssets);
bindOptionalClick('checkClientsBtn', checkClientInstallations);
document.getElementById('reviewCollectBtn').addEventListener('click', reviewCollectSelected);
bindOptionalClick('reviewDiffsBtn', reviewCollectionDiffs);
bindOptionalClick('collectAgentsBtn', collectInstalledClients);
document.getElementById('setCategoryBtn').addEventListener('click', setSelectedCategory);
document.getElementById('manageCategoryBtn').addEventListener('click', openCategoryModal);
bindOptionalClick('manageClientVersionsBtn', openClientVersionModal);
bindOptionalClick('manageClientKeyBtn', manageClientDangerKey);
document.getElementById('cleanupAbnormalBtn').addEventListener('click', cleanupAbnormalDevices);
bindOptionalClick('manageOrgBtn', openOrgModal);
document.getElementById('cleanupCancelTopBtn').addEventListener('click', () => closeCleanupSourceModal(null));
document.getElementById('cleanupCancelBtn').addEventListener('click', () => closeCleanupSourceModal(null));
document.getElementById('cleanupRunBtn').addEventListener('click', confirmCleanupSourceSelection);
document.getElementById('categoryCancelTopBtn').addEventListener('click', closeCategoryModal);
document.getElementById('categoryCancelBtn').addEventListener('click', closeCategoryModal);
document.getElementById('categorySaveBtn').addEventListener('click', saveCategoryPresets);
document.getElementById('categoryAddBtn').addEventListener('click', addCategoryPresetFromInput);
document.getElementById('categorySelectCancelTopBtn').addEventListener('click', closeCategorySelectModal);
document.getElementById('categorySelectCancelBtn').addEventListener('click', closeCategorySelectModal);
document.getElementById('categoryClearBtn').addEventListener('click', () => applySelectedCategory(''));
document.getElementById('categoryApplyBtn').addEventListener('click', () => applySelectedCategory(categoryCustomInput ? categoryCustomInput.value : selectedBatchCategory));
bindOptionalClick('versionCancelTopBtn', closeClientVersionModal);
bindOptionalClick('versionCancelBtn', closeClientVersionModal);
bindOptionalClick('versionRefreshBtn', loadClientVersions);
bindOptionalClick('publishWinVersionBtn', () => publishClientVersion('win'));
bindOptionalClick('publishXpVersionBtn', () => publishClientVersion('xp'));
categoryPresetInput.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addCategoryPresetFromInput();
});
if (categoryCustomInput) {
  categoryCustomInput.addEventListener('input', () => {
    selectedBatchCategory = categoryCustomInput.value.trim();
    renderCategoryQuickList();
  });
  categoryCustomInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applySelectedCategory(categoryCustomInput.value);
  });
}
bindOptionalClick('orgCancelTopBtn', closeOrgModal);
bindOptionalClick('orgCancelBtn', closeOrgModal);
bindOptionalClick('orgSaveBtn', saveOrganization);
bindOptionalClick('orgApplyNodeBtn', applyOrgNodeEdit);
bindOptionalClick('orgAddChildBtn', addOrgChild);
bindOptionalClick('orgAddSiblingBtn', addOrgSibling);
bindOptionalClick('orgDeleteNodeBtn', deleteOrgNode);
bindOptionalClick('orgAddCompanyBtn', addOrgCompany);
bindOptionalClick('orgAddDepartmentBtn', addOrgDepartment);
bindOptionalClick('orgAddTeamBtn', addOrgTeam);
bindOptionalClick('orgAddEmployeeBtn', addOrgEmployee);
bindOptionalClick('orgUpdateEmployeeBtn', updateOrgEmployee);
bindOptionalClick('orgCopyEmployeeBtn', copyOrgEmployee);
bindOptionalClick('orgDeleteEmployeeBtn', deleteOrgEmployee);
bindOptionalClick('orgApplyTextBtn', applyOrgText);
bindOptionalClick('orgImportBtn', () => orgImportFile && orgImportFile.click());
bindOptionalClick('orgExportBtn', exportOrganization);
if (orgImportFile) orgImportFile.addEventListener('change', importOrganization);
searchInput.addEventListener('input', renderRows);
categoryFilter.addEventListener('change', renderRows);
orgFilter.addEventListener('change', () => {
  selectedOrgUnit = orgFilter.value;
  localStorage.setItem('selectedOrgUnit', selectedOrgUnit);
  renderRows();
});
if (orgCompanySelect) {
  orgCompanySelect.addEventListener('change', () => {
    selectedOrgChartCompany = orgCompanySelect.value;
    localStorage.setItem('selectedOrgChartCompany', selectedOrgChartCompany);
    renderOrganization();
  });
}
if (missingFieldFilters) missingFieldFilters.addEventListener('change', changeMissingFieldFilters);
if (clearMissingFiltersBtn) clearMissingFiltersBtn.addEventListener('click', clearMissingFieldFilters);
if (clearAssetVisualFilterBtn) clearAssetVisualFilterBtn.addEventListener('click', clearAssetVisualFilter);
if (toggleIpDashboardBtn) toggleIpDashboardBtn.addEventListener('click', toggleIpDashboard);
selectAll.addEventListener('change', toggleSelectAll);
window.addEventListener('resize', updateStickyOffsets);

function bindOptionalClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}

applyLanguage();
updateStickyOffsets();
loadAssets().catch(showError);

function t(key, arg) {
  const value = (translations[currentLang] || zh)[key];
  return typeof value === 'function' ? value(arg) : value || key;
}

function applyLanguage() {
  document.documentElement.lang = currentLang;
  document.title = t('appTitle');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  totalText.textContent = assets.length ? t('total', assets.length) : t('loading');
  applyIpDashboardState();
  renderOrganization();
  renderMissingFieldFilters();
  renderIpDashboard();
  renderAssetOverview(assets);
  if (isCreatingAsset) editorHint.textContent = t('newRecordHint');
  else if (!selectedAsset) editorHint.textContent = t('editorHint');
}

async function loadAssets() {
  const [assetRes, orgRes, categoryRes] = await Promise.all([
    authedFetch('/api/assets', { cache: 'no-store' }),
    authedFetch('/api/org', { cache: 'no-store' }),
    authedFetch('/api/categories', { cache: 'no-store' })
  ]);
  if (!assetRes.ok) throw new Error(await assetRes.text());
  assets = await assetRes.json();
  if (orgRes.ok) organization = normalizeOrganization(await orgRes.json());
  else organization = buildOrganizationFromAssets(assets);
  if (categoryRes.ok) {
    const categoryData = await categoryRes.json();
    presetCategories = normalizeCategoryNames(categoryData.categories || []);
  } else {
    presetCategories = [];
  }
  totalText.textContent = t('total', assets.length);
  rebuildCategoryFilter();
  renderOrganization();
  renderMissingFieldFilters();
  renderIpDashboard();
  renderAssetOverview(assets);
  renderRows();
  renderIpConflictHint();
}

function renderIpDashboard() {
  if (!ipUsageSummary || !ipMetricGrid || !subnetUsageList || !ipAlertList) return;

  const stats = buildIpStats(assets);
  ipUsageSummary.textContent = stats.totalIpEntries ? t('ipUsageSummary', stats) : t('ipEmpty');
  applyIpDashboardState();

  ipMetricGrid.innerHTML = [
    renderMetric(t('ipMetricUnique'), stats.uniqueIpCount),
    renderMetric(t('ipMetricDuplicate'), stats.duplicateIpCount, stats.duplicateIpCount ? 'warn' : ''),
    renderMetric(t('ipMetricNoIp'), stats.noIpAssets.length, stats.noIpAssets.length ? 'warn' : ''),
    renderMetric(t('ipMetricLinkLocal'), stats.linkLocalEntries.length, stats.linkLocalEntries.length ? 'warn' : '')
  ].join('');

  subnetUsageList.innerHTML = stats.subnets.length
    ? stats.subnets.map(renderSubnetUsage).join('')
    : `<div class="emptyInline">${escapeHtml(t('ipEmpty'))}</div>`;

  const alertBlocks = [];
  if (stats.duplicates.length) {
    alertBlocks.push(renderIpAlertBlock(t('ipDuplicateTitle'), stats.duplicates.map(item => {
      const owners = item.entries.map(entry => assetLabel(entry.asset)).join(' / ');
      return `${item.ip}: ${owners}`;
    })));
  }
  if (stats.noIpAssets.length) {
    alertBlocks.push(renderIpAlertBlock(t('ipNoIpTitle'), stats.noIpAssets.map(assetLabel)));
  }
  if (stats.linkLocalEntries.length) {
    alertBlocks.push(renderIpAlertBlock(t('ipLinkLocalTitle'), stats.linkLocalEntries.map(entry => `${entry.ip}: ${assetLabel(entry.asset)}`)));
  }

  ipAlertList.innerHTML = alertBlocks.length
    ? alertBlocks.join('')
    : `<div class="ipAlert ok">${escapeHtml(t('ipNoAlerts'))}</div>`;
}

function applyIpDashboardState() {
  if (!ipDashboardBody || !toggleIpDashboardBtn) return;
  ipDashboardBody.hidden = !isIpDashboardExpanded;
  toggleIpDashboardBtn.textContent = t(isIpDashboardExpanded ? 'collapseIpDashboard' : 'expandIpDashboard');
  toggleIpDashboardBtn.setAttribute('aria-expanded', isIpDashboardExpanded ? 'true' : 'false');
}

function toggleIpDashboard() {
  preserveTableViewport(() => {
    isIpDashboardExpanded = !isIpDashboardExpanded;
    localStorage.setItem('ipDashboardExpanded', isIpDashboardExpanded ? '1' : '0');
    applyIpDashboardState();
  });
}

function updateStickyOffsets() {
  if (!topbar) return;
  document.documentElement.style.setProperty('--sticky-topbar-height', `${Math.ceil(topbar.getBoundingClientRect().height)}px`);
}

function preserveTableViewport(changeFn) {
  const table = document.querySelector('table');
  const beforeTop = table ? table.getBoundingClientRect().top : null;
  const beforeScroll = window.scrollY || window.pageYOffset || 0;

  changeFn();
  updateStickyOffsets();

  requestAnimationFrame(() => {
    updateStickyOffsets();
    if (!table || beforeTop == null) return;
    const afterTop = table.getBoundingClientRect().top;
    const delta = afterTop - beforeTop;
    if (!delta || beforeScroll <= 0) return;
    window.scrollBy(0, delta);
  });
}

function renderMetric(label, value, tone) {
  return `<div class="metric ${escapeHtml(tone || '')}">
    <div class="metricValue">${escapeHtml(value)}</div>
    <div class="metricLabel">${escapeHtml(label)}</div>
  </div>`;
}

function renderSubnetUsage(subnet) {
  const usedPercent = subnet.total ? Math.min(100, Math.round(subnet.used / subnet.total * 100)) : 0;
  const cells = [];
  for (let host = 1; host <= subnet.total; host++) {
    const entry = subnet.hosts.get(host);
    const classes = ['ipCell'];
    if (entry) classes.push(entry.count > 1 ? 'duplicate' : 'used');
    const title = entry
      ? `${entry.ip} - ${entry.entries.map(item => assetLabel(item.asset)).join(' / ')}`
      : `${subnet.prefix}.${host}`;
    cells.push(`<span class="${classes.join(' ')}" title="${escapeHtml(title)}"></span>`);
  }

  return `<article class="subnetCard">
    <div class="subnetHeader">
      <div>
        <strong>${escapeHtml(subnet.name)}</strong>
        <small>${escapeHtml(t('ipSubnetUsed', subnet))}</small>
      </div>
      <span>${escapeHtml(t('ipSubnetFree', subnet.total - subnet.used))}</span>
    </div>
    <div class="usageBar"><span style="width: ${usedPercent}%"></span></div>
    <div class="ipGrid">${cells.join('')}</div>
  </article>`;
}

function renderIpAlertBlock(title, lines) {
  return `<div class="ipAlert">
    <strong>${escapeHtml(title)}</strong>
    ${lines.slice(0, 8).map(line => `<small>${escapeHtml(line)}</small>`).join('')}
    ${lines.length > 8 ? `<small>${escapeHtml(`+${lines.length - 8}`)}</small>` : ''}
  </div>`;
}

function buildIpStats(items) {
  const entries = [];
  const noIpAssets = [];

  items.forEach(asset => {
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
      subnets.set(prefix, {
        name: `${prefix}.0/24`,
        prefix,
        total: 254,
        used: 0,
        hosts: new Map()
      });
    }
    const subnet = subnets.get(prefix);
    subnet.used++;
    subnet.hosts.set(host, { ip, count: ipEntries.length, entries: ipEntries });
  });

  const duplicateItems = Array.from(byIp.entries())
    .filter(([, ipEntries]) => ipEntries.length > 1)
    .map(([ip, ipEntries]) => ({ ip, entries: ipEntries }))
    .sort((a, b) => compareIp(a.ip, b.ip));

  const subnetList = Array.from(subnets.values())
    .sort((a, b) => compareIp(`${a.prefix}.0`, `${b.prefix}.0`));

  return {
    totalAssets: items.length,
    totalIpEntries: entries.length,
    uniqueIpCount: byIp.size,
    duplicateIpCount: duplicateItems.length,
    subnetCount: subnetList.length,
    duplicates: duplicateItems,
    noIpAssets,
    linkLocalEntries: entries.filter(entry => entry.ip.startsWith('169.254.')),
    subnets: subnetList
  };
}

function compareIp(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let i = 0; i < 4; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  }
  return 0;
}

function assetLabel(asset) {
  const system = asset.system || {};
  const user = asset.user || {};
  return compact([system.computerCode || system.computerName, user.name, user.department]);
}

function rebuildCategoryFilter() {
  const selected = categoryFilter.value;
  const categories = normalizeCategoryNames(presetCategories.concat(assets.map(assetCategory)));
  categoryFilter.innerHTML = `<option value="">${escapeHtml(t('allCategories'))}</option>` +
    categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  categoryFilter.value = categories.includes(selected) ? selected : '';
  if (categoryOptions) {
    categoryOptions.innerHTML = categories
      .map(category => `<option value="${escapeHtml(category)}">`)
      .join('');
  }
}

function normalizeCategoryNames(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(value => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, currentLang));
}

function renderOrganization() {
  organization = normalizeOrganization(organization && organization.units && organization.units.length ? organization : buildOrganizationFromAssets(assets));
  const flat = organization.flatUnits && organization.flatUnits.length ? organization.flatUnits : flattenOrgUnits(organization.units);
  const displayFlat = orgDisplayFlatUnits(flat);
  const selectedItem = flat.find(item => item.id === selectedOrgUnit || item.name === selectedOrgUnit || item.path === selectedOrgUnit);
  selectedOrgUnit = selectedItem ? (selectedItem.id || selectedItem.path || selectedItem.name) : '';
  localStorage.setItem('selectedOrgUnit', selectedOrgUnit);

  if (orgFilter) {
    orgFilter.innerHTML = `<option value="">${escapeHtml(t('allOrganizations'))}</option>` +
      displayFlat.map(item => {
        const label = `${'  '.repeat(item.displayDepth)}${item.displayPath || item.name}${item.assetCount ? ` (${item.assetCount})` : ''}`;
        return `<option value="${escapeHtml(item.id || item.path || item.name)}">${escapeHtml(label)}</option>`;
      }).join('');
    orgFilter.value = selectedOrgUnit;
  }

  if (departmentOptions) {
    const departments = Array.from(new Set(displayFlat
      .filter(item => normalizeOrgType(item.type) !== 'company')
      .map(item => item.name)
      .concat(assets.map(assetDepartment))
      .filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, currentLang));
    departmentOptions.innerHTML = departments
      .map(name => `<option value="${escapeHtml(name)}">`)
      .join('');
  }

  renderOrgChart();
  if (orgSummary) orgSummary.textContent = t('orgStats', organization.stats || buildOrgStats(flat));
  if (orgModal && !orgModal.hidden && selectedOrgEditorId && !findOrgNodeInfo(selectedOrgEditorId)) {
    selectedOrgEditorId = firstOrgUnitId(organization.units);
  }
  if (orgTree) orgTree.innerHTML = renderOrgTree(organization.units);
  if (orgText && orgModal && !orgModal.hidden) orgText.value = serializeOrgText(organization.units);
  if (orgTree) {
    orgTree.querySelectorAll('[data-org-node-id]').forEach(button => {
      button.addEventListener('click', () => selectOrgNode(button.getAttribute('data-org-node-id')));
    });
  }
  fillOrgNodeEditor();
  renderOrgEmployeeEditor();
}

function orgCompanyRoots() {
  return (organization.units || []).filter(unit => normalizeOrgType(unit.type) === 'company');
}

function orgSingleCompanyRoot() {
  const companies = orgCompanyRoots();
  return companies.length === 1 ? companies[0] : null;
}

function orgDisplayFlatUnits(flat) {
  const singleCompany = orgSingleCompanyRoot();
  if (!singleCompany) {
    return (flat || []).map(item => Object.assign({}, item, {
      displayPath: item.path || item.name,
      displayDepth: Number(item.depth || 0)
    }));
  }

  const companyPrefix = `${singleCompany.name}/`;
  return (flat || [])
    .filter(item => item.id !== singleCompany.id)
    .map(item => {
      const pathValue = String(item.path || item.name || '');
      return Object.assign({}, item, {
        displayPath: pathValue.startsWith(companyPrefix) ? pathValue.slice(companyPrefix.length) : pathValue,
        displayDepth: Math.max(0, Number(item.depth || 0) - 1)
      });
    });
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

function renderOrgChart() {
  if (orgChartSummary) orgChartSummary.textContent = t('orgChartSummary', organization.stats || buildOrgStats(organization.flatUnits || []));
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
    } else {
      orgCompanySelect.hidden = true;
      orgCompanySelect.innerHTML = '';
    }
  }

  if (!orgChart) return;
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
}

function centerOrgChartOnRoot() {
  if (!orgChart) return;
  if (orgChart.dataset.centered === '1') return;
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
  renderOrgChart();
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
  renderOrganization();
}

function renderOrgChartNode(unit, depth = 0) {
  const count = organizationAssetCount(unit);
  const directCount = assets.filter(asset => assetDepartment(asset).toLowerCase() === String(unit.name || '').toLowerCase()).length;
  const employeeCount = organizationEmployeeCount(unit);
  const meta = [unit.code, unit.manager].filter(Boolean).join(' / ');
  const value = unit.id || unit.name;
  const selected = unit.id === selectedOrgEditorId || (selectedOrgUnit && [unit.id, unit.name].map(item => String(item || '')).includes(String(selectedOrgUnit)));
  const children = unit.children || [];
  const key = orgChartNodeKey(unit);
  const collapsed = children.length > 0 && collapsedOrgChartNodes.has(key);
  const type = normalizeOrgType(unit.type);
  const stats = [
    escapeHtml(t('orgAssetCount', count)),
    employeeCount ? escapeHtml(t('orgEmployeeCount', employeeCount)) : '',
    directCount !== count ? escapeHtml(t('orgDirectAssetCount', directCount)) : ''
  ].filter(Boolean).join(' · ');
  return `<li class="orgChartItem ${children.length ? 'hasChildren' : 'isLeaf'} ${collapsed ? 'isCollapsed' : ''}" data-depth="${depth}">
    <button class="orgChartNode orgChartType-${escapeHtml(type)} ${selected ? 'selectedOrgChartNode' : ''}" type="button" data-org-chart-node-id="${escapeHtml(unit.id)}" ${children.length ? `data-org-toggle-id="${escapeHtml(key)}" aria-expanded="${collapsed ? 'false' : 'true'}"` : ''}>
      ${children.length ? `<span class="orgChartToggle" aria-hidden="true">${collapsed ? '+' : '-'}</span>` : ''}
      <span class="orgChartTypeLabel">${escapeHtml(orgTypeLabel(type))}</span>
      <strong>${escapeHtml(unit.name)}</strong>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
      <span class="orgChartStats">${stats}</span>
    </button>
    ${children.length && !collapsed ? `<ul class="orgChartLevel">${children.map(child => renderOrgChartNode(child, depth + 1)).join('')}</ul>` : ''}
  </li>`;
}

function orgTypeLabel(type) {
  const normalized = normalizeOrgType(type);
  const key = {
    company: 'orgTypeCompany',
    'business-unit': 'orgTypeBusinessUnit',
    division: 'orgTypeDivision',
    department: 'orgTypeDepartment',
    team: 'orgTypeTeam'
  }[normalized] || 'orgTypeDepartment';
  return t(key);
}

function normalizeOrganization(input) {
  const units = normalizeOrgUnits(input && input.units);
  const flatUnits = Array.isArray(input && input.flatUnits) ? input.flatUnits.map(normalizeFlatOrgUnit).filter(Boolean) : flattenOrgUnits(units);
  const stats = buildOrgStats(flatUnits, units);
  return { units, flatUnits, stats: Object.assign({}, stats, input && input.stats ? input.stats : {}, { totalEmployees: stats.totalEmployees }) };
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
        employees: normalizeOrgEmployees((unit || {}).employees, pathKey),
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

function buildOrganizationFromAssets(items) {
  const units = Array.from(new Set((items || []).map(assetDepartment).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, currentLang))
    .map(name => ({
      id: `org-${hashText(name)}`,
      type: 'department',
      code: '',
      name,
      manager: '',
      employees: buildOrgEmployeesFromAssets(name, items),
      children: []
    }));
  const flatUnits = flattenOrgUnits(units);
  return { units, flatUnits, stats: buildOrgStats(flatUnits) };
}

function buildOrgEmployeesFromAssets(department, items) {
  const seen = new Set();
  return (items || [])
    .filter(asset => assetDepartment(asset).toLowerCase() === String(department || '').toLowerCase())
    .map(asset => {
      const user = asset.user || {};
      const name = String(user.name || '').trim();
      const employeeId = String(user.employeeId || '').trim();
      const key = `${name.toLowerCase()}|${employeeId.toLowerCase()}`;
      if ((!name && !employeeId) || seen.has(key)) return null;
      seen.add(key);
      return {
        id: `emp-${hashText(`${department}-${key}`)}`,
        name,
        employeeId,
        title: '',
        phone: String(user.phone || '').trim()
      };
    })
    .filter(Boolean);
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

function normalizeOrgType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['company', 'business-unit', 'division', 'department', 'team'].includes(raw)) return raw;
  if (['公司', '集团', '总公司'].includes(raw)) return 'company';
  if (['事业部', '业务单元'].includes(raw)) return 'business-unit';
  if (['中心', '分部'].includes(raw)) return 'division';
  if (['部门', '部'].includes(raw)) return 'department';
  if (['小组', '组', '班组'].includes(raw)) return 'team';
  return 'department';
}

function normalizeFlatOrgUnit(item) {
  const name = String((item || {}).name || '').trim();
  if (!name) return null;
  return {
    id: String((item || {}).id || name).trim(),
    type: normalizeOrgType((item || {}).type),
    code: String((item || {}).code || '').trim(),
    name,
    manager: String((item || {}).manager || '').trim(),
    path: String((item || {}).path || name).trim(),
    depth: Number((item || {}).depth || 0),
    employeeCount: Number((item || {}).employeeCount || 0),
    assetCount: Number((item || {}).assetCount || 0),
    directAssetCount: Number((item || {}).directAssetCount || 0)
  };
}

function flattenOrgUnits(units, depth = 0, parentPath = '') {
  return (units || []).flatMap(unit => {
    const path = parentPath ? `${parentPath}/${unit.name}` : unit.name;
    return [
      {
        id: unit.id || path,
        type: normalizeOrgType(unit.type),
        code: unit.code || '',
        name: unit.name,
        manager: unit.manager || '',
        path,
        depth,
        employeeCount: organizationEmployeeCount(unit),
        assetCount: organizationAssetCount(unit),
        directAssetCount: assets.filter(asset => assetDepartment(asset).toLowerCase() === String(unit.name || '').toLowerCase()).length
      },
      ...flattenOrgUnits(unit.children, depth + 1, path)
    ];
  });
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

function organizationEmployeeKey(employee) {
  const employeeId = String((employee || {}).employeeId || '').trim().toLowerCase();
  const name = String((employee || {}).name || '').trim().toLowerCase();
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
    (item.children || []).forEach(collect);
  })(unit);
  return employees.size;
}

function buildOrgStats(flat, units = organization.units) {
  const names = new Set((flat || []).map(item => String(item.name || '').toLowerCase()));
  const employeeKeys = new Set();
  collectOrganizationEmployees(units).forEach(employee => {
    if (employee.name) employeeKeys.add(String(employee.name).toLowerCase());
    if (employee.employeeId) employeeKeys.add(String(employee.employeeId).toLowerCase());
  });
  const matched = assets.filter(asset => {
    const user = asset.user || {};
    return names.has(assetDepartment(asset).toLowerCase())
      || employeeKeys.has(String(user.name || '').trim().toLowerCase())
      || employeeKeys.has(String(user.employeeId || '').trim().toLowerCase());
  }).length;
  return {
    totalUnits: (flat || []).length,
    totalEmployees: organizationEmployeeCount({ children: units || [] }),
    totalAssets: assets.length,
    unmatchedAssets: Math.max(0, assets.length - matched)
  };
}

function collectOrganizationEmployees(units) {
  const employees = [];
  (function visit(list) {
    (list || []).forEach(unit => {
      employees.push(...(unit.employees || []));
      visit(unit.children);
    });
  })(units);
  return employees;
}

function renderOrgTree(units) {
  if (!units || !units.length) return `<div class="emptyMini">${escapeHtml(t('orgEmpty'))}</div>`;
  return `<ul>${units.map(unit => renderOrgTreeNode(unit)).join('')}</ul>`;
}

function renderOrgTreeChildren(units) {
  if (!units || !units.length) return '';
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
    ${renderOrgTreeChildren(unit.children)}
  </li>`;
}

function orgTypeLabel(type) {
  const labels = {
    company: currentLang === 'zh-CN' ? '公司' : 'Company',
    'business-unit': currentLang === 'zh-CN' ? '事业部' : 'Business Unit',
    division: currentLang === 'zh-CN' ? '中心' : 'Division',
    department: currentLang === 'zh-CN' ? '部门' : 'Department',
    team: currentLang === 'zh-CN' ? '小组' : 'Team'
  };
  return labels[normalizeOrgType(type)] || labels.department;
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
      id: `org-${unitName}-${parts[1] || ''}`,
      type: parts.length >= 3 ? normalizeOrgType(parts[0]) : 'department',
      code: parts.length >= 3 ? parts[1] : '',
      name: unitName,
      manager: parts.length >= 4 ? parts[3] : '',
      children: []
    };
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
    stack[stack.length - 1].children.push(unit);
    stack.push({ depth, children: unit.children });
  });
  return normalizeOrgUnits(roots);
}

function openOrgModal() {
  if (!orgModal || !orgText) return;
  if (!selectedOrgEditorId) selectedOrgEditorId = firstOrgUnitId(organization.units);
  orgText.value = serializeOrgText(organization.units);
  renderOrganization();
  orgModal.hidden = false;
  if (orgName) orgName.focus();
}

function closeOrgModal() {
  if (orgModal) orgModal.hidden = true;
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
  renderOrganization();
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

function fillOrgParentOptions(info) {
  if (!orgParent) return;
  const selectedUnit = info && info.unit;
  const blockedIds = selectedUnit ? collectOrgDescendantIds(selectedUnit) : new Set();
  if (selectedUnit) blockedIds.add(selectedUnit.id);
  const nodes = flattenOrgUnits(organization.units).filter(node => !blockedIds.has(node.id));
  orgParent.innerHTML = `<option value="">${escapeHtml(t('orgRoot'))}</option>` + nodes.map(node => {
    const prefix = node.depth > 0 ? `${'  '.repeat(node.depth)}` : '';
    const label = `${prefix}${node.name}`;
    return `<option value="${escapeHtml(node.id)}">${escapeHtml(label)}</option>`;
  }).join('');
  orgParent.value = info && info.parent ? info.parent.id : '';
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
  fillOrgEmployeeParentOptions(selectedOrgEditorId);
  fillOrgEmployeeCopyTargetOptions(selectedOrgEditorId);
}

function fillOrgEmployeeParentOptions(selectedId) {
  if (!orgEmployeeParent) return;
  const nodes = flattenOrgUnits(organization.units);
  orgEmployeeParent.innerHTML = nodes.map(node => {
    const prefix = node.depth > 0 ? `${'  '.repeat(node.depth)}` : '';
    const label = `${prefix}${node.name}`;
    return `<option value="${escapeHtml(node.id)}">${escapeHtml(label)}</option>`;
  }).join('');
  orgEmployeeParent.value = nodes.some(node => node.id === selectedId) ? selectedId : firstOrgUnitId(organization.units);
}

function selectedOrgEmployeeParentInfo() {
  const targetId = orgEmployeeParent && orgEmployeeParent.value ? orgEmployeeParent.value : selectedOrgEditorId;
  return findOrgNodeInfo(targetId);
}

function fillOrgEmployeeCopyTargetOptions(currentId) {
  if (!orgEmployeeCopyTargets) return;
  const nodes = flattenOrgUnits(organization.units).filter(node => node.id !== currentId);
  orgEmployeeCopyTargets.innerHTML = nodes.map(node => {
    const prefix = node.depth > 0 ? `${'  '.repeat(node.depth)}` : '';
    const label = `${prefix}${node.name}`;
    return `<option value="${escapeHtml(node.id)}">${escapeHtml(label)}</option>`;
  }).join('');
}

function selectedOrgEmployeeCopyTargetInfos() {
  if (!orgEmployeeCopyTargets) return [];
  return Array.from(orgEmployeeCopyTargets.selectedOptions || [])
    .map(option => findOrgNodeInfo(option.value))
    .filter(Boolean);
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

function readOrgNodeForm() {
  return {
    type: normalizeOrgType(orgType ? orgType.value : 'department'),
    code: orgCode ? orgCode.value.trim() : '',
    name: orgName ? orgName.value.trim() : '',
    manager: orgManager ? orgManager.value.trim() : ''
  };
}

function createOrgUnit(parentName) {
  const baseName = currentLang === 'zh-CN' ? '新组织' : 'New Unit';
  const name = parentName ? `${baseName}` : baseName;
  return {
    id: `org-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'department',
    code: '',
    name,
    manager: '',
    employees: [],
    children: []
  };
}

function createTypedOrgUnit(type) {
  const labels = {
    company: currentLang === 'zh-CN' ? '\u65b0\u516c\u53f8' : 'New Company',
    department: currentLang === 'zh-CN' ? '\u65b0\u90e8\u95e8' : 'New Department',
    team: currentLang === 'zh-CN' ? '\u65b0\u5c0f\u7ec4' : 'New Team'
  };
  const unit = createOrgUnit('');
  unit.type = normalizeOrgType(type);
  unit.name = labels[unit.type] || labels.department;
  return unit;
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
  renderOrganization();
}

function addOrgChild() {
  let info = findOrgNodeInfo(selectedOrgEditorId);
  if (!info && organization.units.length) return alert(t('orgSelectNode'));
  const unit = createOrgUnit(info && info.unit && info.unit.name);
  if (info) info.unit.children.push(unit);
  else organization.units.push(unit);
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEditorId = unit.id;
  selectedOrgEmployeeId = '';
  renderOrganization();
}

function addOrgCompany() {
  const unit = createTypedOrgUnit('company');
  organization.units.push(unit);
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEditorId = unit.id;
  selectedOrgEmployeeId = '';
  renderOrganization();
}

function addOrgDepartment() {
  addTypedOrgChildOrRoot('department');
}

function addOrgTeam() {
  addTypedOrgChildOrRoot('team');
}

function addTypedOrgChildOrRoot(type) {
  const info = findOrgNodeInfo(selectedOrgEditorId);
  const unit = createTypedOrgUnit(type);
  if (info) info.unit.children.push(unit);
  else organization.units.push(unit);
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEditorId = unit.id;
  selectedOrgEmployeeId = '';
  renderOrganization();
}

function addOrgSibling() {
  const info = findOrgNodeInfo(selectedOrgEditorId);
  const unit = createOrgUnit(info && info.parent && info.parent.name);
  if (info) info.siblings.splice(info.index + 1, 0, unit);
  else organization.units.push(unit);
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEditorId = unit.id;
  selectedOrgEmployeeId = '';
  renderOrganization();
}

function deleteOrgNode() {
  const info = findOrgNodeInfo(selectedOrgEditorId);
  if (!info) return alert(t('orgSelectNode'));
  if (!confirm(t('orgDeleteConfirm'))) return;
  info.siblings.splice(info.index, 1);
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEditorId = firstOrgUnitId(organization.units);
  renderOrganization();
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
  renderOrganization();
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
  if (targetInfo.unit.id === sourceInfo.unit.id) {
    employees[index] = employee;
  } else {
    employees.splice(index, 1);
    targetInfo.unit.employees = targetInfo.unit.employees || [];
    targetInfo.unit.employees.push(employee);
    selectedOrgEditorId = targetInfo.unit.id;
  }
  organization = normalizeOrganization({ units: organization.units });
  selectedOrgEmployeeId = employee.id;
  renderOrganization();
}

function employeeSamePerson(left, right) {
  const leftId = String(left && left.employeeId || '').trim().toLowerCase();
  const rightId = String(right && right.employeeId || '').trim().toLowerCase();
  if (leftId && rightId) return leftId === rightId;
  return String(left && left.name || '').trim().toLowerCase() === String(right && right.name || '').trim().toLowerCase();
}

function copyOrgEmployee() {
  const sourceInfo = findOrgNodeInfo(selectedOrgEditorId);
  if (!sourceInfo) return alert(t('orgSelectNode'));
  const employees = sourceInfo.unit.employees || [];
  const index = employees.findIndex(employee => employee.id === selectedOrgEmployeeId);
  if (index < 0) return alert(t('orgSelectEmployee'));

  const employee = readOrgEmployeeForm();
  if (!employee.name) return alert(t('orgEmployeeNameRequired'));

  const targets = selectedOrgEmployeeCopyTargetInfos();
  if (targets.length === 0) {
    const fallback = selectedOrgEmployeeParentInfo();
    if (fallback) targets.push(fallback);
  }
  if (targets.length === 0) return alert(t('orgSelectNode'));

  let created = 0;
  let skipped = 0;
  let lastEmployeeId = selectedOrgEmployeeId;
  let lastNodeId = selectedOrgEditorId;
  targets.forEach((targetInfo, targetIndex) => {
    targetInfo.unit.employees = targetInfo.unit.employees || [];
    const existing = targetInfo.unit.employees.find(item => employeeSamePerson(item, employee));
    if (existing) {
      skipped++;
      lastEmployeeId = existing.id;
      lastNodeId = targetInfo.unit.id;
      return;
    }
    const copy = Object.assign({}, employee, {
      id: `emp-${Date.now().toString(36)}-${targetIndex}-${Math.random().toString(36).slice(2, 7)}`
    });
    targetInfo.unit.employees.push(copy);
    created++;
    lastEmployeeId = copy.id;
    lastNodeId = targetInfo.unit.id;
  });

  selectedOrgEditorId = lastNodeId;
  selectedOrgEmployeeId = lastEmployeeId;
  organization = normalizeOrganization({ units: organization.units });
  renderOrganization();
  alert(t('orgCopyEmployeeDone', { created, skipped }));
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
  renderOrganization();
}

function applyOrgText() {
  organization = normalizeOrganization({ units: parseOrgText(orgText ? orgText.value : '') });
  selectedOrgEditorId = firstOrgUnitId(organization.units);
  renderOrganization();
}

function exportOrganization() {
  const payload = {
    kind: 'it-asset-organization',
    version: 2,
    exportedAt: new Date().toISOString(),
    units: organization.units
  };
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
    renderOrganization();
  } catch (err) {
    alert(t('orgImportFailed', err && err.message ? err.message : String(err)));
  } finally {
    orgImportFile.value = '';
  }
}

async function saveOrganization() {
  const res = await authedFetch('/api/org', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ units: organization.units })
  });
  if (!res.ok) {
    alert(t('orgSaveFailed', await res.text()));
    return;
  }
  organization = normalizeOrganization(await res.json());
  closeOrgModal();
  renderOrganization();
  renderRows();
}

function organizationDescendantNames(name) {
  const target = String(name || '').trim().toLowerCase();
  return organizationDescendantScope(target).names;
}

function organizationDescendantScope(name) {
  const target = String(name || '').trim().toLowerCase();
  const names = new Set();
  const employees = new Set();

  function visit(units, matched) {
    (units || []).forEach(unit => {
      const current = String(unit.name || '').trim();
      const keys = [unit.id, unit.code, unit.name].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
      const isMatched = matched || keys.includes(target);
      if (isMatched && current) names.add(current.toLowerCase());
      if (isMatched) {
        (unit.employees || []).forEach(employee => {
          if (employee.name) employees.add(String(employee.name).trim().toLowerCase());
          if (employee.employeeId) employees.add(String(employee.employeeId).trim().toLowerCase());
        });
      }
      visit(unit.children, isMatched);
    });
  }

  visit(organization.units, false);
  if (target && names.size === 0) names.add(target);
  return { names, employees };
}

function assetMatchesOrganization(asset) {
  if (!selectedOrgUnit) return true;
  const scope = organizationDescendantScope(selectedOrgUnit);
  const user = asset.user || {};
  return scope.names.has(assetDepartment(asset).toLowerCase())
    || scope.employees.has(String(user.name || '').trim().toLowerCase())
    || scope.employees.has(String(user.employeeId || '').trim().toLowerCase());
}

function renderRows() {
  const searchQuery = buildSearchQuery(searchInput.value);
  const category = categoryFilter.value;
  const hasMissingFilter = selectedMissingFields.size > 0;
  const hasOrgFilter = Boolean(selectedOrgUnit);
  const hasKeyword = searchQuery.tokens.length > 0;
  const hasVisualFilter = Boolean(visualAssetFilter);
  const hasFilter = Boolean(hasKeyword || category || hasMissingFilter || hasOrgFilter || hasVisualFilter);
  const scoped = assets.filter(asset => {
    if (category && assetCategory(asset) !== category) return false;
    if (hasOrgFilter && !assetMatchesOrganization(asset)) return false;
    if (!hasKeyword) return true;
    return assetMatchesSearch(asset, searchQuery);
  });
  const visualScoped = scoped.filter(asset => assetMatchesVisualFilter(asset));
  const filtered = visualScoped.filter(asset => {
    if (hasMissingFilter && !assetMatchesMissingFields(asset)) return false;
    return true;
  }).sort(compareAssetsForDisplay);

  renderAssetOverview(filtered);
  renderResultSummary(filtered, visualScoped, hasFilter, hasMissingFilter);

  const groups = groupAssetsByDepartment(filtered);
  rows.innerHTML = groups.map(group => {
    const expanded = hasKeyword || hasVisualFilter || !hasSavedExpandedDepartmentKeys ? true : expandedDepartmentKeys.has(group.key);
    const groupRow = renderDepartmentGroupRow(group, expanded);
    const itemRows = expanded ? group.assets.map(asset => renderAssetRow(asset, hasKeyword ? assetSearchMatchDetails(asset, searchQuery) : null)).join('') : '';
    return groupRow + itemRows;
  }).join('');

  rows.querySelectorAll('[data-edit-id]').forEach(button => {
    button.addEventListener('click', () => editAsset(button.getAttribute('data-edit-id')));
  });
  rows.querySelectorAll('[data-department-key]').forEach(button => {
    button.addEventListener('click', () => toggleDepartmentGroup(button.getAttribute('data-department-key')));
  });
  rows.querySelectorAll('.rowSelect').forEach(input => {
    input.addEventListener('change', updateSelectedRows);
  });

  emptyState.style.display = filtered.length ? 'none' : 'block';
  updateSelectedRows();
}

function renderAssetOverview(items) {
  if (!assetHealthScore || !assetMetricGrid || !assetCategoryBars || !assetDepartmentBars || !assetIssueList) return;
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const missingByField = assetMissingFieldCounts(list);
  const missingRecordCount = list.filter(asset => missingFieldHitsForAll(asset).length > 0).length;
  const completeCount = Math.max(0, total - missingRecordCount);
  const abnormalDiskCount = list.reduce((sum, asset) => sum + (asset.disks || []).filter(disk => isAbnormalDisk(disk)).length, 0);
  const completeness = total ? Math.round(completeCount / total * 100) : 0;
  const abnormalPenalty = total ? Math.min(35, Math.round(abnormalDiskCount / total * 18)) : 0;
  const healthScore = Math.max(0, Math.min(100, completeness - abnormalPenalty));

  assetHealthScore.textContent = t('assetHealthScore', healthScore);
  assetHealthScore.className = `assetHealthScore ${healthScore < 70 ? 'warn' : ''}`;
  assetMetricGrid.innerHTML = [
    renderAssetMetric(t('assetMetricTotal'), total, '', 'all', ''),
    renderAssetMetric(t('assetMetricComplete'), t('assetCompleteCount', { complete: completeCount, total }), completeCount < total ? 'warn' : '', 'complete', ''),
    renderAssetMetric(t('assetMetricMissing'), missingRecordCount, missingRecordCount ? 'warn' : '', 'missingAny', ''),
    renderAssetMetric(t('assetMetricAbnormal'), abnormalDiskCount, abnormalDiskCount ? 'warn' : '', 'abnormal', '')
  ].join('');

  const categories = countBy(
    list,
    asset => assetCategory(asset) || t('uncategorized'),
    asset => assetCategory(asset) || '__uncategorized__'
  );
  const departments = countBy(
    list,
    asset => assetDepartment(asset) || t('unassignedDepartment'),
    asset => assetDepartment(asset) || '__unassigned__'
  );
  assetCategoryCount.textContent = t('assetIssueCount', categories.length);
  assetDepartmentCount.textContent = t('assetIssueCount', departments.length);
  assetCategoryBars.innerHTML = renderAssetBars(categories, total, 'category');
  assetDepartmentBars.innerHTML = renderAssetBars(departments, total, 'department');

  const issues = missingByField
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 6);
  assetIssueCount.textContent = t('assetIssueCount', issues.length + (abnormalDiskCount ? 1 : 0));
  assetIssueList.innerHTML = issues.length || abnormalDiskCount
    ? `${issues.map(item => renderAssetIssue(item.label, item.count, total, 'missing', item.id)).join('')}${abnormalDiskCount ? renderAssetIssue(t('assetMetricAbnormal'), abnormalDiskCount, Math.max(total, abnormalDiskCount), 'abnormal', '') : ''}`
    : `<div class="assetEmptyVisual">${escapeHtml(t('assetNoChartData'))}</div>`;
  updateAssetVisualFilterUi();
  bindAssetVisualActions();
}

function renderAssetMetric(label, value, tone, filterType, filterValue) {
  return `<button class="assetMetric ${escapeHtml(tone || '')}" type="button" data-asset-visual-filter="${escapeHtml(filterType || '')}" data-asset-visual-value="${escapeHtml(filterValue || '')}">
    <strong>${escapeHtml(value)}</strong>
    <span>${escapeHtml(label)}</span>
  </button>`;
}

function renderAssetBars(items, total, filterType) {
  const visible = items.slice(0, 6);
  if (!visible.length) return `<div class="assetEmptyVisual">${escapeHtml(t('assetNoChartData'))}</div>`;
  return visible.map(item => {
    const percent = total ? Math.max(4, Math.round(item.count / total * 100)) : 0;
    return `<button class="assetBarRow" type="button" data-asset-visual-filter="${escapeHtml(filterType || '')}" data-asset-visual-value="${escapeHtml(item.value || item.label)}">
      <div class="assetBarLabel"><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.count)}</b></div>
      <div class="assetBarTrack"><i style="width: ${percent}%"></i></div>
    </button>`;
  }).join('');
}

function renderAssetIssue(label, count, total, filterType, filterValue) {
  const percent = total ? Math.max(4, Math.round(count / total * 100)) : 0;
  return `<button class="assetIssueItem" type="button" data-asset-visual-filter="${escapeHtml(filterType || '')}" data-asset-visual-value="${escapeHtml(filterValue || '')}">
    <div class="assetBarLabel"><span>${escapeHtml(label)}</span><b>${escapeHtml(count)}</b></div>
    <div class="assetBarTrack warn"><i style="width: ${percent}%"></i></div>
  </button>`;
}

function countBy(items, labelFn, valueFn) {
  const counts = new Map();
  (items || []).forEach(item => {
    const label = String(labelFn(item) || '').trim() || '-';
    const value = String((valueFn ? valueFn(item) : label) || '').trim() || '-';
    if (!counts.has(value)) counts.set(value, { label, value, count: 0 });
    counts.get(value).count++;
  });
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function assetMissingFieldCounts(items) {
  return MISSING_FIELD_FILTERS.map(filter => ({
    id: filter.id,
    label: t(filter.labelKey),
    count: (items || []).filter(asset => isAssetFieldMissing(asset, filter.id)).length
  }));
}

function missingFieldHitsForAll(asset) {
  return MISSING_FIELD_FILTERS
    .filter(filter => isAssetFieldMissing(asset, filter.id))
    .map(filter => filter.id);
}

function bindAssetVisualActions() {
  document.querySelectorAll('[data-asset-visual-filter]').forEach(button => {
    button.addEventListener('click', () => {
      applyAssetVisualFilter(button.getAttribute('data-asset-visual-filter'), button.getAttribute('data-asset-visual-value'));
    });
  });
}

function applyAssetVisualFilter(type, value) {
  if (!type || type === 'all') {
    visualAssetFilter = null;
  } else {
    visualAssetFilter = { type, value: value || '' };
  }
  renderRows();
  document.querySelector('.tablePanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearAssetVisualFilter() {
  visualAssetFilter = null;
  renderRows();
}

function updateAssetVisualFilterUi() {
  if (assetOverviewHint) {
    assetOverviewHint.textContent = visualAssetFilter
      ? t('assetVisualFilterActive', assetVisualFilterLabel())
      : t('assetOverviewHint');
  }
  if (clearAssetVisualFilterBtn) {
    clearAssetVisualFilterBtn.hidden = !visualAssetFilter;
  }
}

function assetMatchesVisualFilter(asset) {
  if (!visualAssetFilter) return true;
  const value = visualAssetFilter.value || '';
  switch (visualAssetFilter.type) {
    case 'category':
      return value === '__uncategorized__' ? !assetCategory(asset) : assetCategory(asset) === value;
    case 'department':
      return value === '__unassigned__' ? !assetDepartment(asset) : assetDepartment(asset) === value;
    case 'missing':
      return isAssetFieldMissing(asset, value);
    case 'missingAny':
      return missingFieldHitsForAll(asset).length > 0;
    case 'complete':
      return missingFieldHitsForAll(asset).length === 0;
    case 'abnormal':
      return (asset.disks || []).some(disk => isAbnormalDisk(disk));
    default:
      return true;
  }
}

function assetVisualFilterLabel() {
  if (!visualAssetFilter) return '';
  const value = visualAssetFilter.value || '';
  switch (visualAssetFilter.type) {
    case 'category':
      return value === '__uncategorized__' ? t('uncategorized') : value;
    case 'department':
      return value === '__unassigned__' ? t('unassignedDepartment') : value;
    case 'missing': {
      const filter = MISSING_FIELD_FILTERS.find(item => item.id === value);
      return filter ? t(filter.labelKey) : value;
    }
    case 'missingAny':
      return t('assetMetricMissing');
    case 'complete':
      return t('assetMetricComplete');
    case 'abnormal':
      return t('assetMetricAbnormal');
    default:
      return value;
  }
}

function renderResultSummary(filtered, scoped, hasFilter, hasMissingFilter) {
  if (!totalText) return;
  if (hasMissingFilter) {
    const details = missingFieldResultDetails(scoped);
    const visibleDetails = details.slice(0, 5);
    const hiddenCount = Math.max(0, details.length - visibleDetails.length);
    totalText.innerHTML = `<span class="resultMain">${escapeHtml(t('missingResultTitle', {
      filtered: filtered.length,
      scoped: scoped.length,
      total: assets.length
    }))}</span><span class="resultDetail">${visibleDetails.map(item => `<span class="resultChip">${escapeHtml(t('missingResultItem', item))}</span>`).join('')}${hiddenCount ? `<span class="resultChip muted">${escapeHtml(t('missingResultMore', hiddenCount))}</span>` : ''}</span>`;
    updateStickyOffsets();
    return;
  }

  totalText.textContent = hasFilter
    ? t('filteredTotal', { filtered: filtered.length, total: assets.length })
    : t('total', assets.length);
  updateStickyOffsets();
}

function missingFieldResultDetails(scopeItems) {
  return Array.from(selectedMissingFields)
    .map(fieldId => {
      const filter = MISSING_FIELD_FILTERS.find(item => item.id === fieldId);
      return {
        id: fieldId,
        label: filter ? t(filter.labelKey) : fieldId,
        count: scopeItems.filter(asset => isAssetFieldMissing(asset, fieldId)).length
      };
    });
}

function groupAssetsByCategory(items) {
  const groups = new Map();
  items.forEach(asset => {
    const key = assetCategoryKey(asset);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: assetCategory(asset) || t('uncategorized'),
        assets: [],
        ipCount: 0,
        abnormalDiskCount: 0,
        latestTime: ''
      });
    }

    const group = groups.get(key);
    group.assets.push(asset);
    group.ipCount += assetIpv4List(asset).length;
    group.abnormalDiskCount += (asset.disks || []).filter(disk => isAbnormalDisk(disk)).length;
    group.latestTime = latestTime(group.latestTime, asset.updatedAt || asset.createdAt);
  });
  return Array.from(groups.values());
}

function groupAssetsByDepartment(items) {
  const groups = new Map();
  items.forEach(asset => {
    const department = assetDepartment(asset);
    const key = department ? `department:${department.toLowerCase()}` : 'department:__unassigned__';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: department || t('unassignedDepartment'),
        assets: [],
        ipCount: 0,
        abnormalDiskCount: 0,
        latestTime: ''
      });
    }

    const group = groups.get(key);
    group.assets.push(asset);
    group.ipCount += assetIpv4List(asset).length;
    group.abnormalDiskCount += (asset.disks || []).filter(disk => isAbnormalDisk(disk)).length;
    group.latestTime = latestTime(group.latestTime, asset.updatedAt || asset.createdAt);
  });
  return Array.from(groups.values());
}

function renderDepartmentGroupRow(group, expanded) {
  const abnormalText = group.abnormalDiskCount
    ? t('categoryGroupAbnormal', group.abnormalDiskCount)
    : t('categoryGroupNoAbnormal');
  const toggleText = expanded ? t('collapseDepartment') : t('expandDepartment');
  return `<tr class="categoryGroupRow ${expanded ? 'expanded' : ''}">
    <td colspan="9">
      <button class="categoryToggle" type="button" data-department-key="${escapeHtml(group.key)}" title="${escapeHtml(toggleText)}">
        <span class="categoryArrow" aria-hidden="true">${expanded ? 'v' : '>'}</span>
        <span class="categoryName">${escapeHtml(group.label)}</span>
        <span class="categorySummary">${escapeHtml(t('categoryGroupCount', group.assets.length))}</span>
        <span class="categorySummary">${escapeHtml(t('categoryGroupIps', group.ipCount))}</span>
        <span class="categorySummary ${group.abnormalDiskCount ? 'warn' : ''}">${escapeHtml(abnormalText)}</span>
        <span class="categorySummary">${escapeHtml(t('categoryGroupLatest', formatDate(group.latestTime)))}</span>
      </button>
    </td>
  </tr>`;
}

function renderCategoryGroupRow(group, expanded) {
  const abnormalText = group.abnormalDiskCount
    ? t('categoryGroupAbnormal', group.abnormalDiskCount)
    : t('categoryGroupNoAbnormal');
  const toggleText = expanded ? t('collapseCategory') : t('expandCategory');
  return `<tr class="categoryGroupRow ${expanded ? 'expanded' : ''}">
    <td colspan="9">
      <button class="categoryToggle" type="button" data-category-key="${escapeHtml(group.key)}" title="${escapeHtml(toggleText)}">
        <span class="categoryArrow" aria-hidden="true">${expanded ? 'v' : '>'}</span>
        <span class="categoryName">${escapeHtml(group.label)}</span>
        <span class="categorySummary">${escapeHtml(t('categoryGroupCount', group.assets.length))}</span>
        <span class="categorySummary">${escapeHtml(t('categoryGroupIps', group.ipCount))}</span>
        <span class="categorySummary ${group.abnormalDiskCount ? 'warn' : ''}">${escapeHtml(abnormalText)}</span>
        <span class="categorySummary">${escapeHtml(t('categoryGroupLatest', formatDate(group.latestTime)))}</span>
      </button>
    </td>
  </tr>`;
}

function renderAssetRow(asset, searchDetails) {
  const meta = asset.metadata || {};
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  const category = assetCategory(asset);
  const missingIds = missingFieldHits(asset);
  const nics = (asset.networkAdapters || []).map((nic, index) => {
    const ips = (nic.ipAddresses || []).filter(isIpv4);
    const renderedIps = ips.length
      ? ips.map(ip => renderSearchValue(ip, 'ipAddress', searchDetails)).join(', ')
      : '-';
    return `<div class="infoBlock">
      <div class="blockTitle">${escapeHtml(t('nicIndex', index + 1))}</div>
      <div>${renderSearchValue(nic.name, 'nicName', searchDetails)}</div>
      <small class="mono">MAC: ${renderSearchValue(formatMac(nic.macAddress), 'macAddress', searchDetails, '-', [nic.macAddress])}
IPv4: ${renderedIps}</small>
    </div>`;
  }).join('');

  const disks = (asset.disks || []).map((disk, index) => {
    const abnormalClass = isAbnormalDisk(disk) ? ' abnormalDisk' : '';
    return `<div class="infoBlock diskBlock${abnormalClass}">
    <div class="blockTitle">${escapeHtml(t('diskIndex', index + 1))}</div>
    <div>${renderSearchValue(disk.model, 'diskModel', searchDetails)}</div>
    <small class="mono">SN: ${renderSearchValue(disk.serialNumber, 'diskSerial', searchDetails)}
${escapeHtml(t('size'))}: ${renderSearchValue(disk.sizeText || formatBytes(disk.sizeBytes), 'diskSize', searchDetails, '-', [disk.sizeBytes])}</small>
  </div>`;
  }).join('');

  const rowClass = searchDetails && searchDetails.matched ? 'assetDetailRow searchHitRow' : 'assetDetailRow';
  const userDetails = renderSearchParts([
    ['department', asset.user.department],
    ['employeeId', asset.user.employeeId],
    ['location', asset.user.location]
  ], searchDetails);
  const osDetails = renderSearchParts([
    ['osCaption', asset.system.osCaption],
    ['osVersion', asset.system.osVersion]
  ], searchDetails);
  const boardManufacturer = displayBoardManufacturer(asset.baseBoard.manufacturer);
  const primaryComputer = asset.system.computerCode || asset.system.computerName;
  const primaryComputerField = asset.system.computerCode ? 'computerCode' : 'computerName';

  return `<tr class="${rowClass}">
    <td><input class="rowSelect" type="checkbox" value="${escapeHtml(asset.id)}"></td>
    <td class="${searchCellClass(searchDetails, ['category', 'tag'])}">${renderCategoryChip(category, searchDetails, tags)}</td>
    <td class="${tableCellClass(missingIds, ['userName', 'department', 'location'], searchDetails, ['userName', 'department', 'employeeId', 'location'])}">${renderMissingBadges(missingIds, ['userName', 'department', 'location'])}<strong>${renderSearchValue(asset.user.name, 'userName', searchDetails)}</strong><small>${userDetails}</small></td>
    <td class="${tableCellClass(missingIds, ['computerName', 'computerCode', 'osCaption'], searchDetails, ['computerCode', 'computerName', 'osCaption', 'osVersion', 'installDate'])}">${renderMissingBadges(missingIds, ['computerName', 'computerCode', 'osCaption'])}<strong>${renderSearchValue(primaryComputer, primaryComputerField, searchDetails)}</strong><small>${escapeHtml(t('computerLabel'))}: ${renderSearchValue(asset.system.computerName, 'computerName', searchDetails)}
${osDetails}
${escapeHtml(t('installLabel'))}: ${renderSearchValue(asset.system.installDate, 'installDate', searchDetails)}</small></td>
    <td class="${tableCellClass(missingIds, ['ipAddress', 'macAddress'], searchDetails, ['nicName', 'macAddress', 'ipAddress'])}">${renderMissingBadges(missingIds, ['ipAddress', 'macAddress'])}${nics || '-'}</td>
    <td class="${tableCellClass(missingIds, ['diskSerial'], searchDetails, ['diskModel', 'diskSerial', 'diskSize'])}">${renderMissingBadges(missingIds, ['diskSerial'])}${disks || '-'}</td>
    <td class="${tableCellClass(missingIds, ['boardManufacturer', 'boardProduct', 'boardSerial'], searchDetails, ['boardManufacturer', 'boardProduct', 'boardSerial'])}">${renderMissingBadges(missingIds, ['boardManufacturer', 'boardProduct', 'boardSerial'])}${renderSearchValue(boardManufacturer, 'boardManufacturer', searchDetails, '-', [asset.baseBoard.manufacturer])}<small>${renderSearchValue(asset.baseBoard.product, 'boardProduct', searchDetails)}</small></td>
    <td>${formatDate(asset.createdAt)}<small>${escapeHtml(t('updatedLabel'))}: ${formatDate(asset.updatedAt)}</small></td>
    <td><button type="button" data-edit-id="${escapeHtml(asset.id)}">${escapeHtml(t('edit'))}</button></td>
  </tr>`;
}

function missingFieldHits(asset) {
  if (!selectedMissingFields.size) return new Set();
  return new Set(Array.from(selectedMissingFields).filter(fieldId => isAssetFieldMissing(asset, fieldId)));
}

function missingCellClass(missingIds, fieldIds) {
  return fieldIds.some(fieldId => missingIds.has(fieldId)) ? 'missingHitCell' : '';
}

function tableCellClass(missingIds, missingFieldIds, searchDetails, searchFieldIds) {
  return [missingCellClass(missingIds, missingFieldIds), searchCellClass(searchDetails, searchFieldIds)]
    .filter(Boolean)
    .join(' ');
}

function searchCellClass(searchDetails, fieldIds) {
  if (!searchDetails || !searchDetails.matched) return '';
  return fieldIds.some(fieldId => searchDetails.fields.has(fieldId)) ? 'searchHitCell' : '';
}

function renderMissingBadges(missingIds, fieldIds) {
  const hits = fieldIds.filter(fieldId => missingIds.has(fieldId));
  if (!hits.length) return '';
  return `<div class="missingBadges">${hits.map(fieldId => {
    const filter = MISSING_FIELD_FILTERS.find(item => item.id === fieldId);
    return `<span>${escapeHtml(filter ? t(filter.labelKey) : fieldId)}</span>`;
  }).join('')}</div>`;
}

function toggleCategoryGroup(key) {
  if (!key) return;
  if (expandedCategoryKeys.has(key)) expandedCategoryKeys.delete(key);
  else expandedCategoryKeys.add(key);
  saveExpandedCategoryKeys();
  renderRows();
}

function toggleDepartmentGroup(key) {
  if (!key) return;
  if (expandedDepartmentKeys.has(key)) expandedDepartmentKeys.delete(key);
  else expandedDepartmentKeys.add(key);
  saveExpandedDepartmentKeys();
  renderRows();
}

function renderMissingFieldFilters() {
  if (!missingFieldFilters || !missingFieldSummary) return;

  missingFieldSummary.textContent = selectedMissingFields.size
    ? t('missingFieldFilterActive', selectedMissingFields.size)
    : t('missingFieldFilter');
  missingFieldFilters.innerHTML = MISSING_FIELD_FILTERS.map(filter => {
    const count = assets.filter(asset => isAssetFieldMissing(asset, filter.id)).length;
    const activeClass = selectedMissingFields.has(filter.id) ? ' active' : '';
    return `<label class="missingFieldOption${activeClass}">
    <input type="checkbox" value="${escapeHtml(filter.id)}" ${selectedMissingFields.has(filter.id) ? 'checked' : ''}>
    <span class="missingFieldLabel">${escapeHtml(t(filter.labelKey))}</span>
    <span class="missingFieldCount">${escapeHtml(t('missingFieldOptionCount', count))}</span>
  </label>`;
  }).join('');
  updateStickyOffsets();
}

function changeMissingFieldFilters(event) {
  const input = event.target;
  if (!input || input.type !== 'checkbox') return;
  if (input.checked) selectedMissingFields.add(input.value);
  else selectedMissingFields.delete(input.value);
  saveSelectedMissingFields();
  renderMissingFieldFilters();
  renderRows();
}

function clearMissingFieldFilters() {
  selectedMissingFields.clear();
  saveSelectedMissingFields();
  renderMissingFieldFilters();
  renderRows();
}

function assetMatchesMissingFields(asset) {
  return Array.from(selectedMissingFields).every(fieldId => isAssetFieldMissing(asset, fieldId));
}

function isAssetFieldMissing(asset, fieldId) {
  const filter = MISSING_FIELD_FILTERS.find(item => item.id === fieldId);
  if (!filter) return false;
  if (typeof filter.isMissing === 'function') return filter.isMissing(asset);
  return !String(valueAtPath(asset, filter.path) || '').trim();
}

function valueAtPath(source, pathParts) {
  return (pathParts || []).reduce((value, key) => {
    if (!value || typeof value !== 'object') return '';
    return value[key];
  }, source);
}

function renderCategoryChip(category, searchDetails, tags = []) {
  const categoryClass = searchValueMatches(searchDetails, 'category', category) ? ' searchHitChip' : '';
  const tagText = (tags || []).filter(Boolean).join(', ');
  const tagClass = (tags || []).some(tag => searchValueMatches(searchDetails, 'tag', tag)) ? ' searchHitChip' : '';
  return `<div class="chipList categoryCellChips">
    <span class="chip categoryChip${categoryClass}">${escapeHtml(category || t('uncategorized'))}</span>
    ${tagText ? `<span class="tagSubline${tagClass}">${escapeHtml(tagText)}</span>` : ''}
  </div>`;
}

function renderTagChips(tags, searchDetails) {
  const chips = [];
  (tags || []).forEach(tag => {
    const tagClass = searchValueMatches(searchDetails, 'tag', tag) ? ' searchHitChip' : '';
    chips.push(`<span class="chip${tagClass}">${escapeHtml(tag)}</span>`);
  });
  return chips.length ? `<div class="chipList">${chips.join('')}</div>` : `<span class="mutedText">-</span>`;
}

function compareAssetsForDisplay(left, right) {
  return compareText(assetDepartment(left), assetDepartment(right))
    || compareText(assetCategory(left), assetCategory(right))
    || compareText(assetPrimaryTag(left), assetPrimaryTag(right))
    || compareTimeDesc(left.updatedAt || left.createdAt, right.updatedAt || right.createdAt)
    || compareText(assetComputerName(left), assetComputerName(right));
}

function compareText(left, right) {
  const a = normalizeSortText(left);
  const b = normalizeSortText(right);
  const aEmpty = !a;
  const bEmpty = !b;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return a.localeCompare(b, currentLang);
}

function compareTimeDesc(left, right) {
  const a = Date.parse(left || '');
  const b = Date.parse(right || '');
  const aValid = !Number.isNaN(a);
  const bValid = !Number.isNaN(b);
  if (aValid && bValid && a !== b) return b - a;
  if (aValid && !bValid) return -1;
  if (!aValid && bValid) return 1;
  return 0;
}

function normalizeSortText(value) {
  return String(value || '').trim().toLowerCase();
}

function assetDepartment(asset) {
  return ((asset.user || {}).department || '').trim();
}

function assetPrimaryTag(asset) {
  const tags = ((asset.metadata || {}).tags || []).filter(Boolean);
  return tags.length ? tags[0] : '';
}

function assetComputerName(asset) {
  const system = asset.system || {};
  return system.computerCode || system.computerName || '';
}

function selectedAbnormalDiskSources(sourceIds) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) return ABNORMAL_DISK_SOURCES;
  const selected = new Set(sourceIds);
  return ABNORMAL_DISK_SOURCES.filter(source => selected.has(source.id));
}

function abnormalDiskSource(disk, sourceIds) {
  const model = String((disk || {}).model || '').trim().toLowerCase();
  const serial = String((disk || {}).serialNumber || '').trim().toLowerCase();
  const combined = `${model} ${serial}`;
  if (!combined.trim()) return null;

  return selectedAbnormalDiskSources(sourceIds)
    .find(source => source.hints.some(hint => combined.includes(hint))) || null;
}

function isAbnormalDisk(disk, sourceIds) {
  return Boolean(abnormalDiskSource(disk, sourceIds));
}

function displayBoardManufacturer(value) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  const brand = BOARD_BRAND_NAMES.find(item => item.hints.some(hint => normalized.includes(hint)));
  return brand ? brand.name : raw;
}

function abnormalDiskSourceStats() {
  const counts = Object.fromEntries(ABNORMAL_DISK_SOURCES.map(source => [source.id, 0]));
  assets.forEach(asset => {
    (asset.disks || []).forEach(disk => {
      const source = abnormalDiskSource(disk);
      if (source) counts[source.id]++;
    });
  });
  return ABNORMAL_DISK_SOURCES
    .map(source => Object.assign({}, source, { count: counts[source.id] || 0 }))
    .filter(source => source.count > 0);
}

function selectedIds() {
  return Array.from(document.querySelectorAll('.rowSelect:checked'))
    .map(input => input.value)
    .filter(Boolean);
}

function toggleSelectAll() {
  document.querySelectorAll('.rowSelect').forEach(input => {
    input.checked = selectAll.checked;
  });
  updateSelectedRows();
}

function updateSelectedRows() {
  const visibleInputs = Array.from(document.querySelectorAll('.rowSelect'));
  let checkedCount = 0;
  visibleInputs.forEach(input => {
    const row = input.closest('tr');
    if (!row) return;
    row.classList.toggle('selectedAssetRow', input.checked);
    if (input.checked) checkedCount++;
  });

  selectAll.checked = visibleInputs.length > 0 && checkedCount === visibleInputs.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < visibleInputs.length;
}

function exportSelectedAssets() {
  const ids = selectedIds();
  if (ids.length === 0) {
    alert(t('selectExportFirst'));
    return;
  }
  window.location.href = withServerKey(`/export.xls?ids=${encodeURIComponent(ids.join(','))}`);
}

function exportAllAssets(event) {
  event.preventDefault();
  window.location.href = withServerKey('/export.xls');
}

async function deleteSelectedAssets() {
  const ids = selectedIds();
  if (ids.length === 0) {
    alert(t('selectDeleteFirst'));
    return;
  }
  if (!confirm(t('confirmDeleteSelected', ids.length))) return;

  const res = await authedFetch('/api/assets/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
  if (!res.ok) {
    alert(t('batchDeleteFailed', await res.text()));
    return;
  }
  clearEditor();
  await loadAssets();
}

async function setSelectedCategory() {
  const ids = selectedIds();
  if (ids.length === 0) {
    alert(t('categoryManageNoSelection'));
    return;
  }

  pendingCategoryIds = ids;
  selectedBatchCategory = categoryFilter.value || selectedCommonCategory(ids);
  if (categoryCustomInput) categoryCustomInput.value = selectedBatchCategory;
  if (categorySelectHint) categorySelectHint.textContent = t('categorySelectHint', ids.length);
  renderCategoryQuickList();
  if (categorySelectModal) categorySelectModal.hidden = false;
  if (categoryCustomInput) categoryCustomInput.focus();
}

function closeCategorySelectModal() {
  if (categorySelectModal) categorySelectModal.hidden = true;
  pendingCategoryIds = [];
  selectedBatchCategory = '';
}

function selectedCommonCategory(ids) {
  const selected = assets.filter(asset => ids.includes(asset.id)).map(assetCategory);
  const first = selected[0] || '';
  return selected.every(category => category === first) ? first : '';
}

function categoryUsageCounts() {
  const counts = new Map();
  assets.forEach(asset => {
    const category = assetCategory(asset);
    if (!category) return;
    const key = category.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function renderCategoryQuickList() {
  if (!categoryQuickList) return;
  const categories = normalizeCategoryNames(presetCategories.concat(assets.map(assetCategory)));
  const usage = categoryUsageCounts();
  if (!categories.length) {
    categoryQuickList.innerHTML = `<div class="emptyMini">${escapeHtml(t('categoryPresetEmpty'))}</div>`;
    return;
  }
  categoryQuickList.innerHTML = categories.map(category => {
    const selected = category.toLowerCase() === String(selectedBatchCategory || '').toLowerCase();
    const count = usage.get(category.toLowerCase()) || 0;
    return `<button class="categoryChoice ${selected ? 'selectedCategoryChoice' : ''}" type="button" data-category-choice="${escapeHtml(category)}">
      <span>${escapeHtml(category)}</span>
      <small>${escapeHtml(t('categoryInUse', count))}</small>
    </button>`;
  }).join('');
  categoryQuickList.querySelectorAll('[data-category-choice]').forEach(button => {
    button.addEventListener('click', () => {
      selectedBatchCategory = button.getAttribute('data-category-choice') || '';
      if (categoryCustomInput) categoryCustomInput.value = selectedBatchCategory;
      renderCategoryQuickList();
    });
  });
}

async function applySelectedCategory(input) {
  const ids = pendingCategoryIds.slice();
  if (!ids.length) return;
  const category = String(input == null ? '' : input).trim();

  const res = await authedFetch('/api/assets/batch-category', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, category })
  });
  if (!res.ok) {
    alert(t('categoryUpdateFailed', await res.text()));
    return;
  }

  const result = await res.json();
  if (category && !normalizeCategoryNames(presetCategories).some(item => item.toLowerCase() === category.toLowerCase())) {
    await saveCategoryListSilently(normalizeCategoryNames(presetCategories.concat(category)));
  }
  alert(t('categoryUpdated', result.updated || 0));
  closeCategorySelectModal();
  clearEditor();
  await loadAssets();
}

async function saveCategoryListSilently(categories) {
  saveCategoryListSilently.lastError = '';
  const res = await authedFetch('/api/categories', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories })
  });
  if (!res.ok) {
    saveCategoryListSilently.lastError = await res.text();
    return false;
  }
  const result = await res.json();
  presetCategories = normalizeCategoryNames(result.categories || categories);
  return true;
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

async function checkClientInstallations() {
  const res = await authedFetch('/api/client-installations', { cache: 'no-store' });
  if (!res.ok) {
    alert(t('checkClientsFailed', await res.text()));
    return;
  }

  const result = await res.json();
  const computers = Array.isArray(result.computers) ? result.computers : [];
  const missing = computers.filter(item => !item.installed).slice(0, 30);
  const extra = computers.filter(item => item.assetMissing).slice(0, 30);
  let message = t('checkClientsSummary', result.summary || {});
  if (missing.length) {
    message += t('checkClientsMissingTitle', missing.length)
      + '\n' + missing.map(clientStatusLine).join('\n');
  }
  if (extra.length) {
    message += t('checkClientsExtraTitle', extra.length)
      + '\n' + extra.map(clientStatusLine).join('\n');
  }
  alert(message);
}

function clientStatusLine(item) {
  return [
    item.department || '-',
    item.computerCode || item.computerName || '-',
    item.userName || '-',
    item.lastSeenAt ? formatDate(item.lastSeenAt) : ''
  ].filter(Boolean).join(' / ');
}

async function reviewCollectSelected() {
  const ids = selectedIds();
  if (ids.length === 0) {
    alert(t('reviewCollectNoSelection'));
    return;
  }

  const selected = assets.filter(asset => ids.includes(asset.id));
  const targets = Array.from(new Set(selected
    .map(asset => String((asset.system || {}).computerName || '').trim())
    .filter(Boolean)));
  if (targets.length === 0) {
    alert(t('reviewCollectNoComputer'));
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
}

async function reviewCollectionDiffs() {
  const res = await authedFetch('/api/collect/status', { cache: 'no-store' });
  if (!res.ok) {
    alert(t('reviewDiffFailed', await res.text()));
    return;
  }

  const result = await res.json();
  const pending = [];
  (result.requests || []).forEach(request => {
    (request.reports || []).forEach(report => {
      if (report && report.pendingReview) pending.push({ request, report });
    });
  });
  if (pending.length === 0) {
    alert(t('reviewDiffsEmpty'));
    return;
  }

  for (const item of pending) {
    const text = renderReviewDiffText(item.request, item.report);
    if (!confirm(t('reviewDiffConfirm', text))) continue;

    const applyRes = await authedFetch('/api/collect/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: item.request.id, computerName: item.report.computerName })
    });
    if (!applyRes.ok) {
      alert(t('reviewDiffFailed', await applyRes.text()));
      return;
    }
    alert(t('reviewDiffApplied'));
    await loadAssets();
  }
}

function renderReviewDiffText(request, report) {
  const lines = [
    `任务：${request.id}`,
    `电脑：${report.computerName || '-'}`,
    `回报时间：${formatDate(report.reportedAt)}`,
    `差异数量：${(report.diff || []).length}`
  ];
  (report.diff || []).slice(0, 12).forEach(diff => {
    lines.push(`${diff.label || diff.field}:`);
    lines.push(`  原：${shortDiffValue(diff.oldValue)}`);
    lines.push(`  新：${shortDiffValue(diff.newValue)}`);
  });
  if ((report.diff || []).length > 12) lines.push(`  ... ${report.diff.length - 12} more`);
  return lines.join('\n');
}

function shortDiffValue(value) {
  const text = String(value == null || value === '' ? '-' : value);
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function openCategoryModal() {
  if (!categoryModal || !categoryPresetInput) return;
  editingCategories = normalizeCategoryNames(presetCategories.concat(assets.map(assetCategory)));
  categoryPresetInput.value = '';
  renderCategoryPresetList();
  categoryModal.hidden = false;
  categoryPresetInput.focus();
}

function closeCategoryModal() {
  if (categoryModal) categoryModal.hidden = true;
}

function addCategoryPresetFromInput() {
  const name = String(categoryPresetInput.value || '').trim();
  if (!name) return;
  editingCategories = normalizeCategoryNames(editingCategories.concat(name));
  categoryPresetInput.value = '';
  renderCategoryPresetList();
  categoryPresetInput.focus();
}

function removeCategoryPreset(name) {
  const target = String(name || '').toLowerCase();
  editingCategories = editingCategories.filter(item => item.toLowerCase() !== target);
  renderCategoryPresetList();
}

function renderCategoryPresetList() {
  if (!categoryPresetList || !categoryPresetCount) return;
  const usage = categoryUsageCounts();
  const hasSelection = selectedIds().length > 0;
  categoryPresetCount.textContent = t('categoryPresetCount', editingCategories.length);
  categoryPresetList.innerHTML = editingCategories.length
    ? editingCategories.map(name => `<div class="categoryPresetItem">
        <span>${escapeHtml(name)}</span>
        <small>${escapeHtml(t('categoryInUse', usage.get(name.toLowerCase()) || 0))}</small>
        <button type="button" data-category-apply="${escapeHtml(name)}" ${hasSelection ? '' : 'disabled'}>${escapeHtml(t('categoryUseThis'))}</button>
        <button type="button" data-category-remove="${escapeHtml(name)}" title="Remove">x</button>
      </div>`).join('')
    : `<div class="emptyMini">${escapeHtml(t('categoryPresetEmpty'))}</div>`;
  categoryPresetList.querySelectorAll('[data-category-apply]').forEach(button => {
    button.addEventListener('click', () => {
      const ids = selectedIds();
      if (!ids.length) {
        alert(t('categoryManageNoSelection'));
        return;
      }
      pendingCategoryIds = ids;
      applySelectedCategory(button.getAttribute('data-category-apply') || '');
    });
  });
  categoryPresetList.querySelectorAll('[data-category-remove]').forEach(button => {
    button.addEventListener('click', () => removeCategoryPreset(button.getAttribute('data-category-remove')));
  });
}

async function saveCategoryPresets() {
  const categories = normalizeCategoryNames(editingCategories);
  const ok = await saveCategoryListSilently(categories);
  if (!ok) {
    alert(t('categoryUpdateFailed', saveCategoryListSilently.lastError || ''));
    return;
  }
  closeCategoryModal();
  rebuildCategoryFilter();
}

function openClientVersionModal() {
  if (!clientVersionModal) return;
  clientVersionModal.hidden = false;
  loadClientVersions();
}

function closeClientVersionModal() {
  if (clientVersionModal) clientVersionModal.hidden = true;
}

async function loadClientVersions() {
  if (!versionStatusList) return;
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
  if (!versionStatusList) return;
  const items = [
    Object.assign({ label: t('versionWinTitle') }, channels.win || {}),
    Object.assign({ label: t('versionXpTitle') }, channels.xp || {})
  ];
  versionStatusList.innerHTML = items.map(item => `<div class="versionStatusItem">
    <strong>${escapeHtml(t('versionCurrent', item))}</strong>
    <small>${escapeHtml(t('versionMeta', item))}</small>
    ${item.exeUrl ? `<a href="${escapeHtml(item.exeUrl)}">${escapeHtml(item.exeUrl)}</a>` : ''}
  </div>`).join('');
  if (versionWinNumber && channels.win && channels.win.version) versionWinNumber.value = channels.win.version;
  if (versionXpNumber && channels.xp && channels.xp.version) versionXpNumber.value = channels.xp.version;
}

async function publishClientVersion(channel) {
  const fields = channel === 'xp'
    ? { version: versionXpNumber, exe: versionXpExe, config: versionXpConfig, notes: versionXpNotes }
    : { version: versionWinNumber, exe: versionWinExe, config: versionWinConfig, notes: versionWinNotes };
  const version = String(fields.version && fields.version.value || '').trim();
  const exeFile = fields.exe && fields.exe.files && fields.exe.files[0];
  const configFile = fields.config && fields.config.files && fields.config.files[0];
  if (!version || !exeFile) {
    alert(t('versionRequired'));
    return;
  }

  const payload = {
    flavor: channel,
    version,
    notes: fields.notes ? fields.notes.value.trim() : '',
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
  alert(t('versionPublishDone'));
  if (fields.exe) fields.exe.value = '';
  if (fields.config) fields.config.value = '';
  await loadClientVersions();
}

function fileToBase64Payload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      resolve({
        name: file.name,
        contentBase64: comma >= 0 ? value.slice(comma + 1) : value
      });
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function manageClientDangerKey() {
  const key = prompt(t('clientKeyPrompt'), '');
  if (key == null) return;
  const value = key.trim();
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

  alert(t('clientKeySaved'));
}

async function cleanupAbnormalDevices() {
  const sources = abnormalDiskSourceStats();
  if (sources.length === 0) {
    alert(t('cleanupNoAbnormalSources'));
    return;
  }

  const selectedSources = await openCleanupSourceModal(sources);
  if (!selectedSources) return;

  const selectedLabels = selectedSources
    .map(id => ABNORMAL_DISK_SOURCES.find(source => source.id === id))
    .filter(Boolean)
    .map(source => source.label);
  if (!confirm(t('cleanupAbnormalConfirm', selectedLabels.join('\n')))) return;

  const res = await authedFetch('/api/assets/cleanup-abnormal-devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources: selectedSources })
  });
  if (!res.ok) {
    alert(t('cleanupAbnormalFailed', await res.text()));
    return;
  }

  const result = await res.json();
  alert(t('cleanupAbnormalDone', result));
  clearEditor();
  await loadAssets();
}

function openCleanupSourceModal(sources) {
  cleanupSourceList.innerHTML = sources.map(source => `<label class="sourceOption">
    <input type="checkbox" value="${escapeHtml(source.id)}" checked>
    <span>${escapeHtml(source.label)}<small>${escapeHtml(t('cleanupSourceCount', source.count))}</small></span>
  </label>`).join('');
  cleanupModal.hidden = false;

  return new Promise(resolve => {
    cleanupSourceResolver = resolve;
  });
}

function confirmCleanupSourceSelection() {
  const selectedSources = Array.from(cleanupSourceList.querySelectorAll('input:checked'))
    .map(input => input.value)
    .filter(Boolean);
  if (selectedSources.length === 0) {
    alert(t('cleanupSourceRequired'));
    return;
  }
  closeCleanupSourceModal(selectedSources);
}

function closeCleanupSourceModal(value) {
  cleanupModal.hidden = true;
  cleanupSourceList.innerHTML = '';
  if (!cleanupSourceResolver) return;
  const resolve = cleanupSourceResolver;
  cleanupSourceResolver = null;
  resolve(value);
}

async function importOfflineAssets() {
  const file = importOfflineFile.files && importOfflineFile.files[0];
  importOfflineFile.value = '';
  if (!file) return;

  try {
    const text = await readTextFile(file);
    const res = await authedFetch('/api/import-offline', {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'text/plain; charset=utf-8' },
      body: text
    });

    if (!res.ok) {
      alert(t('importOfflineFailed', await res.text()));
      return;
    }

    const stats = await res.json();
    alert(t('importOfflineDone', stats));
    clearEditor();
    await loadAssets();
  } catch (err) {
    alert(t('importOfflineFailed', err && err.message ? err.message : String(err)));
  }
}

function downloadBackup() {
  window.location.href = withServerKey('/api/backup/download');
}

async function restoreBackup() {
  const file = restoreBackupFile.files && restoreBackupFile.files[0];
  restoreBackupFile.value = '';
  if (!file) return;
  if (!confirm(t('restoreBackupConfirm'))) return;

  try {
    const text = await readTextFile(file);
    const backup = JSON.parse(text);
    const res = await authedFetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'replace', backup })
    });

    if (!res.ok) {
      alert(t('restoreBackupFailed', await res.text()));
      return;
    }

    const stats = await res.json();
    alert(t('restoreBackupDone', stats));
    clearEditor();
    await loadAssets();
  } catch (err) {
    alert(t('restoreBackupFailed', err && err.message ? err.message : String(err)));
  }
}

function readTextFile(file) {
  if (file && typeof file.text === 'function') return file.text();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsText(file, 'utf-8');
  });
}

function editAsset(id) {
  const asset = assets.find(item => item.id === id);
  if (asset) fillEditor(asset);
}

function fillEditor(asset) {
  const meta = asset.metadata || {};
  showEditor();
  selectedAsset = asset;
  isCreatingAsset = false;
  editorHint.textContent = `${asset.system.computerCode || asset.system.computerName || t('unnamedComputer')} / ${asset.user.name || t('noUser')}`;
  document.getElementById('deleteBtn').style.display = '';
  setValue('assetId', asset.id);
  setValue('category', meta.category);
  setValue('tags', (meta.tags || []).join(', '));
  setValue('userName', asset.user.name);
  setValue('department', asset.user.department);
  setValue('employeeId', asset.user.employeeId);
  setValue('location', asset.user.location);
  setValue('phone', asset.user.phone);
  setValue('note', asset.user.note);
  setValue('computerCode', asset.system.computerCode);
  setValue('computerName', asset.system.computerName);
  setValue('osCaption', asset.system.osCaption);
  setValue('installDate', asset.system.installDate);
  setValue('boardManufacturer', asset.baseBoard.manufacturer);
  setValue('boardProduct', asset.baseBoard.product);
  setValue('boardSerial', asset.baseBoard.serialNumber);
  setValue('nics', (asset.networkAdapters || []).map(nic => `${nic.name} | ${formatMac(nic.macAddress)} | ${(nic.ipAddresses || []).filter(isIpv4).join(',')}`).join('\n'));
  setValue('disks', (asset.disks || []).map(disk => `${disk.model} | ${disk.serialNumber} | ${disk.sizeText || formatBytes(disk.sizeBytes)}`).join('\n'));
  renderIpConflictHint();
}

function startNewAsset() {
  showEditor();
  selectedAsset = null;
  isCreatingAsset = true;
  document.getElementById('assetForm').reset();
  setValue('assetId', '');
  editorHint.textContent = t('newRecordHint');
  document.getElementById('deleteBtn').style.display = 'none';
  renderIpConflictHint();
  document.getElementById('userName').focus();
}

function clearEditor() {
  selectedAsset = null;
  isCreatingAsset = false;
  editorHint.textContent = t('editorHint');
  document.getElementById('assetForm').reset();
  setValue('assetId', '');
  document.getElementById('deleteBtn').style.display = '';
  renderIpConflictHint();
  hideEditor();
}

function showEditor() {
  if (editor) editor.hidden = false;
  if (layout) layout.classList.add('editorOpen');
}

function hideEditor() {
  if (editor) editor.hidden = true;
  if (layout) layout.classList.remove('editorOpen');
}

async function saveAsset(event) {
  event.preventDefault();
  const id = value('assetId');
  const ipConflicts = findIpConflicts(parseIpsFromNicText(value('nics')), id);
  if (ipConflicts.length) {
    const lines = ipConflicts.map(item => t('ipConflictLine', item)).join('\n');
    if (!confirm(t('ipConflictConfirm', lines))) return;
  }

  const payload = {
    metadata: {
      category: value('category'),
      tags: parseTags(value('tags'))
    },
    user: {
      name: value('userName'),
      department: value('department'),
      employeeId: value('employeeId'),
      location: value('location'),
      phone: value('phone'),
      note: value('note')
    },
    system: {
      computerCode: value('computerCode'),
      computerName: value('computerName'),
      osCaption: value('osCaption'),
      installDate: value('installDate')
    },
    baseBoard: {
      manufacturer: value('boardManufacturer'),
      product: value('boardProduct'),
      serialNumber: value('boardSerial')
    },
    networkAdapters: parseNics(value('nics')),
    disks: parseDisks(value('disks'))
  };

  const res = await authedFetch(id ? `/api/assets/${encodeURIComponent(id)}` : '/api/assets', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    alert(t(id ? 'saveFailed' : 'createFailed', await res.text()));
    return;
  }
  const saved = await res.json();
  await loadAssets();
  const updated = assets.find(item => item.id === (id || saved.id));
  if (updated) fillEditor(updated);
}

async function deleteAsset() {
  const id = value('assetId');
  if (!id || !confirm(t('confirmDeleteOne'))) return;
  const res = await authedFetch(`/api/assets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    alert(t('deleteFailed', await res.text()));
    return;
  }
  clearEditor();
  await loadAssets();
}

function parseTags(text) {
  const seen = new Set();
  return text.split(/[,;\uFF0C\uFF1B\s]+/)
    .map(item => item.trim())
    .filter(item => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderIpConflictHint() {
  if (!ipConflictHint || !nicsInput) return;
  const currentId = value('assetId');
  const ips = parseIpsFromNicText(nicsInput.value);
  if (!ips.length) {
    ipConflictHint.hidden = true;
    ipConflictHint.innerHTML = '';
    return;
  }

  const conflicts = findIpConflicts(ips, currentId);
  ipConflictHint.hidden = false;
  ipConflictHint.className = `ipConflictHint ${conflicts.length ? 'warn' : 'ok'}`;
  ipConflictHint.innerHTML = conflicts.length
    ? `<strong>${escapeHtml(t('ipConflictTitle'))}</strong>${conflicts.map(item => `<span>${escapeHtml(t('ipConflictLine', item))}</span>`).join('')}`
    : `<span>${escapeHtml(t('ipConflictOk'))}</span>`;
}

function parseIpsFromNicText(text) {
  const seen = new Set();
  const ips = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    const parts = line.split('|');
    const ipPart = parts.length >= 3 ? parts.slice(2).join('|') : line;
    ipPart.split(/[,;\uFF0C\uFF1B\s]+/)
      .map(item => item.trim())
      .filter(isIpv4)
      .forEach(ip => {
        if (seen.has(ip)) return;
        seen.add(ip);
        ips.push(ip);
      });
  });
  return ips;
}

function findIpConflicts(ips, currentAssetId) {
  const selected = new Set((ips || []).filter(isIpv4));
  const conflicts = [];
  if (!selected.size) return conflicts;

  assets.forEach(asset => {
    if (!asset || asset.id === currentAssetId) return;
    assetIpv4List(asset).forEach(ip => {
      if (!selected.has(ip)) return;
      conflicts.push({
        ip,
        owner: assetLabel(asset) || asset.id || '-',
        assetId: asset.id
      });
    });
  });

  return conflicts.sort((a, b) => compareIp(a.ip, b.ip) || a.owner.localeCompare(b.owner, currentLang));
}

function parseNics(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split('|').map(part => part.trim());
      return {
        name: parts[0] || '',
        macAddress: formatMac(parts[1] || ''),
        ipAddresses: (parts[2] || '').split(',').map(s => s.trim()).filter(isIpv4)
      };
    });
}

function parseDisks(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split('|').map(part => part.trim());
      return { model: parts[0] || '', serialNumber: parts[1] || '', sizeText: parts[2] || '' };
    });
}

function buildSearchQuery(value) {
  const tokens = String(value || '')
    .trim()
    .split(/\s+/)
    .map(normalizeSearchText)
    .filter(Boolean);
  const compactTokens = tokens
    .map(normalizeSearchCompact);
  return { tokens, compactTokens };
}

function assetMatchesSearch(asset, query) {
  return assetSearchMatchDetails(asset, query).matched;
}

function assetSearchMatchDetails(asset, query) {
  const entries = searchableAssetEntries(asset);
  const fields = new Set();
  const valueKeys = new Set();
  const tokenMatches = query.tokens.map((token, indexAt) => {
    const compactToken = query.compactTokens[indexAt] || '';
    return entries.filter(entry => entryMatchesSearchToken(entry, token, compactToken));
  });
  const matched = tokenMatches.every(matches => matches.length > 0);

  if (matched) {
    tokenMatches.flat().forEach(entry => {
      fields.add(entry.field);
      valueKeys.add(searchValueKey(entry.field, entry.value));
    });
  }

  return { matched, fields, valueKeys };
}

function searchableAssetEntries(asset) {
  const meta = asset.metadata || {};
  const user = asset.user || {};
  const system = asset.system || {};
  const board = asset.baseBoard || {};
  const entries = [
    ['assetId', asset.id],
    ['category', assetCategory(asset)],
    ...((Array.isArray(meta.tags) ? meta.tags : []).map(tag => ['tag', tag])),
    ['userName', user.name],
    ['department', user.department],
    ['employeeId', user.employeeId],
    ['location', user.location],
    ['phone', user.phone],
    ['note', user.note],
    ['computerCode', system.computerCode],
    ['computerName', system.computerName],
    ['osCaption', system.osCaption],
    ['osVersion', system.osVersion],
    ['installDate', system.installDate],
    ['boardManufacturer', displayBoardManufacturer(board.manufacturer)],
    ['boardManufacturer', board.manufacturer],
    ['boardProduct', board.product],
    ['boardSerial', board.serialNumber]
  ].map(([field, value]) => searchEntry(field, value));

  (asset.networkAdapters || []).forEach(nic => {
    entries.push(searchEntry('nicName', nic.name));
    entries.push(searchEntry('macAddress', nic.macAddress));
    entries.push(searchEntry('macAddress', formatMac(nic.macAddress)));
    (nic.ipAddresses || []).forEach(ip => entries.push(searchEntry('ipAddress', ip)));
  });
  (asset.disks || []).forEach(disk => {
    entries.push(searchEntry('diskModel', disk.model));
    entries.push(searchEntry('diskSerial', disk.serialNumber));
    entries.push(searchEntry('diskSize', disk.sizeText));
    entries.push(searchEntry('diskSize', disk.sizeBytes));
  });

  return entries.filter(entry => entry.text || entry.compact);
}

function searchEntry(field, value) {
  return {
    field,
    value,
    text: normalizeSearchText(value),
    compact: normalizeSearchCompact(value)
  };
}

function entryMatchesSearchToken(entry, token, compactToken) {
  return entry.text.includes(token)
    || Boolean(compactToken && entry.compact.includes(compactToken));
}

function searchValueKey(field, value) {
  return `${field}::${normalizeSearchText(value)}::${normalizeSearchCompact(value)}`;
}

function searchValueMatches(searchDetails, field, value, aliases) {
  if (!searchDetails || !searchDetails.matched) return false;
  return [value, ...(aliases || [])].some(candidate => searchDetails.valueKeys.has(searchValueKey(field, candidate)));
}

function renderSearchValue(value, field, searchDetails, fallback = '-', aliases = []) {
  const display = String(value == null || value === '' ? fallback : value);
  const content = escapeHtml(display);
  return searchValueMatches(searchDetails, field, value, aliases)
    ? `<span class="searchHitValue">${content}</span>`
    : content;
}

function renderSearchParts(parts, searchDetails) {
  const rendered = parts
    .filter(([, value]) => Boolean(value))
    .map(([field, value]) => renderSearchValue(value, field, searchDetails, ''));
  return rendered.length ? rendered.join(' / ') : '-';
}

function normalizeSearchText(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[\u3000]+/g, ' ')
    .replace(/[，；、|/\\]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeSearchCompact(value) {
  return normalizeSearchText(value).replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

function assetCategory(asset) {
  return String((asset.metadata || {}).category || '').trim()
    || assetDepartment(asset);
}

function assetCategoryKey(asset) {
  const category = assetCategory(asset);
  return category ? `category:${category.toLowerCase()}` : 'category:__uncategorized__';
}

function assetIpv4List(asset) {
  const ips = [];
  (asset.networkAdapters || []).forEach(nic => {
    (nic.ipAddresses || []).filter(isIpv4).forEach(ip => ips.push(ip));
  });
  return ips;
}

function latestTime(left, right) {
  const a = Date.parse(left || '');
  const b = Date.parse(right || '');
  if (Number.isNaN(a)) return right || left || '';
  if (Number.isNaN(b)) return left || right || '';
  return b > a ? right : left;
}

function loadExpandedCategoryKeys() {
  try {
    const data = JSON.parse(localStorage.getItem('expandedAssetCategories') || '[]');
    return new Set(Array.isArray(data) ? data.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function saveExpandedCategoryKeys() {
  localStorage.setItem('expandedAssetCategories', JSON.stringify(Array.from(expandedCategoryKeys)));
}

function loadExpandedDepartmentKeys() {
  try {
    const data = JSON.parse(localStorage.getItem('expandedAssetDepartments') || '[]');
    return new Set(Array.isArray(data) ? data.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function saveExpandedDepartmentKeys() {
  hasSavedExpandedDepartmentKeys = true;
  localStorage.setItem('expandedAssetDepartments', JSON.stringify(Array.from(expandedDepartmentKeys)));
}

function loadSelectedMissingFields() {
  try {
    const knownIds = new Set(MISSING_FIELD_FILTERS.map(filter => filter.id));
    const data = JSON.parse(localStorage.getItem('selectedMissingFields') || '[]');
    return new Set(Array.isArray(data) ? data.filter(id => knownIds.has(id)) : []);
  } catch {
    return new Set();
  }
}

function saveSelectedMissingFields() {
  localStorage.setItem('selectedMissingFields', JSON.stringify(Array.from(selectedMissingFields)));
}

function value(id) {
  return document.getElementById(id).value.trim();
}

function setValue(id, val) {
  document.getElementById(id).value = val || '';
}

function compact(parts) {
  return parts.filter(Boolean).join(' / ') || '-';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(currentLang);
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '';
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMac(value) {
  const raw = String(value || '').toLowerCase().trim();
  const hex = raw.replace(/[^0-9a-f]/g, '');
  return hex.length === 12 ? `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}` : raw;
}

function isIpv4(value) {
  const text = String(value || '').trim();
  return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(text);
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

function withServerKey(url) {
  if (!serverKey) {
    const key = prompt(t('authRequired'), serverKey);
    if (key == null) return url;
    serverKey = key.trim();
    localStorage.setItem('assetServerKey', serverKey);
  }

  if (!serverKey) return url;
  const separator = url.indexOf('?') >= 0 ? '&' : '?';
  return `${url}${separator}key=${encodeURIComponent(serverKey)}`;
}

function showError(err) {
  totalText.textContent = t('loadFailed');
  alert(err && err.message ? err.message : String(err));
}
