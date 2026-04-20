# 操作轨迹记录

## 2026-04-19

### 21:00 - 优化 getMyOrders 云函数支持获取所有历史订单
- 问题: getMyOrders 只返回指定日期订单，历史页面无法显示
- 修复: 云函数支持有 date 参数时过滤，无 date 参数时返回全部订单
- 命令: `echo y | tcb fn deploy -e cloudbase-2gjs1hdd0c429545 getMyOrders`
- 结果: 云函数更新成功

### 20:55 - 修复 getMyOrders 调用方式（根本原因）
- 问题根本原因: 前端 `utils/db.js` 的 `getMyOrders` 直接调用数据库查询，没有使用云函数，导致无法获取 OPENID 过滤用户订单
- 修复: 
  1. 修改 `miniprogram/utils/db.js` 中的 `getMyOrders`，改用 `wx.cloud.callFunction` 调用云函数
  2. 更新云函数 `getMyOrders` 支持传入 `date` 参数
- 命令: `echo y | tcb fn deploy -e cloudbase-2gjs1hdd0c429545 getMyOrders`
- 结果: 云函数更新成功

### 20:50 - 修复 getMyOrders 查询问题（第二次）
- 问题: 仍然返回 count:0
- 原因: 可能是数据库查询条件问题
- 修复: 改用先查询所有订单，再在内存中过滤今日订单的方式
- 命令: `echo y | tcb fn deploy -e cloudbase-2gjs1hdd0c429545 getMyOrders`
- 结果: 云函数更新成功

### 20:43 - 修复 getMyOrders 云函数，只获取今日订单
- 问题: `getMyOrders` 获取所有历史订单，导致首页不显示今日订单
- 修改: 修改 `getMyOrders/index.js`，添加日期筛选 `date: todayStr`
- 命令: `echo y | tcb fn deploy -e cloudbase-2gjs1hdd0c429545 getMyOrders`
- 结果: 云函数更新成功
- 额外: 创建索引 `idx_date_customer` 提升查询性能

### 20:35 - 清除小程序缓存
- 命令: `cli cache --clean all --project /data/work/idear/china-order-new/miniprogram`
- 结果: 缓存已清除

## 2026-04-18

### 21:01 - 重新部署云函数 cleanupDb (修复cron表达式)
- 修复: `config.json` 中 cron 表达式从 8 段改为 7 段 `0 0 3 * * * *`
- 命令: `echo y | tcb fn deploy -e cloudbase-2gjs1hdd0c429545 cleanupDb`
- 结果: 云函数代码更新成功
- 触发器创建仍然失败: `[BatchCreateTrigger] 批量创建触发器失败，请稍后重试`
- 云函数环境: cloudbase-2gjs1hdd0c429545

**问题**: 腾讯云服务端触发器API持续失败

## 2026-04-20

### 01:50 - 订单功能脚本验证通过
- 测试内容:
  1. createOrder 创建订单 - 成功 (使用今日已发布菜单项创建订单，orderId: 2e3df17869e51559003ad01d69a27627)
  2. getTodayOrders 今日订单查询 - 成功 (返回5条今日订单，包含测试订单E2E测试用户A)
  3. getRecentOrders 历史订单查询 - 成功 (返回7天内订单，按日期倒序)
- 测试数据已清理:
  - 菜单项: 36ced35f69e514f6003b0bdf1dd00e11 (已删除)
  - 订单: 2e3df17869e51559003ad01d69a27627 (已删除)
- 结果: ALL PASSED!

### 10:30 - 修复微信授权头像昵称问题
- 问题: 用户授权后显示"微信用户"，头像为空
- 根因: wx.getUserProfile 已废弃，返回固定值
- 修复内容:
  1. 修改 `miniprogram/pages/user/index.wxml` - 使用 chooseAvatar + nickname input
  2. 修改 `miniprogram/pages/user/index.js` - 添加 onChooseAvatar/onNicknameInput/onAuthConfirm
  3. 修改 `miniprogram/pages/user/index.wxss` - 添加样式
  4. 修复订单创建时 customer_avatar 取值错误 (userProfile -> savedProfile)
- 结果: 代码已修改，等待部署测试

### 11:00 - 优化授权流程，体验更流畅
- 改动:
  1. 首次进入可直接浏览菜单，无需授权
  2. 提交订单时才触发授权（懒授权）
  3. 授权弹窗内直接选择头像+输入昵称，一气呵成
  4. 已授权用户下次直接可用
- 修改文件:
  - miniprogram/pages/user/index.js - checkAuthStatus/confirmOrder
  - miniprogram/pages/user/index.wxml - 移除独立授权页，合并到订单弹窗
  - miniprogram/pages/user/index.wxss - 头像选择样式
- 结果: 已更新