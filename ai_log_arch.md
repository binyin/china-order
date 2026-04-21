# 小程序-AI 自动化闭环调试架构方案 (Local Loop)

## 1. 结构化需求说明 (Requirements)
- **目标**：实现"真机报错 -> AI 自动感知 -> 源码自动修复"的闭环，无需人工干预日志搬运。
- **环境**：Ubuntu 24.04 (T440) + oh-my-openagent (OMO)。
- **触发机制**：基于本地文件系统监听（File Watcher）。

---

## 2. 系统架构 (Architecture)

### 2.1 链路设计
1. **数据源 (Mobile)**：真机或预览版小程序通过 `wx.request` 实时上报 `console.error`。
2. **中转站 (Node.js Server)**：本地 3000 端口接收数据并写入 `debug.log`。
3. **决策层 (AI Agent)**：OMO 监控 `debug.log`，发现 ERROR 后读取 `./pages` 上下文。
4. **执行层 (File System)**：AI 自动重写受损代码文件并保存。

### 2.2 边界与约束
1. 日志分级，内容清晰可看出页面，函数名，参数，返回值。
2. 日志文件使用固定文件名 `debug.log`，追加写入。

---

## 3. 配置与实现步骤

### Step 1: 启动日志服务
```bash
# 后台启动日志服务器
node logger-server.js

# 或使用 nohup 后台运行
nohup node logger-server.js > /tmp/logger.log 2>&1 &
```

日志服务会在项目根目录创建 `debug.log` 文件。

### Step 2: 客户端配置
客户端代码已集成在 `app.js` 中，自动捕获 `console.error` 并上报。

**当前配置的局域网 IP**：`192.168.84.116`

如需修改 IP，编辑 `app.js` 中的 `LAN_IP` 变量。

### Step 3: 测试
```bash
# 手动测试日志服务
curl -X POST http://localhost:3001 \
  -H "Content-Type: application/json" \
  -d '{"level":"ERROR","message":"test error"}'

# 查看日志
cat debug.log
```

---

## 4. 文件说明

| 文件 | 说明 |
|------|------|
| `logger-server.js` | 日志服务器，监听 3001 端口 |
| `debug.log` | 日志输出文件（不提交 git） |
| `app.js` | 小程序入口，已集成 console.error 补丁 |
