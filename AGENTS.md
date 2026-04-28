# AGENTS.md - 橙馨馒头店项目指令

## 项目概述

- **类型**：微信小程序 + 腾讯云开发 (CloudBase)
- **框架**：原生小程序框架
- **核心功能**：点单、核销、订单管理

---

## 目录结构

```
miniprogram/
├── app.js, app.json, app.wxss
├── pages/
│   ├── user/      # 用户端页面
│   │   ├── index.js, history.js, setting.js
│   └── admin/     # 店长端页面 (需登录)
│       ├── login.js, orders.js, menu.js, products.js, history.js
├── utils/db.js    # 数据库操作封装
└── images/

cloudfunctions/
├── getUserTodayOrder/      # 用户-当日订单
├── getUserOrderHistory/    # 用户-历史订单(90天)
├── getAdminTodayOrders/    # 管理员-当日订单
├── getAdminOrderHistory/   # 管理员-历史订单(日期+用户过滤)
├── createOrder/            # 创建订单
├── publishMenu/           # 发布菜单
├── cancelOrder/           # 取消订单
└── ...其他云函数
```

---

## 关键约束

1. **所有修改必须提交 Git** 后才能返回结果
2. **删除文件必须用户确认** 再执行
3. **北京时间 (UTC+8)** 用于所有日期处理，`getTodayBJDateStr()` 或 `getBJDateStr()`
4. **用户历史页面** (`pages/user/history`) 限制为 90 天内订单
5. **店长历史页面** (`pages/admin/history`) 可用自定义日期范围

---

## 页面与云函数对应

| 页面 | 云函数 | 功能 |
|------|--------|------|
| 用户首页 | `createOrder` | 下单 |
| 用户历史 | `getUserOrderHistory` | 仅看自己90天内 |
| 店长核销 | `getAdminTodayOrders` | 当日所有订单 |
| 店长历史 | `getAdminOrderHistory` | 所有+日期过滤+用户过滤 |

---

## 数据库集合

| 集合 | 用途 |
|------|------|
| `products` | 产品模板库 |
| `active_menu` | 发布菜单 |
| `orders` | 订单记录 |
| `configs` | 店长账号 |
| `users` | 用户信息 |

---

## 常用命令

```bash
# 部署云函数 (需在云开发控制台操作)
tcb fn deploy <functionName>

# 或通过小程序开发工具上传
```

---

## 已安装工具

1. `tcb` - CloudBase CLI (操作腾讯云)
2. `cli` - 微信开发者工具别名

---

## 注意事项

- 云函数修改后需重新上传部署
- 用户端与店长端页面**必须分开**，不要混用
- 日期查询使用北京时间，避免时区问题