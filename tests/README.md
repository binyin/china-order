# 馒头店小程序 - 测试说明

## 测试文件

| 文件 | 运行方式 | 说明 |
|------|----------|------|
| `e2e-test.js` | CodeBuddy Code 代理执行 | 完整 E2E 测试，通过 CloudBase MCP 工具直接操作线上数据库和云函数 |
| `e2e-console-test.js` | 微信开发者工具 Console 粘贴 | IIFE 格式，可直接在 Console 中粘贴回车执行 |
| `flow-test.js` | 微信开发者工具 Console | 前端功能流程测试（需 `wx.cloud` 环境） |
| `cloud-functions-test.js` | 微信开发者工具 Console | 云函数专项测试 |

## 运行方法

### 方式一：CodeBuddy Code 代理执行（推荐）

在 CodeBuddy Code 中说：

```
运行 tests/e2e-test.js 的测试
```

CodeBuddy Code 会逐个测试模块调用 CloudBase MCP 工具，直接操作线上数据库和云函数，输出测试结果。

### 方式二：微信开发者工具 Console

1. 打开微信开发者工具，进入小程序项目
2. 切换到 Console 面板
3. 复制 `e2e-console-test.js` 全部内容
4. 粘贴到 Console 中回车执行
5. 查看输出的测试结果

### 方式三：微信开发者工具 Console（旧版）

分别粘贴 `flow-test.js` 和 `cloud-functions-test.js` 执行。

## 测试覆盖范围（14个模块）

### 前端功能 100% 覆盖映射

| 测试模块 | 覆盖的前端页面/功能 | 涉及的操作 |
|----------|---------------------|------------|
| 1. adminLogin | `pages/admin/login` | 正确/错误/空值登录，3个账号 |
| 2. 产品 CRUD | `pages/admin/products` | 添加/查询/修改/删除产品 |
| 3. 菜单发布 | `pages/admin/menu` | 增量上架/取消上架/编辑库存/publishMenu批量发布/空数组 |
| 4. createOrder | `pages/user/index` confirmOrder | 正常预定/空单/未上架/库存不足/无客户名默认值 |
| 5. cancelOrder | `pages/user/index` + `pages/admin/orders` | 取消订单+库存恢复/重复取消/空ID/不存在订单 |
| 6. undoCancel | `pages/admin/orders` undoAction(cancelled) | 撤销取消+库存恢复/pending状态撤销失败/空ID |
| 7. verifyOrder | `pages/admin/orders` verifyOrder | 核销取走 pending→completed/库存不变 |
| 8. undoVerify | `pages/admin/orders` undoAction(completed) | 撤销核销 completed→pending/库存不变 |
| 9. getMyOrders | `pages/user/index` + `pages/user/history` | 无OPENID场景/返回结构 |
| 10. historyOrders | `pages/admin/orders` 历史 + `pages/user/history` | 今日订单/按日期查询/字段完整性/分组汇总 |
| 11. getOpenId | `app.js` + 云函数 | 获取用户身份 |
| 12. menuHistory | `pages/admin/menu` 历史复用 | 菜单历史查询/按日期分组 |
| 13. stockEdgeCase | 库存边界 | 0库存/刚好够/部分已售/售罄 |
| 14. orderStatusFlow | 订单全生命周期 | pending↔completed↔cancelled 全状态流转 + db.cancelOrder分支 |

### 云函数覆盖

| 云函数 | 测试场景 |
|--------|----------|
| adminLogin | 正确/错误密码/空值/3个账号 |
| createOrder | 正常/空单/未上架/库存不足/无客户名 |
| cancelOrder | 正常取消/重复取消/非pending状态/空ID/不存在ID |
| undoCancel | 正常撤销/非cancelled状态/空ID |
| publishMenu | 批量发布/空数组 |
| getMyOrders | 有/无OPENID |
| getOpenId | 管理端调用 |

### 数据库集合覆盖

| 集合 | 操作 |
|------|------|
| products | add/get/update/delete |
| active_menu | add/get/update/delete/where+date |
| orders | add/get/update/where+date/where+status |

### 前端功能点覆盖清单

- [x] 产品添加（addProduct）
- [x] 产品查询（getAllProducts，分页）
- [x] 产品修改（updateProduct）
- [x] 产品删除（deleteProduct）
- [x] 菜单增量上架（addMenuItem）
- [x] 菜单取消上架（removeMenuItem）
- [x] 菜单编辑库存（updateMenuStock）
- [x] 菜单批量发布/历史复用（publishMenu云函数）
- [x] 用户浏览菜单（getTodayMenu）
- [x] 用户下单（createOrder云函数）
- [x] 库存原子扣减（ordered字段_.inc）
- [x] 库存不足校验
- [x] 未上架商品校验
- [x] 空订单校验
- [x] 无客户名错误处理
- [x] 用户取消订单（cancelOrder云函数）
- [x] 取消订单恢复库存
- [x] 重复取消失败
- [x] 管理员核销取走（updateOrderStatus → completed）
- [x] 管理员取消订单（cancelOrder云函数）
- [x] 撤销取消（undoCancel云函数 + 恢复库存）
- [x] 撤销核销（updateOrderStatus → pending）
- [x] 获取用户订单（getMyOrders云函数）
- [x] 今日订单查询（getTodayOrders）
- [x] 历史订单查询（getRecentOrders）
- [x] 菜单历史查询（getMenuHistory）
- [x] 管理员登录（adminLogin云函数）
- [x] 管理员登录守卫（3个账号）
- [x] 获取用户身份（getOpenId云函数）
- [x] 订单字段完整性（create_time_str/customer_id/items/total_price）
- [x] 库存边界（0/刚好够/售罄）
- [x] 订单全状态流转
- [x] db.cancelOrder分支（前端直接update不恢复库存）
