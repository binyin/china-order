# 馒头店点单核销助手 Pro - 开发架构与规范手册

## 1. 项目概况
- **目标**：实现极简点单与老板单手实时核销。
- **环境**：Ubuntu 24.04 / 微信小程序原生框架 / 云开发。
- **核心逻辑**：基于"模板-发布-订单"三层模型。

---

## 2. 目录结构说明 (Directory Structure)
```text
/
├── project.config.json     # 项目配置 (cloudfunctionRoot)
├── db_data/                # 本地数据库源文件 (JSONL格式，用于 tcb 导入)
│   ├── products.json       # 品类模板 (name, price, unit, image_url)
│   ├── config.json         # 权限配置 (username, password, nickname, role)
│   └── orders.json         # 测试订单数据
├── cloudfunctions/         # 云函数逻辑
│   ├── createOrder/        # 下单 + 原子化库存扣减
│   ├── adminLogin/         # 店主登录验证
│   └── publishMenu/        # 发布今日菜单
├── pages/                  # 小程序页面
│   ├── user/               # 用户端：大字号、滑动点单
│   └── admin/              # 老板端：登录、产品管理、发布中心、核销看板、数据初始化
├── images/                 # 本地静态图标
├── utils/                  # 封装的数据库与逻辑工具
├── app.js                  # 初始化云环境、全局状态管理
├── app.json                # 路由与全局窗口配置
├── app.wxss                # 全局样式 (大字体极简风格)
├── request.md              # 需求文档 (最高逻辑准则)
├── 角色故事.md             # 业务场景参考
└── test.data               # 原始接龙数据参考
```

## 3. 数据库集合 (Collections)
| 集合名 | 用途 | 字段 |
|--------|------|------|
| `products` | 产品模板库 | name, price, unit, image_url |
| `configs` | 权限配置 | username(手机号), password, nickname, role |
| `active_menu` | 今日发布菜单 | product_id, name, price, unit, image_url, stock, ordered, date |
| `orders` | 订单记录 | customer_name, items[{name, num}], total_price, status, date, create_time |

## 4. 环境说明
本地有部署 CloudBase CLI，尽量使用他，少手动操作。
