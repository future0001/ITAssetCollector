# IT 资产收集与管理系统

这是一个面向内网的小型 IT 资产收集与管理系统，用于电脑资产采集、台账管理、组织架构维护、IP 资源检查、客户端安装状态跟踪和客户端升级发布。

系统由两部分组成：

- 服务端：Node.js 单文件服务，提供 Web 管理界面和数据接口。
- 客户端：Windows WinForms 采集程序，包含普通 Windows 版和 XP 兼容版。

## 主要功能

- 资产台账：查看、搜索、筛选、编辑、删除、批量分类、导出 Excel。
- 可视化概览：按资产分类、部门、缺失字段、异常硬盘统计，并可点击数据条目查看相关资产。
- 缺失字段筛选：快速定位主机名、资产编号、使用人、部门、位置、IP、MAC、主板、硬盘序列号、系统信息等缺失项。
- IP 详情：展示网段使用情况、重复 IP、无 IP 设备，并支持可达性检测。
- 组织架构：维护公司、事业部、部门、小组和员工，支持组织图示和组织节点编辑。
- 客户端管理：查看客户端安装、在线、未检测、未建档心跳、版本发布和采集差异。
- 离线采集：客户端在网络不可用时可保存本地离线记录，网络恢复后再批量提交。
- 自动发现服务端：客户端可自动检测内网服务端地址，离线时使用默认地址继续安装。
- 客户端升级：服务端可发布普通版和 XP 版客户端升级包。

## 目录结构

```text
server/                         服务端
server/server.js                Node.js 服务入口
server/public/                  Web UI 静态文件
server/data/                    资产、组织、客户端状态等数据
server/data/backups/            自动/手动备份
server/client-updates/          客户端升级包

client/AssetCollector/          普通 Windows 客户端源码
client/AssetCollectorXP/        XP 兼容客户端源码
client/*/bin/                   编译后的客户端程序

scripts/seed-demo-data.js        生成演示组织、资产和客户端状态
dist/                           打包分发目录
```

## 启动服务端

```powershell
cd server
node server.js
```

默认地址：

```text
http://localhost:3000
```

常用页面：

```text
资产台账        http://localhost:3000/
IP 详情         http://localhost:3000/ip.html
组织图示        http://localhost:3000/org.html
客户端管理      http://localhost:3000/client.html
Excel 导出      http://localhost:3000/export.xls
```

内网部署时，将客户端里的服务端地址改为实际服务器 IP，例如：

```text
http://192.168.1.10:3000
```

## 数据文件

主要数据保存在：

```text
server/data/assets.json              资产台账
server/data/org.json                 组织架构
server/data/clients.json             客户端心跳和安装状态
server/data/collection-requests.json 采集任务记录
server/data/client-update.json        普通客户端升级清单
server/data/client-update-xp.json     XP 客户端升级清单
server/data/security.json             安全配置
```

重要操作前建议备份 `server/data`。系统部分操作会在 `server/data/backups` 下保留自动备份。

## 演示数据

项目包含一套演示数据生成脚本：

```powershell
node scripts\seed-demo-data.js
```

脚本会生成：

- 1 个演示公司
- 17 个组织节点
- 30 名演示员工
- 18 台演示资产
- 演示客户端心跳状态
- IP 冲突、无 IPv4、缺失字段、异常硬盘、多网卡服务器等演示场景

运行脚本前会自动备份原文件到：

```text
server/data/backups/
```

脚本会覆盖：

```text
server/data/assets.json
server/data/org.json
server/data/clients.json
```

## 构建客户端

普通客户端：

```powershell
powershell -ExecutionPolicy Bypass -File client\AssetCollector\build-client.ps1
```

XP 兼容客户端：

```powershell
powershell -ExecutionPolicy Bypass -File client\AssetCollectorXP\build-client.ps1
```

编译结果：

```text
client/AssetCollector/bin/计算机信息核查.exe
client/AssetCollectorXP/bin/计算机信息核查-XP.exe
```

构建脚本还会同步发布升级包到：

```text
server/client-updates/
server/data/client-update.json
server/data/client-update-xp.json
```

## 客户端安装与离线维护

客户端首次运行时，如果后台服务未安装或需要修复，会进入安装界面。安装流程：

1. 自动检测或手动填写服务端地址。
2. 填写使用人和部门。
3. 点击安装。
4. 如需要管理员权限，按系统提示允许 UAC 提权。
5. 安装完成后会启动后台服务、托盘程序，并打开客户端主界面。

服务端离线时，客户端仍可安装：

- 自动检测失败不会阻塞安装。
- 客户端会使用默认服务端地址保存配置。
- 后续可在客户端界面中修改为实际服务端地址。

安装后：

- 关闭客户端窗口不会退出后台运行。
- 可通过托盘图标或桌面快捷方式重新打开客户端界面。
- 托盘菜单支持打开客户端、启动服务、停止服务、重启服务、安装服务、卸载服务。

卸载客户端：

```powershell
计算机信息核查.exe /uninstall
```

也可以通过托盘菜单点击“卸载服务”。卸载会停止并删除后台服务，取消托盘自启动，并清理托盘进程。

### 客户端危险操作密钥

停止服务、重启服务等危险操作优先使用服务端配置的“客户端危险操作密钥”验证。

当服务端不可连接时，客户端支持离线兜底密钥验证，用于离线维护机器。离线兜底密钥不会以明文写入源码或 README，代码中只保存哈希值，明文口令应由维护人员线下保管。

注意：

- 服务端可连接时，以服务端密钥验证为准。
- 服务端明确返回密钥错误时，不会自动改走离线兜底验证。
- 服务端不可连接、超时或网络异常时，才会启用离线兜底验证。

## 客户端使用

客户端主要流程：

1. 自动检测或填写服务端地址。
2. 填写使用人、部门、位置等信息。
3. 点击 `一键获取信息`。
4. 检查采集预览。
5. 点击 `提交到服务器`。

网络不可用时：

- 点击 `保存离线记录`，先保存到本地。
- 网络恢复后点击 `提交离线记录`。
- 也可以点击 `导出Excel` 在本机导出当前采集结果。

离线记录默认位置：

```text
%APPDATA%\ITAssetCollector\offline-assets.json
```

## 采集字段

客户端采集内容包括：

- 系统：计算机名、资产编号、Windows 版本、安装时间。
- 使用人：姓名、部门、工号、位置、电话、备注。
- 网卡：物理网卡名称、MAC 地址、IPv4 地址。
- 硬盘：物理硬盘型号、序列号、容量。
- 主板：厂商、型号、序列号。

客户端只采集 IPv4 地址，不采集 IPv6。

## 硬盘序列号修正

少数 Windows 7 或特殊 NVMe 驱动可能只能读取到 EUI/NGUID，而不是厂商序列号。可以在客户端配置文件中增加修正规则：

```xml
<add key="DiskSerialOverrides" value="E823_8FA6_BF53_0001_001B_448B_4765_E563=24031Q804788" />
```

多条规则用英文分号分隔：

```xml
<add key="DiskSerialOverrides" value="bad-or-nguid=correct-serial;model:WD Blue SN580=correct-serial" />
```

## 常用接口

```text
GET  /api/assets                 获取资产
POST /api/assets                 新增资产
PUT  /api/assets/:id             更新资产
GET  /api/org                    获取组织架构
PUT  /api/org                    保存组织架构
GET  /api/client-installations   客户端安装状态
GET  /api/client/versions        客户端版本状态
GET  /export.xls                 导出 Excel
```

## 维护建议

- 定期备份 `server/data`。
- 发布客户端前先运行对应的 `build-client.ps1`。
- 修改 Web UI 后检查首页、IP 详情、组织图示、客户端管理四个页面。
- 演示前可运行 `node scripts\seed-demo-data.js` 重置演示数据。
- 如果 PowerShell 提示 `oh-my-posh` 不存在，这是本机 PowerShell profile 的提示，不影响本项目构建。
