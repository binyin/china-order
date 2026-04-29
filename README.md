# 橙馨馒头店 - 微信小程序点单系统

基于微信小程序 + 腾讯云开发 (CloudBase) 的点单核销系统，支持用户点单、店长核销、订单管理。

[![Powered by CloudBase](https://7463-tcb-advanced-a656fc-1257967285.tcb.qcloud.la/mcp/powered-by-cloudbase-badge.svg)](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit)

> 本项目基于 [**CloudBase AI ToolKit**](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit) 开发，通过 AI 提示词和 MCP 协议 + 云开发，让开发更智能、更高效。

## 项目特点

- 🥟 用户端：浏览菜单、下单、查看订单
- 🔧 店长端：订单核销、历史查询、菜单发布
- 👤 用户信息独立存储，订单通过 customer_id 关联
- ☁️ 腾讯云开发：云函数 + 云数据库 + 云存储
- 🤖 集成 AI IDE 规则，提供智能化开发体验

## 用户信息架构

### 设计原则
用户信息（`nickname`、`avatarUrl`）**独立存储**在 `users` 表，订单只存 `customer_id`，查询时实时关联。

### 数据流程
```
用户设置/首次下单 → saveUser 云函数 → users 表（_id=OPENID）
                                    ↓
订单创建 → createOrder → orders 表（customer_id = OPENID）
                                    ↓
订单查询 → getUserTodayOrder / getAdminTodayOrders
         → 关联 users 表补全 customer_nickname、customer_avatar
```

### 关键实现
- **saveUser 云函数**：以 `OPENID` 为 `_id`，保存/更新用户信息到 `users` 表
- **头像处理**：用户选择头像后上传到云存储（`avatars/` 目录），保存 `cloud://` 永久路径
- **订单查询补全**：`getUserTodayOrder` 和 `getAdminTodayOrders` 都会查询 `users` 表，将 `nickname` 和 `avatarUrl` 填入订单对象的 `customer_nickname` 和 `customer_avatar`

### 前端行为
- 首次下单：弹窗要求填写昵称/头像 → 调用 `saveUser` → 缓存到本地 `userProfile`
- 后续下单：检查本地缓存 `userProfile.nickname` → 有则不再弹窗
- 设置页修改：更新 `users` 表 → 下次查订单时自动获取最新信息

## 项目架构

### 目录结构
```
miniprogram/
├── app.js, app.json, app.wxss
├── pages/
│   ├── user/          # 用户端页面
│   │   ├── index.js      # 首页：菜单浏览、下单
│   │   ├── history.js    # 历史订单（90天内）
│   │   └── setting.js    # 用户信息设置
│   └── admin/         # 店长端页面（需登录）
│       ├── login.js      # 店长登录
│       ├── orders.js     # 订单核销管理
│       ├── menu.js       # 菜单发布
│       ├── products.js   # 产品池管理
│       └── history.js    # 历史订单查询
├── utils/
│   └── db.js          # 数据库操作封装
└── images/

cloudfunctions/
├── getUserTodayOrder/      # 用户-当日订单（含用户信息补全）
├── getUserOrderHistory/    # 用户-历史订单(90天)
├── getAdminTodayOrders/    # 管理员-当日订单（含用户信息补全）
├── getAdminOrderHistory/   # 管理员-历史订单(日期+用户过滤)
├── createOrder/            # 创建订单
├── saveUser/              # 保存用户信息到 users 表
├── cancelOrder/           # 取消订单
├── publishMenu/           # 发布菜单
├── getSystemConfig/        # 获取系统配置（如 order_mode）
├── setSystemConfig/        # 设置系统配置
└── ...其他云函数
```

### 数据库集合
| 集合 | 用途 | 关键字段 |
|------|------|----------|
| `products` | 产品模板库 | `_id`, `name`, `price`, `image_url`, `unit` |
| `active_menu` | 发布菜单 | `date`, `items`(产品ID数组), `publish_time` |
| `orders` | 订单记录 | `customer_id`, `items`, `total_price`, `status`, `date` |
| `users` | 用户信息 | `_id`(OPENID), `nickname`, `avatarUrl`, `phone` |
| `configs` | 店长账号 | `username`, `password` |
| `user_logs` | 用户操作日志 | `user_id`, `action`, `result`, `details` |

### 云函数说明
| 云函数 | 功能 | 备注 |
|--------|------|------|
| `createOrder` | 创建订单 | 验证库存、计算销量 |
| `getUserTodayOrder` | 查询用户当日订单 | 关联 users 表补全昵称/头像 |
| `getAdminTodayOrders` | 查询当日所有订单 | 关联 users 表补全昵称/头像 |
| `saveUser` | 保存用户信息 | 以 OPENID 为 key，支持创建/更新 |
| `cancelOrder` | 取消订单 | 更新状态为 cancelled |
| `publishMenu` | 发布菜单 | 指定日期发布产品列表 |

## 开始使用

### 前提条件
- 安装微信开发者工具
- 拥有腾讯云开发账号

### 配置云开发环境
在 `miniprogram/app.js` 中修改环境 ID：
```javascript
wx.cloud.init({
  env: 'your-env-id', // 替换为你的云开发环境 ID
  traceUser: true,
});
```

### 本地开发
1. 打开微信开发者工具，导入本项目
2. 上传并部署所有云函数
3. 点击开发工具中的预览按钮，查看效果

## 注意事项

1. **所有修改必须提交 Git** 后才能返回结果
2. **删除文件必须用户确认** 再执行
3. **北京时间 (UTC+8)** 用于所有日期处理
4. 用户历史页面限制为 90 天内订单
5. 店长历史页面可用自定义日期范围
6. 云函数修改后需重新上传部署
7. 用户端与店长端页面**必须分开**，不要混用

## 自动化测试

### 运行模式：连接重于启动 (Connect Mode)
- 要求保持 `cli auto --auto-port 9420` 窗口常驻
- 测试脚本必须使用 `automator.connect` 模式
- 避免 Linux 下反复拉起图形界面导致的 X11 锁死和内存溢出

### 验证逻辑：状态重于像素 (Data over UI)
- 优先验证 `page.data` 的数值，而非等待 UI 渲染
- 必须捕获控制台的 `[TEST_SUCCESS]` 日志作为提交的唯一通行证
- Ubuntu 渲染模拟器可能存在延迟，但逻辑层的 WebSocket 数据传输是即时的

### 容错保障：超时与路径自动化 (Fail-safe)
- 测试脚本必须设置 30-40s 的硬性 `process.exit(1)` 超时
- 脚本必须动态读取 `miniprogram/app.json` 以获取正确的页面路由
- 如果连接失败，必须尝试 `cli open` 后再重连

## 扩展开发
您可以根据项目需求，添加新的云函数和页面，实现更多的云开发功能。
