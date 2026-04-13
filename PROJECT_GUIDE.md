# 馒头店点单核销助手 Pro - 开发架构与规范手册

## 1. 项目概况
- **目标**：实现极简点单与老板单手实时核销。
- **环境**：Ubuntu 24.04 / 微信小程序原生框架 / 云开发。
- **核心逻辑**：基于"模板-发布-订单"三层模型。

---

## 2. 目录结构说明 (Directory Structure)


## 3. 数据库集合 (Collections)
| 集合名 | 用途 | 字段 |
|--------|------|------|
| `products` | 产品模板库 | name, price, unit, image_url |
| `configs` | 权限配置 | username(手机号), password, nickname, role |
| `active_menu` | 今日发布菜单 | product_id, name, price, unit, image_url, stock, ordered, date |
| `orders` | 订单记录 | customer_name, items[{name, num}], total_price, status, date, create_time |

## 4. 环境说明
本地有部署 CloudBase CLI，尽量使用他，少手动操作。
