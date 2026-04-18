/**
 * 云函数功能测试
 * 
 * 测试方式：在微信开发者工具 Console 中执行
 * 或在云函数环境中通过 tcb 对象调用
 * 
 * 覆盖：
 * - createOrder：创建订单 + 库存扣减
 * - cancelOrder：取消订单 + 库存恢复
 * - undoCancel：撤销取消 + 库存恢复
 * - getMyOrders：获取当前用户订单
 * - adminLogin：店主登录
 */

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
  console.log(`[CLOUD-TEST] ${msg}`)
}

async function callFn(name, data) {
  return wx.cloud.callFunction({ name, data }).then(r => r.result)
}

async function runCloudTests() {
  log('========== 云函数测试开始 ==========')

  let testMenuItemId = null
  let testOrderId = null
  let testProductImage = 'cloud://test-image-123.jpg'

  try {
    // 准备：添加今日菜单项（带图片）
    log('准备测试数据...')
    const { addMenuItem, removeMenuItem, getTodayMenu, addProduct } = require('../../utils/db')
    const addRes = await addMenuItem({
      _id: 'cloud_test_product',
      name: '云函数测试包子',
      price: 5.0,
      unit: '个',
      image_url: testProductImage,
      stock: 20
    })
    testMenuItemId = addRes._id
    log(`测试菜单项已添加: ${testMenuItemId}`)

    // === 0. 产品图片功能 ===
    log('--- 产品图片功能测试 ---')

    // 添加产品（带图片）
    const prodRes = await addProduct({
      name: '云函数测试图片产品',
      price: 8.0,
      unit: '个',
      image_url: 'cloud://prod-img-test.jpg'
    })
    const testProdId = prodRes._id
    assert(prodRes.image_url === 'cloud://prod-img-test.jpg', 'addProduct - 图片URL正确存储')

    // 发布到菜单（带图片）
    const menuRes = await addMenuItem({
      _id: 'cloud_test_img_menu',
      name: '云函数测试图片菜品',
      price: 8.0,
      unit: '个',
      image_url: 'cloud://menu-img-test.jpg',
      stock: 10
    })
    const testMenuImgId = menuRes._id
    assert(menuRes.image_url === 'cloud://menu-img-test.jpg', 'addMenuItem - 图片URL正确存储')

    // 验证菜单项图片在查询中正确返回
    const menuList = await getTodayMenu()
    const menuItem = menuList.data.find(m => m._id === testMenuImgId)
    assert(menuItem && menuItem.image_url === 'cloud://menu-img-test.jpg', 'getTodayMenu - 图片URL正确返回')

    // 清理测试产品
    try {
      const { removeProduct } = require('../../utils/db')
      await removeProduct(testProdId)
      await removeMenuItem(testMenuImgId)
    } catch (e) {}

    // === 1. createOrder ===
    log('--- createOrder 测试 ---')

    // 正常创建
    const createRes = await callFn('createOrder', {
      items: [{ product_id: testMenuItemId, name: '云函数测试包子', num: 3 }],
      total_price: 15.0,
      customer_name: '云测试用户'
    })
    assert(createRes.success === true, 'createOrder - 正常创建成功')
    assert(createRes.data && createRes.data.orderId, 'createOrder - 返回orderId')
    testOrderId = createRes.data.orderId

    // 验证库存扣减
    const menuAfterCreate = await getTodayMenu()
    const itemAfterCreate = menuAfterCreate.data.find(m => m._id === testMenuItemId)
    assert(itemAfterCreate && itemAfterCreate.ordered === 3, 'createOrder - ordered=3')

    // 验证订单字段
    const { getTodayOrders } = require('../../utils/db')
    const ordersAfterCreate = await getTodayOrders()
    const createdOrder = ordersAfterCreate.data.find(o => o._id === testOrderId)
    assert(createdOrder !== undefined, 'createOrder - 订单存在')
    assert(createdOrder.status === 'pending', 'createOrder - 状态pending')
    assert(createdOrder.customer_name === '云测试用户', 'createOrder - customer_name正确')
    assert(createdOrder.customer_id !== undefined, 'createOrder - customer_id存在(OPENID)')
    assert(createdOrder.create_time_str !== undefined, 'createOrder - create_time_str存在')

    // 超库存创建
    const overStockRes = await callFn('createOrder', {
      items: [{ product_id: testMenuItemId, name: '云函数测试包子', num: 20 }],
      total_price: 100.0,
      customer_name: '超额用户'
    })
    assert(overStockRes.success === false, 'createOrder - 超库存失败')
    assert(overStockRes.message.includes('库存不足'), 'createOrder - 超库存提示正确')

    // 空订单
    const emptyRes = await callFn('createOrder', {
      items: [],
      total_price: 0,
      customer_name: '空用户'
    })
    assert(emptyRes.success === false, 'createOrder - 空订单失败')

    // === 2. cancelOrder ===
    log('--- cancelOrder 测试 ---')

    const cancelRes = await callFn('cancelOrder', { orderId: testOrderId })
    assert(cancelRes.success === true, 'cancelOrder - 取消成功')

    // 验证库存恢复
    const menuAfterCancel = await getTodayMenu()
    const itemAfterCancel = menuAfterCancel.data.find(m => m._id === testMenuItemId)
    assert(itemAfterCancel && itemAfterCancel.ordered === 0, 'cancelOrder - ordered恢复为0')

    // 重复取消
    const reCancelRes = await callFn('cancelOrder', { orderId: testOrderId })
    assert(reCancelRes.success === false, 'cancelOrder - 重复取消失败')

    // === 3. undoCancel ===
    log('--- undoCancel 测试 ---')

    const undoRes = await callFn('undoCancel', { orderId: testOrderId })
    assert(undoRes.success === true, 'undoCancel - 撤销取消成功')

    // 验证库存恢复扣减
    const menuAfterUndo = await getTodayMenu()
    const itemAfterUndo = menuAfterUndo.data.find(m => m._id === testMenuItemId)
    assert(itemAfterUndo && itemAfterUndo.ordered === 3, 'undoCancel - ordered恢复为3')

    // === 4. getMyOrders ===
    log('--- getMyOrders 测试 ---')

    const myOrdersRes = await callFn('getMyOrders', {})
    assert(myOrdersRes.success === true, 'getMyOrders - 成功')
    assert(Array.isArray(myOrdersRes.data), 'getMyOrders - 返回数组')

    // === 5. adminLogin ===
    log('--- adminLogin 测试 ---')

    const loginRes = await callFn('adminLogin', {
      username: '13126983890',
      password: 'pw123'
    })
    assert(loginRes.success === true, 'adminLogin - 正确密码登录成功')
    assert(loginRes.data && loginRes.data.nickname === '欢欢老板', 'adminLogin - 返回nickname')

    const wrongLoginRes = await callFn('adminLogin', {
      username: '13126983890',
      password: 'wrong'
    })
    assert(wrongLoginRes.success === false, 'adminLogin - 错误密码登录失败')

    const emptyLoginRes = await callFn('adminLogin', {
      username: '',
      password: ''
    })
    assert(emptyLoginRes.success === false, 'adminLogin - 空账号登录失败')

  } catch (err) {
    log(`测试异常: ${err.message}`)
    results.push(`❌ 异常: ${err.message}`)
  } finally {
    // 清理
    if (testMenuItemId) {
      try {
        const { removeMenuItem } = require('../../utils/db')
        await removeMenuItem(testMenuItemId)
      } catch (e) {}
    }
  }

  log('========== 云函数测试结果 ==========')
  results.forEach(r => log(r))
  log(`通过: ${passCount} / 失败: ${failCount} / 总计: ${passCount + failCount}`)
  return { passCount, failCount, results }
}

module.exports = { runCloudTests }
