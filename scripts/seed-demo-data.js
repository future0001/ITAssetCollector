const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'server', 'data');
const backupDir = path.join(dataDir, 'backups');
const assetsFile = path.join(dataDir, 'assets.json');
const orgFile = path.join(dataDir, 'org.json');
const clientsFile = path.join(dataDir, 'clients.json');

const now = new Date();
const nowIso = now.toISOString();

function timestamp() {
  return nowIso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function writeJson(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function backup(file, label) {
  if (!fs.existsSync(file)) return '';
  fs.mkdirSync(backupDir, { recursive: true });
  const target = path.join(backupDir, `${label}-${timestamp()}-before-demo.json`);
  fs.copyFileSync(file, target);
  return target;
}

function emp(id, name, title, phone) {
  return {
    id: `emp-demo-${id}`,
    name,
    employeeId: String(id),
    title: title || '',
    phone: phone || ''
  };
}

function unit(id, type, code, name, manager, employees, children) {
  return {
    id: `org-demo-${id}`,
    type,
    code,
    name,
    manager: manager || '',
    employees: employees || [],
    children: children || []
  };
}

const organization = {
  version: 2,
  updatedAt: nowIso,
  units: [
    unit('company-hx', 'company', 'HX', '红相科技演示公司', '林总', [], [
      unit('bu-rd', 'business-unit', 'BU-RD', '研发中心', '周启明', [], [
        unit('dept-platform', 'department', 'RD-PLAT', '平台软件部', '陈思远', [
          emp(1001, '陈思远', '部门经理', '13800001001'),
          emp(1002, '李安然', '前端工程师', '13800001002'),
          emp(1003, '吴嘉宁', '后端工程师', '13800001003')
        ], [
          unit('team-web', 'team', 'RD-WEB', 'Web 应用组', '李安然', [
            emp(1004, '赵一鸣', '前端工程师', '13800001004'),
            emp(1005, '孙若溪', 'UI 工程师', '13800001005')
          ], []),
          unit('team-api', 'team', 'RD-API', '接口服务组', '吴嘉宁', [
            emp(1006, '钱子墨', '后端工程师', '13800001006'),
            emp(1007, '郑亦凡', '运维开发', '13800001007')
          ], [])
        ]),
        unit('dept-hardware', 'department', 'RD-HW', '硬件研发部', '何雨桐', [
          emp(1010, '何雨桐', '部门经理', '13800001010'),
          emp(1011, '胡景行', '硬件工程师', '13800001011'),
          emp(1012, '朱明朗', '嵌入式工程师', '13800001012')
        ], [
          unit('team-test', 'team', 'RD-LAB', '测试实验室', '罗文轩', [
            emp(1013, '罗文轩', '测试主管', '13800001013'),
            emp(1014, '马清扬', '测试工程师', '13800001014')
          ], [])
        ])
      ]),
      unit('bu-product', 'business-unit', 'BU-PROD', '产品交付中心', '杨可欣', [], [
        unit('dept-product', 'department', 'PD-PM', '产品部', '杨可欣', [
          emp(2001, '杨可欣', '产品负责人', '13800002001'),
          emp(2002, '唐书瑶', '产品经理', '13800002002'),
          emp(2003, '宋知予', '项目经理', '13800002003')
        ], []),
        unit('dept-quality', 'department', 'PD-QA', '质量管理部', '顾南星', [
          emp(2010, '顾南星', '质量经理', '13800002010'),
          emp(2011, '沈墨白', '质检工程师', '13800002011'),
          emp(2012, '陆星辰', '体系专员', '13800002012')
        ], [])
      ]),
      unit('bu-ops', 'business-unit', 'BU-OPS', '运营管理中心', '王予安', [], [
        unit('dept-admin', 'department', 'OPS-ADM', '行政人事部', '王予安', [
          emp(3001, '王予安', '行政经理', '13800003001'),
          emp(3002, '秦念初', '人事专员', '13800003002'),
          emp(3003, '姜栀夏', '行政专员', '13800003003')
        ], []),
        unit('dept-finance', 'department', 'OPS-FIN', '财务部', '许清和', [
          emp(3010, '许清和', '财务经理', '13800003010'),
          emp(3011, '韩语嫣', '会计', '13800003011')
        ], []),
        unit('dept-purchase', 'department', 'OPS-PUR', '采购部', '邵星河', [
          emp(3020, '邵星河', '采购主管', '13800003020'),
          emp(3021, '林沐阳', '采购专员', '13800003021')
        ], [])
      ]),
      unit('bu-sales', 'business-unit', 'BU-SALES', '市场销售中心', '赵清越', [], [
        unit('dept-sales-east', 'department', 'SA-EAST', '华东销售部', '赵清越', [
          emp(4001, '赵清越', '销售总监', '13800004001'),
          emp(4002, '夏知微', '客户经理', '13800004002'),
          emp(4003, '白景川', '售前顾问', '13800004003')
        ], []),
        unit('dept-support', 'department', 'SA-SUP', '客户成功部', '温言', [
          emp(4010, '温言', '客户成功经理', '13800004010'),
          emp(4011, '叶舒然', '技术支持', '13800004011')
        ], [])
      ])
    ])
  ]
};

const people = [
  ['1002', '李安然', '平台软件部', '12 楼研发区 A', '台式机', '办公研发', '192.168.10.21'],
  ['1003', '吴嘉宁', '平台软件部', '12 楼研发区 A', '服务器', '后端服务', '192.168.10.22'],
  ['1004', '赵一鸣', 'Web 应用组', '12 楼研发区 B', '笔记本', '前端开发', '192.168.10.31'],
  ['1006', '钱子墨', '接口服务组', '12 楼研发区 B', '服务器', 'API 服务', '192.168.10.41'],
  ['1011', '胡景行', '硬件研发部', '8 楼硬件实验室', '台式机', '硬件调试', '192.168.20.11'],
  ['1013', '罗文轩', '测试实验室', '8 楼测试实验室', '台式机', '测试设备', '192.168.20.31'],
  ['2001', '杨可欣', '产品部', '15 楼产品区', '笔记本', '产品管理', '192.168.30.11'],
  ['2003', '宋知予', '产品部', '15 楼产品区', '笔记本', '项目交付', '192.168.30.12'],
  ['2010', '顾南星', '质量管理部', '9 楼品控区', '台式机', '质量管理', '192.168.30.31'],
  ['2011', '沈墨白', '质量管理部', '9 楼品控区', '台式机', '质量检验', '192.168.30.32'],
  ['3001', '王予安', '行政人事部', '16 楼行政区', '笔记本', '行政管理', '192.168.40.11'],
  ['3010', '许清和', '财务部', '16 楼财务室', '台式机', '财务专用', '192.168.40.21'],
  ['3020', '邵星河', '采购部', '10 楼采购区', '台式机', '采购管理', '192.168.40.31'],
  ['4001', '赵清越', '华东销售部', '18 楼销售区', '笔记本', '销售管理', '192.168.50.11'],
  ['4002', '夏知微', '华东销售部', '18 楼销售区', '笔记本', '客户拜访', '192.168.50.12'],
  ['4010', '温言', '客户成功部', '18 楼服务区', '笔记本', '客户支持', '192.168.50.31']
];

function mac(index) {
  return `02-16-3E-${(index + 10).toString(16).padStart(2, '0')}-${(index + 40).toString(16).padStart(2, '0')}-${(index + 80).toString(16).padStart(2, '0')}`.toUpperCase();
}

function disk(model, serial, sizeText) {
  return { model, serialNumber: serial, sizeBytes: 0, sizeText };
}

function asset(row, index) {
  const [employeeId, name, department, location, category, tag, ip] = row;
  const code = `DEMO-${String(index + 1).padStart(3, '0')}`;
  const computerName = `DEMO-PC-${String(index + 1).padStart(3, '0')}`;
  const isServer = category === '服务器';
  const isLaptop = category === '笔记本';
  const missingBoardSerial = index === 6 || index === 11;
  const noIp = index === 14;
  const duplicateIp = index === 15 ? '192.168.50.11' : ip;
  const abnormalDisk = index === 5;
  return {
    id: `asset-demo-${String(index + 1).padStart(3, '0')}`,
    createdAt: new Date(Date.UTC(2026, 6, 1, 8, index, 0)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 6, 13, 9, index, 0)).toISOString(),
    user: {
      name,
      department,
      employeeId,
      location: index === 10 ? '' : location,
      phone: `138${String(80000000 + index).slice(-8)}`,
      note: isServer ? '演示：核心系统设备，请优先关注变更记录。' : ''
    },
    system: {
      computerCode: code,
      computerName,
      osCaption: isServer ? 'Microsoft Windows Server 2022 Standard' : 'Microsoft Windows 11 专业版',
      osVersion: isServer ? '10.0.20348' : '10.0.22631',
      installDate: `2026-0${(index % 6) + 1}-15 09:${String(index).padStart(2, '0')}:00`
    },
    metadata: {
      category,
      tags: [tag, isLaptop ? '移动办公' : '固定资产']
    },
    baseBoard: {
      manufacturer: index % 3 === 0 ? 'ASUSTeK COMPUTER INC.' : index % 3 === 1 ? 'GIGABYTE Technology Co., Ltd.' : 'Dell Inc.',
      product: index % 3 === 0 ? 'PRIME B760M-A' : index % 3 === 1 ? 'B760M AORUS ELITE' : 'OptiPlex 7010',
      serialNumber: missingBoardSerial ? '' : `MB-DEMO-${String(index + 1).padStart(5, '0')}`
    },
    networkAdapters: [
      {
        name: isLaptop ? 'Intel Wi-Fi 6 AX201' : 'Realtek PCIe GbE Family Controller',
        macAddress: mac(index),
        ipAddresses: noIp ? [] : [duplicateIp]
      }
    ],
    disks: [
      abnormalDisk
        ? disk('Generic Flash Disk USB Device', 'USB-DEMO-0001', '58.60 GB')
        : disk(index % 2 ? 'Samsung SSD 980 500GB' : 'WDC WD10EZEX-08WN4A0', `SN-DEMO-${String(index + 1).padStart(5, '0')}`, index % 2 ? '465.76 GB' : '931.51 GB')
    ],
    raw: null,
    identityKey: `code:${code.toLowerCase()}`
  };
}

const assets = people.map(asset);

assets.push({
  id: 'asset-demo-017',
  createdAt: '2026-07-01T08:30:00.000Z',
  updatedAt: nowIso,
  user: {
    name: '',
    department: '测试实验室',
    employeeId: '',
    location: '8 楼测试实验室',
    phone: '',
    note: '演示：缺失使用人和工号，用于缺失字段筛选。'
  },
  system: {
    computerCode: 'DEMO-LAB-001',
    computerName: 'DEMO-LAB-UNCLAIMED',
    osCaption: 'Microsoft Windows 10 企业版 LTSC',
    osVersion: '10.0.19044',
    installDate: '2026-02-20 10:30:00'
  },
  metadata: { category: '实验设备', tags: ['实验室', '待认领'] },
  baseBoard: { manufacturer: 'MSI', product: 'B550M PRO-VDH', serialNumber: 'MB-DEMO-90001' },
  networkAdapters: [{ name: 'Intel Ethernet Connection I219-V', macAddress: '02-16-3E-AA-BB-01', ipAddresses: ['192.168.20.88'] }],
  disks: [disk('Kingston SA400S37240G', 'SN-DEMO-90001', '223.57 GB')],
  raw: null,
  identityKey: 'code:demo-lab-001'
});

assets.push({
  id: 'asset-demo-018',
  createdAt: '2026-07-01T08:40:00.000Z',
  updatedAt: nowIso,
  user: {
    name: '演示服务器',
    department: '接口服务组',
    employeeId: 'SYS-API',
    location: '10 楼机房',
    phone: '',
    note: '演示：服务器多网卡、多硬盘。'
  },
  system: {
    computerCode: 'DEMO-SRV-API-01',
    computerName: 'DEMO-SRV-API-01',
    osCaption: 'Ubuntu Server 24.04 LTS',
    osVersion: '24.04',
    installDate: '2026-03-08 11:00:00'
  },
  metadata: { category: '服务器', tags: ['API 服务', '生产'] },
  baseBoard: { manufacturer: 'Supermicro', product: 'X12STH-F', serialNumber: 'MB-DEMO-SRV01' },
  networkAdapters: [
    { name: 'Intel X550-T2 Port 1', macAddress: '02-16-3E-AA-BB-10', ipAddresses: ['10.10.1.21'] },
    { name: 'Intel X550-T2 Port 2', macAddress: '02-16-3E-AA-BB-11', ipAddresses: ['172.16.10.21'] }
  ],
  disks: [
    disk('Samsung PM9A1 NVMe 1TB', 'SN-DEMO-SRV01A', '953.87 GB'),
    disk('Seagate ST4000NM0035', 'SN-DEMO-SRV01B', '3725.29 GB')
  ],
  raw: null,
  identityKey: 'code:demo-srv-api-01'
});

fs.mkdirSync(dataDir, { recursive: true });
const assetBackup = backup(assetsFile, 'assets');
const orgBackup = backup(orgFile, 'org');
const clientsBackup = backup(clientsFile, 'clients');
writeJson(assetsFile, assets);
writeJson(orgFile, organization);
writeJson(clientsFile, demoClients(assets));

console.log(`Demo assets written: ${assets.length}`);
console.log(`Demo organization units: ${countUnits(organization.units)}`);
if (assetBackup) console.log(`Assets backup: ${assetBackup}`);
if (orgBackup) console.log(`Org backup: ${orgBackup}`);
if (clientsBackup) console.log(`Clients backup: ${clientsBackup}`);

function countUnits(units) {
  return (units || []).reduce((sum, item) => sum + 1 + countUnits(item.children), 0);
}

function computerKey(value) {
  return String(value || '').trim().toLowerCase();
}

function minutesAgo(minutes) {
  return new Date(now.getTime() - minutes * 60 * 1000).toISOString();
}

function heartbeat(assetItem, minutes, status, version) {
  const computerName = assetItem.system.computerName;
  return {
    computerName,
    firstSeenAt: '2026-07-01T01:00:00.000Z',
    lastSeenAt: minutesAgo(minutes),
    lastIp: (assetItem.networkAdapters[0] && assetItem.networkAdapters[0].ipAddresses[0]) || '',
    lastTaskId: minutes < 10 ? 'collect-demo-latest' : '',
    lastStatus: status || 'poll',
    clientVersion: version || '1.1.5.0',
    userName: assetItem.user.name,
    department: assetItem.user.department,
    osCaption: assetItem.system.osCaption,
    osVersion: assetItem.system.osVersion
  };
}

function demoClients(assetItems) {
  const installed = [0, 1, 3, 6, 10, 13].map((assetIndex, heartbeatIndex) => {
    const item = assetItems[assetIndex];
    return [computerKey(item.system.computerName), heartbeat(item, heartbeatIndex < 4 ? heartbeatIndex + 1 : 180 + heartbeatIndex, heartbeatIndex < 4 ? 'poll' : 'offline', heartbeatIndex === 1 ? '1.1.4.0' : '1.1.5.0')];
  });
  const result = Object.fromEntries(installed);
  result['demo-unfiled-kiosk'] = {
    computerName: 'DEMO-UNFILED-KIOSK',
    firstSeenAt: '2026-07-12T02:30:00.000Z',
    lastSeenAt: minutesAgo(2),
    lastIp: '192.168.60.18',
    lastTaskId: '',
    lastStatus: 'poll',
    clientVersion: '1.1.5.0',
    userName: '临时展厅终端',
    department: '展厅',
    osCaption: 'Microsoft Windows 11 专业版',
    osVersion: '10.0.22631'
  };
  return result;
}
