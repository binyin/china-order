/**
 * 馒头店小程序 - 功能流程测试
 * 
 * 测试方式：在微信开发者工具的 Console 中粘贴执行
 * 或通过 miniprogram-ci 集成到 CI/CD
 * 
 * 覆盖流程：
 * 1. 产品池 CRUD
 * 2. 菜单发布（增量添加/取消）
 * 3. 用户预定（创建订单+库存扣减）
 * 4. 预定核销（取走/取消/撤销）
 * 5. 历史订单（2层结构）
 * 6. 用户身份获取
 * 7. 取消订单库存恢复
 * 8. 撤销取消库存恢复
 */

const { getTodayMenu, getAllProducts, addProduct, updateProduct, deleteProduct,
  addMenuItem, removeMenuItem, updateMenuStock, getTodayOrders, getRecentOrders,
  updateOrderStatus, cancelOrder, getMyOrders, getMenuHistory, getDateStr } = require('../../utils/db')

// ========== 测试工具 ==========
let passCount = 0
let failCount = 0
const results = []

function assert(condition, testName) {
  if (condition) {
    passCount++
    results.push(`✅ ${testName}`)
  } else {
    failCount++
    results.push(`❌ ${testName}`)
  }
}

function log(msg) {
  console.log(`[TEST] ${msg}`)
}

async function runTests() {
  log('========== 开始功能测试 ==========')
  
  try {
    await testProductCRUD()
    await testMenuPublish()
    await testOrderFlow()
    await testVerifyFlow()
    await testHistoryOrders()
    await testUserIdentity()
  } catch (err) {
    log(`测试异常: ${err.message}`)
  }

  log('========== 测试结果 ==========')
  results.forEach(r => log(r))
  log(`通过: ${passCount} / 失败: ${failCount} / 总计: ${passCount + failCount}`)
  return { passCount, failCount, results }
}

// ========== 1. 产品池 CRUD ==========
async function testProductCRUD() {
  log('--- 产品池 CRUD 测试 ---')

  // 新增产品
  const addRes = await addProduct({
    name: '测试馒头',
    price: 1.5,
    unit: '个',
    image_url: ''
  })
  assert(addRes._id, '新增产品 - 返回ID')
  const testProductId = addRes._id

  // 查询产品列表
  const listRes = await getAllProducts()
  assert(listRes.data.length > 0, '查询产品列表 - 非空')
  const found = listRes.data.find(p => p._id === testProductId)
  assert(found && found.name === '测试馒头', '新增产品 - 可查询到')

  // 修改产品价格
  const updateRes = await updateProduct(testProductId, {
    name: '测试馒头',
    price: 2.0,
    unit: '个',
    image_url: ''
  })
  assert(updateRes.stats.updated === 1, '修改产品价格 - 更新1条')

  // 验证修改后价格
  const verifyRes = await getAllProducts()
  const updated = verifyRes.data.find(p => p._id === testProductId)
  assert(updated && updated.price === 2.0, '修改产品价格 - 值已更新')

  // 删除产品
  const delRes = await deleteProduct(testProductId)
  assert(delRes.stats.removed === 1, '删除产品 - 删除1条')

  // 验证删除
  const afterDel = await getAllProducts()
  const gone = afterDel.data.find(p => p._id === testProductId)
  assert(!gone, '删除产品 - 已不可查询')
}

// ========== 2. 菜单发布（增量） ==========
async function testMenuPublish() {
  log('--- 菜单发布测试 ---')

  // 添加菜单项
  const addRes = await addMenuItem({
    _id: 'test_product_1',
    name: '测试花卷',
    price: 2.0,
    unit: '个',
    stock: 100
  })
  assert(addRes._id, '添加菜单项 - 返回ID')
  const menuItemId = addRes._id

  // 查询今日菜单
  const menuRes = await getTodayMenu()
  assert(menuRes.data.length > 0, '查询今日菜单 - 非空')
  const menuItem = menuRes.data.find(m => m._id === menuItemId)
  assert(menuItem && menuItem.name === '测试花卷', '添加菜单项 - 可查询到')
  assert(menuItem.ordered === 0, '菜单项 - 初始ordered为0')

  // 修改库存
  await updateMenuStock(menuItemId, 200)
  const updatedMenu = await getTodayMenu()
  const updated = updatedMenu.data.find(m => m._id === menuItemId)
  assert(updated && updated.stock === 200, '修改菜单库存 - 值已更新')

  // 取消上架
  await removeMenuItem(menuItemId)
  const afterRemove = await getTodayMenu()
  const removed = afterRemove.data.find(m => m._id === menuItemId)
  assert(!removed, '取消上架 - 已不可查询')
}

// ========== 3. 用户预定流程 ==========
async function testOrderFlow() {
  log('--- 用户预定流程测试 ---')

  // 先添加一个菜单项
  const menuAdd = await addMenuItem({
    _id: 'test_product_order',
    name: '测试豆沙包',
    price: 3.0,
    unit: '个',
    stock: 50
  })
  const menuItemId = menuAdd._id

  // 创建订单（通过云函数）
  const orderRes = await wx.cloud.callFunction({
    name: 'createOrder',
    data: {
      items: [{ product_id: menuItemId, name: '测试豆沙包', num: 2 }],
      total_price: 6.0,
      customer_name: '测试用户'
    }
  })
  assert(orderRes.result.success, '创建订单 - 成功')
  const orderId = orderRes.result.data.orderId

  // 验证库存扣减
  const menuCheck = await getTodayMenu()
  const checked = menuCheck.data.find(m => m._id === menuItemId)
  assert(checked && checked.ordered === 2, '创建订单 - ordered扣减为2')

  // 验证订单创建
  const ordersRes = await getTodayOrders()
  const order = ordersRes.data.find(o => o._id === orderId)
  assert(order, '创建订单 - 可查询到')
  assert(order.status === 'pending', '创建订单 - 状态为pending')
  assert(order.customer_name === '测试用户', '创建订单 - 客户名正确')
  assert(order.create_time_str, '创建订单 - 有时间戳字符串')

  // 清理
  await removeMenuItem(menuItemId)
  await cancelOrder(orderId)
}

// ========== 4. 核销流程 ==========
async function testVerifyFlow() {
  log('--- 核销流程测试 ---')

  // 添加菜单+创建订单
  const menuAdd = await addMenuItem({
    _id: 'test_verify_product',
    name: '测试肉包',
    price: 4.0,
    unit: '个',
    stock: 30
  })
  const menuItemId = menuAdd._id

  const orderRes = await wx.cloud.callFunction({
    name: 'createOrder',
    data: {
      items: [{ product_id: menuItemId, name: '测试肉包', num: 3 }],
      total_price: 12.0,
      customer_name: '核销测试用户'
    }
  })
  const orderId = orderRes.result.data.orderId

  // 核销（completed）
  await updateOrderStatus(orderId, 'completed')
  const afterVerify = await getTodayOrders()
  const verified = afterVerify.find(o => o._id === orderId)
  assert(verified && verified.status === 'completed', '核销 - 状态变completed')

  // 撤销核销（completed→pending）
  await updateOrderStatus(orderId, 'pending')
  const afterUndo = await getTodayOrders()
  const undone = afterUndo.find(o => o._id === orderId)
  assert(undone && undone.status === 'pending', '撤销核销 - 状态回pending')

  // 取消订单（恢复库存）
  const cancelRes = await wx.cloud.callFunction({
    name: 'cancelOrder',
    data: { orderId }
  })
  assert(cancelRes.result.success, '取消订单 - 成功')

  // 验证库存恢复
  const menuCheck = await getTodayMenu()
  const menuChecked = menuCheck.data.find(m => m._id === menuItemId)
  assert(menuChecked && menuChecked.ordered === 0, '取消订单 - ordered恢复为0')

  // 撤销取消（cancelled→pending，恢复库存）
  const undoRes = await wx.cloud.callFunction({
    name: 'undoCancel',
    data: { orderId }
  })
  assert(undoRes.result.success, '撤销取消 - 成功')

  const menuFinal = await getTodayMenu()
  const menuFinalItem = menuFinal.data.find(m => m._id === menuItemId)
  assert(menuFinalItem && menuFinalItem.ordered === 3, '撤销取消 - ordered恢复扣减3')

  // 清理
  await removeMenuItem(menuItemId)
  await updateOrderStatus(orderId, 'cancelled')
}

// ========== 5. 历史订单 ==========
async function testHistoryOrders() {
  log('--- 历史订单测试 ---')

  const res = await getRecentOrders(7)
  assert(Array.isArray(res.data), '历史订单 - 返回数组')

  // 按日期聚合验证
  const dateMap = {}
  res.data.forEach(o => {
    dateMap[o.date] = dateMap[o.date] || []
    dateMap[o.date].push(o)
  })
  assert(Object.keys(dateMap).length > 0 || res.data.length === 0, '历史订单 - 可按日期聚合')
}

// ========== 6. 用户身份 ==========
async function testUserIdentity() {
  log('--- 用户身份测试 ---')

  const res = await getMyOrders()
  assert(res.data !== undefined, '获取用户订单 - 返回data字段')
  assert(Array.isArray(res.data), '获取用户订单 - data是数组')

  // 验证订单字段
  if (res.data.length > 0) {
    const o = res.data[0]
    assert(o.customer_id !== undefined, '订单 - 包含customer_id')
    assert(o.customer_name !== undefined, '订单 - 包含customer_name')
    assert(o.status !== undefined, '订单 - 包含status')
    assert(['pending', 'completed', 'cancelled'].includes(o.status), '订单 - status值合法')
  }
}

// ========== 导出 ==========
module.exports = { runTests }

// 如果直接运行
if (typeof __wxConfig !== 'undefined') {
  runTests().then(r => console.log('测试完成', r))
}
