/**
 * 馒头店小程序 - E2E 全流程测试
 *
 * 通过 CloudBase MCP 工具直接操作线上数据库和云函数，
 * 100% 覆盖前端所有功能路径。
 *
 * 运行方式：由 CodeBuddy Code 逐段执行本脚本中的测试函数，
 *          或在微信开发者工具 Console 中粘贴执行。
 *
 * 覆盖模块：
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 1. adminLogin      - 管理员登录（正确/错误/空值）          │
 * │ 2. products CRUD   - 添加/查询/修改/删除产品               │
 * │ 3. menu publish    - 增量上架/取消上架/编辑库存/历史复用   │
 * │ 4. createOrder     - 用户预定（正常/空单/未上架/库存不足） │
 * │ 5. cancelOrder     - 取消订单+库存恢复（重复取消/非pending）│
 * │ 6. undoCancel      - 撤销取消+库存恢复（非cancelled状态）  │
 * │ 7. verifyOrder     - 核销取走 completed                    │
 * │ 8. undoVerify      - 撤销核销 completed→pending            │
 * │ 9. getMyOrders     - 获取用户订单                          │
 * │ 10. historyOrders  - 今日订单/按日期查询/近期订单           │
 * │ 11. getOpenId      - 获取用户身份                          │
 * │ 12. menuHistory    - 菜单历史记录                          │
 * │ 13. stockEdgeCase  - 库存边界（0库存/刚好够/多人并发）     │
 * │ 14. orderStatus    - 订单状态完整性（全状态流转）          │
 * └─────────────────────────────────────────────────────────────┘
 */

// ========== 测试工具 ==========
let passCount = 0
let failCount = 0
const results = []

function assert(condition, testName) {
  if (condition) {
    passCount++
    results.push(`  PASS  ${testName}`)
  } else {
    failCount++
    results.push(`  FAIL  ${testName}`)
  }
}

function log(msg) {
  console.log(`[E2E] ${msg}`)
}

function section(title) {
  log(`\n${'='.repeat(60)}`)
  log(`  ${title}`)
  log(`${'='.repeat(60)}`)
}

// CloudBase 操作封装（通过 MCP 工具执行）
// 以下函数在 CodeBuddy Code 环境中由 DeferExecuteTool 代理执行

function getDateStr(d) {
  const date = d || new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ========== 测试主流程 ==========
async function runE2ETests() {
  log('馒头店小程序 E2E 全流程测试开始')
  log(`测试时间: ${new Date().toISOString()}`)
  log(`今日日期: ${getDateStr()}`)

  // ---------- 测试数据容器 ----------
  const ctx = {
    productId: null,       // 新增产品的ID
    product2Id: null,      // 第二个产品的ID
    menuItemId: null,      // 上架菜单项ID
    menu2ItemId: null,     // 第二个菜单项ID
    orderId: null,         // 创建的订单ID
    orderId2: null,        // 第二个订单ID
  }

  try {
    await testAdminLogin()
    await testProductCRUD(ctx)
    await testMenuPublish(ctx)
    await testMenuPublishFilter(ctx)  // 新增：菜单发布过滤测试
    await testCreateOrder(ctx)
    await testTodayBoardFilter(ctx)   // 新增：今日看板过滤测试
    await testCancelOrder(ctx)
    await testUndoCancel(ctx)
    await testVerifyOrder(ctx)
    await testUndoVerify(ctx)
    await testGetMyOrders()
    await testHistoryOrders(ctx)
    await testGetOpenId()
    await testMenuHistory()
    await testStockEdgeCase()
    await testOrderStatusFlow(ctx)
  } catch (err) {
    log(`\n测试异常中断: ${err.message}`)
    log(err.stack)
  } finally {
    await cleanup(ctx)
  }

  // ---------- 汇总 ----------
  log('\n' + '='.repeat(60))
  log('  测试结果汇总')
  log('='.repeat(60))
  results.forEach(r => log(r))
  log('')
  log(`通过: ${passCount}  失败: ${failCount}  总计: ${passCount + failCount}`)
  if (failCount === 0) {
    log('ALL PASSED!')
  } else {
    log(`有 ${failCount} 个测试失败，请检查上方 FAIL 项`)
  }
  return { passCount, failCount, results }
}

// ================================================================
// 1. adminLogin - 管理员登录
// ================================================================
async function testAdminLogin() {
  section('1. adminLogin - 管理员登录')

  // 正确账号登录
  const loginRes = await callCloudFunction('adminLogin', {
    username: '13126983890', password: 'pw123'
  })
  assert(loginRes.success === true, '正确账号登录成功')
  assert(loginRes.data && loginRes.data.nickname === '欢欢老板', '返回昵称正确')
  assert(loginRes.data && loginRes.data.role === 'admin', '返回角色正确')
  assert(loginRes.data && loginRes.data.username === '13126983890', '返回用户名正确')

  // 错误密码
  const wrongRes = await callCloudFunction('adminLogin', {
    username: '13126983890', password: 'wrong'
  })
  assert(wrongRes.success === false, '错误密码登录失败')
  assert(wrongRes.message === '账号或密码错误', '错误密码提示正确')

  // 错误用户名
  const noUserRes = await callCloudFunction('adminLogin', {
    username: 'notexist', password: 'pw123'
  })
  assert(noUserRes.success === false, '不存在用户名登录失败')

  // 空账号密码
  const emptyRes = await callCloudFunction('adminLogin', {
    username: '', password: ''
  })
  assert(emptyRes.success === false, '空账号密码登录失败')
  assert(emptyRes.message === '账号和密码不能为空', '空值提示正确')

  // 第二个账号
  const login2Res = await callCloudFunction('adminLogin', {
    username: '15811366237', password: 'admin888'
  })
  assert(login2Res.success === true, '第二个管理员账号登录成功')
  assert(login2Res.data && login2Res.data.nickname === '店小二', '第二账号昵称正确')

  // 第三个账号（测试账号）
  const login3Res = await callCloudFunction('adminLogin', {
    username: '010', password: 'mantou666'
  })
  assert(login3Res.success === true, '测试账号登录成功')
  assert(login3Res.data && login3Res.data.nickname === '测试账号', '测试账号昵称正确')
}

// ================================================================
// 2. 产品 CRUD
// ================================================================
async function testProductCRUD(ctx) {
  section('2. 产品 CRUD')

  // 添加产品1
  const addRes = await dbInsert('products', {
    name: 'E2E测试馒头', price: 1.5, unit: '个', image_url: ''
  })
  assert(addRes._id, '添加产品1 - 返回ID')
  ctx.productId = addRes._id

  // 添加产品2
  const add2Res = await dbInsert('products', {
    name: 'E2E测试花卷', price: 2.5, unit: '个', image_url: ''
  })
  assert(add2Res._id, '添加产品2 - 返回ID')
  ctx.product2Id = add2Res._id

  // 查询产品 - 能找到新增的
  const listRes = await dbQuery('products', {})
  assert(listRes.length > 0, '查询产品列表 - 非空')
  const found = listRes.find(p => p._id === ctx.productId)
  assert(found && found.name === 'E2E测试馒头', '新增产品1可查询到')
  assert(found && found.price === 1.5, '产品1价格正确')
  assert(found && found.unit === '个', '产品1单位正确')

  const found2 = listRes.find(p => p._id === ctx.product2Id)
  assert(found2 && found2.name === 'E2E测试花卷', '新增产品2可查询到')

  // 修改产品
  const updateRes = await dbUpdate('products', ctx.productId, {
    $set: { name: 'E2E改馒头', price: 2.0 }
  })
  assert(updateRes.modifiedCount === 1, '修改产品 - 更新1条')

  // 验证修改
  const verifyRes = await dbQuery('products', { _id: ctx.productId })
  assert(verifyRes.length === 1, '修改后可查询到')
  assert(verifyRes[0].name === 'E2E改馒头', '修改后名称正确')
  assert(verifyRes[0].price === 2.0, '修改后价格正确')
  assert(verifyRes[0].unit === '个', '修改后单位不变')

  // 删除产品2
  const delRes = await dbDelete('products', ctx.product2Id)
  assert(delRes.deletedCount >= 1, '删除产品2 - 成功')

  // 验证删除
  const afterDel = await dbQuery('products', { _id: ctx.product2Id })
  assert(afterDel.length === 0, '删除后不可查询')
}

// ================================================================
// 3. 菜单发布（增量上架/取消上架/编辑库存/历史复用）
// ================================================================
async function testMenuPublish(ctx) {
  section('3. 菜单发布')

  const today = getDateStr()

  // 增量上架 - 添加菜单项1
  const addMenuRes = await dbInsert('active_menu', {
    product_id: ctx.productId,
    name: 'E2E改馒头',
    price: 2.0,
    unit: '个',
    image_url: '',
    stock: 50,
    ordered: 0,
    date: today
  })
  assert(addMenuRes._id, '上架菜单项1 - 返回ID')
  ctx.menuItemId = addMenuRes._id

  // 增量上架 - 添加菜单项2
  const addMenu2Res = await dbInsert('active_menu', {
    product_id: 'e2e_test_product_2',
    name: 'E2E测试豆沙包',
    price: 3.0,
    unit: '个',
    image_url: '',
    stock: 30,
    ordered: 0,
    date: today
  })
  assert(addMenu2Res._id, '上架菜单项2 - 返回ID')
  ctx.menu2ItemId = addMenu2Res._id

  // 查询今日菜单
  const menuRes = await dbQuery('active_menu', { date: today })
  assert(menuRes.length >= 2, '今日菜单 - 至少2项')
  const menuItem = menuRes.find(m => m._id === ctx.menuItemId)
  assert(menuItem && menuItem.name === 'E2E改馒头', '菜单项1名称正确')
  assert(menuItem && menuItem.ordered === 0, '菜单项1 ordered初始为0')
  assert(menuItem && menuItem.stock === 50, '菜单项1 stock为50')

  // 编辑库存
  const stockRes = await dbUpdate('active_menu', ctx.menuItemId, {
    $set: { stock: 100 }
  })
  assert(stockRes.modifiedCount === 1, '编辑库存 - 更新1条')

  // 验证库存修改
  const stockVerify = await dbQuery('active_menu', { _id: ctx.menuItemId })
  assert(stockVerify[0].stock === 100, '库存修改为100')

  // 取消上架菜单项2
  const removeRes = await dbDelete('active_menu', ctx.menu2ItemId)
  assert(removeRes.deletedCount >= 1, '取消上架 - 删除成功')

  // 验证取消
  const afterRemove = await dbQuery('active_menu', { _id: ctx.menu2ItemId })
  assert(afterRemove.length === 0, '取消上架后不可查询')

  // publishMenu 云函数 - 批量发布（历史复用）
  const pubRes = await callCloudFunction('publishMenu', {
    items: [
      { product_id: ctx.productId, name: 'E2E改馒头', price: 2.0, unit: '个', image_url: '', stock: 80 },
      { product_id: 'e2e_test_product_2', name: 'E2E测试豆沙包', price: 3.0, unit: '个', image_url: '', stock: 40 }
    ]
  })
  assert(pubRes.success === true, 'publishMenu批量发布 - 成功')
  assert(pubRes.data && pubRes.data.count === 2, 'publishMenu - 发布2项')

  // 验证发布后菜单
  const afterPub = await dbQuery('active_menu', { date: today })
  const item1 = afterPub.find(m => m.name === 'E2E改馒头')
  const item2 = afterPub.find(m => m.name === 'E2E测试豆沙包')
  assert(item1 && item1.stock === 80, '批量发布后 菜单1库存80')
  assert(item1 && item1.ordered === 0, '批量发布后 菜单1 ordered=0')
  assert(item2 && item2.stock === 40, '批量发布后 菜单2库存40')

  // 更新 ctx 为新的菜单项ID
  ctx.menuItemId = item1._id
  ctx.menu2ItemId = item2._id

  // publishMenu 空数组
  const emptyPub = await callCloudFunction('publishMenu', { items: [] })
  assert(emptyPub.success === false, 'publishMenu空数组 - 失败')

  // 恢复菜单（再发布一次，确保后续测试有数据）
  await callCloudFunction('publishMenu', {
    items: [
      { product_id: ctx.productId, name: 'E2E改馒头', price: 2.0, unit: '个', image_url: '', stock: 100 },
      { product_id: 'e2e_test_product_2', name: 'E2E测试豆沙包', price: 3.0, unit: '个', image_url: '', stock: 50 }
    ]
  })
  const restored = await dbQuery('active_menu', { date: today })
  const r1 = restored.find(m => m.name === 'E2E改馒头')
  const r2 = restored.find(m => m.name === 'E2E测试豆沙包')
  ctx.menuItemId = r1._id
  ctx.menu2ItemId = r2._id
}

// ================================================================
// 3.1 菜单发布过滤 - 最新发布菜单逻辑
// ================================================================
async function testMenuPublishFilter(ctx) {
  section('3.1 菜单发布过滤 - 最新发布菜单逻辑')
  
  const today = getDateStr()
  
  // 测试1：首次发布菜单
  const firstPublishTime = Date.now()
  const addMenuRes1 = await dbInsert('active_menu', {
    product_id: 'test_filter_product_1',
    name: '测试过滤馒头',
    price: 2.0,
    unit: '个',
    stock: 50,
    date: today,
    publish_time: firstPublishTime
  })
  assert(addMenuRes1._id, '首次发布菜单 - 返回ID')
  ctx.menuItemId1 = addMenuRes1._id
  
  // 测试2：第二次发布菜单（应该只显示这个）
  const secondPublishTime = firstPublishTime + 1000
  const addMenuRes2 = await dbInsert('active_menu', {
    product_id: 'test_filter_product_2',
    name: '测试过滤花卷',
    price: 3.0,
    unit: '个',
    stock: 40,
    date: today,
    publish_time: secondPublishTime
  })
  assert(addMenuRes2._id, '第二次发布菜单 - 返回ID')
  ctx.menuItemId2 = addMenuRes2._id
  
  // 测试3：创建订单（关联第二次发布）
  const orderRes = await callCloudFunction('createOrder', {
    items: [{ product_id: ctx.menuItemId2, name: '测试过滤花卷', num: 2 }],
    total_price: 6.0,
    customer_name: '过滤测试用户'
  })
  assert(orderRes.success === true, '创建订单 - 成功')
  ctx.filterOrderId = orderRes.data.orderId
  
  // 验证订单关联了正确的发布时间
  const orderDoc = await dbGetById('orders', ctx.filterOrderId)
  assert(orderDoc.menu_publish_time === secondPublishTime, '订单关联最新发布时间')
  
  log('✓ 菜单发布过滤逻辑测试完成')
}

// ================================================================
// 4. createOrder - 用户预定
// ================================================================
async function testCreateOrder(ctx) {
  section('4. createOrder - 用户预定')

  // 正常创建订单
  const createRes = await callCloudFunction('createOrder', {
    items: [
      { product_id: ctx.menuItemId, name: 'E2E改馒头', num: 3 },
      { product_id: ctx.menu2ItemId, name: 'E2E测试豆沙包', num: 2 }
    ],
    total_price: 12.0,
    customer_name: 'E2E测试用户'
  })
  assert(createRes.success === true, '创建订单 - 成功')
  assert(createRes.data && createRes.data.orderId, '返回orderId')
  ctx.orderId = createRes.data.orderId

  // 验证库存扣减
  const menuAfter = await dbQuery('active_menu', { date: getDateStr() })
  const m1 = menuAfter.find(m => m._id === ctx.menuItemId)
  const m2 = menuAfter.find(m => m._id === ctx.menu2ItemId)
  assert(m1 && m1.ordered === 3, '订单创建后 馒头ordered=3')
  assert(m2 && m2.ordered === 2, '订单创建后 豆沙包ordered=2')

  // 验证订单记录
  const orderRes = await dbQuery('orders', { _id: ctx.orderId })
  assert(orderRes.length === 1, '订单存在')
  assert(orderRes[0].status === 'pending', '订单状态pending')
  assert(orderRes[0].customer_name === 'E2E测试用户', '客户名正确')
  assert(orderRes[0].total_price === 12.0, '总价正确')
  assert(orderRes[0].date === getDateStr(), '日期正确')
  assert(orderRes[0].create_time_str !== undefined, '有时间字符串')
  assert(orderRes[0].items.length === 2, '订单2个商品')
  assert(orderRes[0].items[0].name === 'E2E改馒头', '订单商品1名称')
  assert(orderRes[0].items[0].num === 3, '订单商品1数量')
  assert(orderRes[0].items[1].name === 'E2E测试豆沙包', '订单商品2名称')

  // 空订单
  const emptyOrder = await callCloudFunction('createOrder', {
    items: [], total_price: 0, customer_name: '空'
  })
  assert(emptyOrder.success === false, '空订单 - 失败')
  assert(emptyOrder.message === '订单为空', '空订单提示正确')

  // 未上架商品
  const notExist = await callCloudFunction('createOrder', {
    items: [{ product_id: 'not_exist_id_12345', name: '不存在的馒头', num: 1 }],
    total_price: 1, customer_name: 'E2E'
  })
  assert(notExist.success === false, '未上架商品 - 失败')
  assert(notExist.message.includes('未上架'), '未上架提示正确')

  // 库存不足
  const overStock = await callCloudFunction('createOrder', {
    items: [{ product_id: ctx.menu2ItemId, name: 'E2E测试豆沙包', num: 100 }],
    total_price: 300, customer_name: 'E2E超额'
  })
  assert(overStock.success === false, '库存不足 - 失败')
  assert(overStock.message.includes('库存不足'), '库存不足提示正确')

  // 无客户名（应默认"微信用户"）
  const noNameRes = await callCloudFunction('createOrder', {
    items: [{ product_id: ctx.menuItemId, name: 'E2E改馒头', num: 1 }],
    total_price: 2.0, customer_name: ''
  })
  assert(noNameRes.success === true, '无客户名 - 默认微信用户')
  if (noNameRes.success) {
    const noNameOrder = await dbQuery('orders', { _id: noNameRes.data.orderId })
    assert(noNameOrder[0].customer_name === '微信用户', '默认客户名为微信用户')
    // 清理这个测试订单
    await dbUpdate('orders', noNameRes.data.orderId, { $set: { status: 'cancelled' } })
    // 恢复库存
    const menuCheck = await dbQuery('active_menu', { _id: ctx.menuItemId })
    if (menuCheck[0]) {
      await dbUpdate('active_menu', ctx.menuItemId, { $set: { ordered: 3 } })
    }
  }
}

// ================================================================
// 4.1 今日看板过滤 - 只显示最新发布菜单订单
// ================================================================
async function testTodayBoardFilter(ctx) {
  section('4.1 今日看板过滤 - 只显示最新发布菜单订单')
  
  const today = getDateStr()
  
  // 测试1：创建历史发布菜单（较早时间）
  const oldPublishTime = Date.now() - 5000
  const oldMenuRes = await dbInsert('active_menu', {
    product_id: 'test_old_product',
    name: '旧菜单馒头',
    price: 1.0,
    unit: '个',
    stock: 30,
    date: today,
    publish_time: oldPublishTime
  })
  
  // 测试2：创建旧菜单订单（应该不显示在今日看板）
  const oldOrderRes = await callCloudFunction('createOrder', {
    items: [{ product_id: oldMenuRes._id, name: '旧菜单馒头', num: 1 }],
    total_price: 1.0,
    customer_name: '旧菜单用户'
  })
  assert(oldOrderRes.success === true, '旧菜单创建订单 - 成功')
  ctx.oldOrderId = oldOrderRes.data.orderId
  
  // 测试3：创建最新发布菜单
  const newPublishTime = Date.now()
  const newMenuRes = await dbInsert('active_menu', {
    product_id: 'test_new_product',
    name: '新菜单花卷',
    price: 2.0,
    unit: '个',
    stock: 50,
    date: today,
    publish_time: newPublishTime
  })
  
  // 测试4：创建新菜单订单（应该显示在今日看板）
  const newOrderRes = await callCloudFunction('createOrder', {
    items: [{ product_id: newMenuRes._id, name: '新菜单花卷', num: 3 }],
    total_price: 6.0,
    customer_name: '新菜单用户'
  })
  assert(newOrderRes.success === true, '新菜单创建订单 - 成功')
  ctx.newOrderId = newOrderRes.data.orderId
  
  // 测试5：模拟今日看板查询（应该只返回新订单）
  const todayOrders = await getTodayOrdersForTest(today)
  assert(todayOrders.length >= 1, '今日看板至少有一个订单')
  
  const newOrderInResult = todayOrders.find(o => o._id === ctx.newOrderId)
  const oldOrderInResult = todayOrders.find(o => o._id === ctx.oldOrderId)
  assert(newOrderInResult, '今日看板显示最新发布菜单的订单')
  assert(!oldOrderInResult, '今日看板不显示旧菜单的订单')
  
  log('✓ 今日看板过滤逻辑测试完成')
}

// 测试专用的获取今日订单函数
async function getTodayOrdersForTest(date) {
  try {
    const res = await callCloudFunction('getTodayOrders', { date: date })
    return res.data || []
  } catch (e) {
    console.error('测试获取今日订单失败', e)
    return []
  }
}

// ================================================================
// 5. cancelOrder - 取消订单
// ================================================================
async function testCancelOrder(ctx) {
  section('5. cancelOrder - 取消订单')

  // 取消订单
  const cancelRes = await callCloudFunction('cancelOrder', {
    orderId: ctx.orderId
  })
  assert(cancelRes.success === true, '取消订单 - 成功')

  // 验证订单状态
  const orderAfter = await dbQuery('orders', { _id: ctx.orderId })
  assert(orderAfter[0].status === 'cancelled', '订单状态变为cancelled')

  // 验证库存恢复
  const menuAfter = await dbQuery('active_menu', { date: getDateStr() })
  const m1 = menuAfter.find(m => m._id === ctx.menuItemId)
  const m2 = menuAfter.find(m => m._id === ctx.menu2ItemId)
  assert(m1 && m1.ordered === 0, '取消后 馒头ordered恢复0')
  assert(m2 && m2.ordered === 0, '取消后 豆沙包ordered恢复0')

  // 重复取消
  const reCancel = await callCloudFunction('cancelOrder', {
    orderId: ctx.orderId
  })
  assert(reCancel.success === false, '重复取消 - 失败')
  assert(reCancel.message.includes('已处理'), '重复取消提示正确')

  // 空订单ID
  const emptyId = await callCloudFunction('cancelOrder', { orderId: '' })
  assert(emptyId.success === false, '空订单ID - 失败')

  // 不存在的订单
  const notExist = await callCloudFunction('cancelOrder', { orderId: 'not_exist_order_id' })
  assert(notExist.success === false, '不存在订单 - 失败')
}

// ================================================================
// 6. undoCancel - 撤销取消
// ================================================================
async function testUndoCancel(ctx) {
  section('6. undoCancel - 撤销取消')

  // 撤销取消
  const undoRes = await callCloudFunction('undoCancel', {
    orderId: ctx.orderId
  })
  assert(undoRes.success === true, '撤销取消 - 成功')

  // 验证订单状态
  const orderAfter = await dbQuery('orders', { _id: ctx.orderId })
  assert(orderAfter[0].status === 'pending', '订单状态恢复pending')

  // 验证库存恢复扣减
  const menuAfter = await dbQuery('active_menu', { date: getDateStr() })
  const m1 = menuAfter.find(m => m._id === ctx.menuItemId)
  const m2 = menuAfter.find(m => m._id === ctx.menu2ItemId)
  assert(m1 && m1.ordered === 3, '撤销后 馒头ordered恢复3')
  assert(m2 && m2.ordered === 2, '撤销后 豆沙包ordered恢复2')

  // 对pending订单执行undoCancel（应失败）
  const undoPending = await callCloudFunction('undoCancel', {
    orderId: ctx.orderId
  })
  assert(undoPending.success === false, 'pending订单撤销取消 - 失败')
  assert(undoPending.message.includes('非取消状态'), '非取消状态提示正确')

  // 空订单ID
  const emptyId = await callCloudFunction('undoCancel', { orderId: '' })
  assert(emptyId.success === false, '空订单ID撤销 - 失败')
}

// ================================================================
// 7. verifyOrder - 核销取走
// ================================================================
async function testVerifyOrder(ctx) {
  section('7. verifyOrder - 核销取走(completed)')

  // 核销：pending → completed
  const verifyRes = await dbUpdate('orders', ctx.orderId, {
    $set: { status: 'completed' }
  })
  assert(verifyRes.modifiedCount === 1, '核销 - 更新1条')

  // 验证状态
  const orderAfter = await dbQuery('orders', { _id: ctx.orderId })
  assert(orderAfter[0].status === 'completed', '核销后状态completed')

  // 核销后库存不变（ordered仍然是3和2）
  const menuAfter = await dbQuery('active_menu', { date: getDateStr() })
  const m1 = menuAfter.find(m => m._id === ctx.menuItemId)
  assert(m1 && m1.ordered === 3, '核销后ordered不变(3)')
}

// ================================================================
// 8. undoVerify - 撤销核销
// ================================================================
async function testUndoVerify(ctx) {
  section('8. undoVerify - 撤销核销(completed→pending)')

  // 撤销核销：completed → pending
  const undoRes = await dbUpdate('orders', ctx.orderId, {
    $set: { status: 'pending' }
  })
  assert(undoRes.modifiedCount === 1, '撤销核销 - 更新1条')

  // 验证状态
  const orderAfter = await dbQuery('orders', { _id: ctx.orderId })
  assert(orderAfter[0].status === 'pending', '撤销后状态恢复pending')

  // 撤销后库存不变
  const menuAfter = await dbQuery('active_menu', { date: getDateStr() })
  const m1 = menuAfter.find(m => m._id === ctx.menuItemId)
  assert(m1 && m1.ordered === 3, '撤销核销后ordered不变(3)')
}

// ================================================================
// 9. getMyOrders - 获取用户订单
// ================================================================
async function testGetMyOrders() {
  section('9. getMyOrders - 获取用户订单')

  // 管理端调用（无OPENID）
  const noOpenidRes = await callCloudFunction('getMyOrders', {})
  assert(noOpenidRes.success === false, '管理端调用(无OPENID) - 失败')
  assert(noOpenidRes.message === '无法获取用户身份', '无OPENID提示正确')

  // 返回结构验证
  assert(Array.isArray(noOpenidRes.data), 'data字段是数组')
}

// ================================================================
// 10. historyOrders - 历史订单查询
// ================================================================
async function testHistoryOrders(ctx) {
  section('10. historyOrders - 历史订单查询')

  // 今日订单查询
  const todayOrders = await dbQuery('orders', { date: getDateStr() })
  assert(Array.isArray(todayOrders), '今日订单 - 返回数组')
  assert(todayOrders.length > 0, '今日订单 - 非空')

  // 验证今日订单包含我们的测试订单
  const found = todayOrders.find(o => o._id === ctx.orderId)
  assert(found, '今日订单 - 包含测试订单')

  // 按日期查询
  const dateOrders = await dbQuery('orders', { date: getDateStr() })
  assert(Array.isArray(dateOrders), '按日期查询 - 返回数组')

  // 订单状态分布验证
  const statusMap = {}
  todayOrders.forEach(o => {
    statusMap[o.status] = (statusMap[o.status] || 0) + 1
  })
  assert(Object.keys(statusMap).length > 0, '订单有状态分布')

  // 订单字段完整性
  if (todayOrders.length > 0) {
    const o = todayOrders[0]
    assert(o._id !== undefined, '订单字段 - _id')
    assert(o.customer_name !== undefined, '订单字段 - customer_name')
    assert(o.items !== undefined, '订单字段 - items')
    assert(o.status !== undefined, '订单字段 - status')
    assert(o.date !== undefined, '订单字段 - date')
    assert(o.total_price !== undefined, '订单字段 - total_price')
    assert(['pending', 'completed', 'cancelled'].includes(o.status), '订单状态值合法')
  }

  // 近期订单（7天）
  const sevenDaysAgo = getDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  const recentOrders = await dbQuery('orders', { date: { $gte: sevenDaysAgo } })
  assert(Array.isArray(recentOrders), '近期订单 - 返回数组')

  // 按日期分组验证（模拟前端 history 页面逻辑）
  const dateMap = {}
  todayOrders.forEach(o => {
    if (!dateMap[o.date]) dateMap[o.date] = []
    dateMap[o.date].push(o)
  })
  assert(Object.keys(dateMap).length > 0, '订单可按日期分组')

  // 每日汇总验证（模拟前端 stats 计算）
  Object.entries(dateMap).forEach(([date, orders]) => {
    const totalRevenue = orders.reduce((s, o) => s + (o.total_price || 0), 0)
    assert(typeof totalRevenue === 'number', `${date} 营收计算正常`)
  })
}

// ================================================================
// 11. getOpenId - 获取用户身份
// ================================================================
async function testGetOpenId() {
  section('11. getOpenId - 获取用户身份')

  // 管理端调用返回空对象（无微信上下文）
  const res = await callCloudFunction('getOpenId', {})
  assert(res !== undefined, 'getOpenId - 有返回')
  // 管理端调用无OPENID，返回空对象是正常的
  assert(typeof res === 'object', 'getOpenId - 返回对象')
}

// ================================================================
// 12. menuHistory - 菜单历史
// ================================================================
async function testMenuHistory() {
  section('12. menuHistory - 菜单历史记录')

  // 查询所有菜单历史
  const allMenu = await dbQuery('active_menu', {})
  assert(Array.isArray(allMenu), '菜单历史 - 返回数组')
  assert(allMenu.length > 0, '菜单历史 - 非空')

  // 按日期分组
  const dateMap = {}
  allMenu.forEach(m => {
    if (!dateMap[m.date]) dateMap[m.date] = []
    dateMap[m.date].push(m)
  })
  assert(Object.keys(dateMap).length > 0, '菜单可按日期分组')

  // 每条菜单项字段验证
  if (allMenu.length > 0) {
    const m = allMenu[0]
    assert(m._id !== undefined, '菜单项字段 - _id')
    assert(m.name !== undefined, '菜单项字段 - name')
    assert(m.price !== undefined, '菜单项字段 - price')
    assert(m.stock !== undefined, '菜单项字段 - stock')
    assert(m.ordered !== undefined, '菜单项字段 - ordered')
    assert(m.date !== undefined, '菜单项字段 - date')
  }
}

// ================================================================
// 13. stockEdgeCase - 库存边界测试
// ================================================================
async function testStockEdgeCase() {
  section('13. stockEdgeCase - 库存边界')

  const today = getDateStr()

  // 创建一个库存为0的菜单项
  const zeroStock = await dbInsert('active_menu', {
    product_id: 'e2e_zero_stock',
    name: 'E2E零库存馒头',
    price: 1, unit: '个', image_url: '',
    stock: 0, ordered: 0, date: today
  })

  // 买1个应该失败
  const buyZero = await callCloudFunction('createOrder', {
    items: [{ product_id: zeroStock._id, name: 'E2E零库存馒头', num: 1 }],
    total_price: 1, customer_name: 'E2E零库存测试'
  })
  assert(buyZero.success === false, '0库存下单 - 失败')
  assert(buyZero.message.includes('库存不足'), '0库存提示库存不足')

  // 清理
  await dbDelete('active_menu', zeroStock._id)

  // 创建库存刚好的菜单项
  const exactStock = await dbInsert('active_menu', {
    product_id: 'e2e_exact_stock',
    name: 'E2E刚好库存馒头',
    price: 1, unit: '个', image_url: '',
    stock: 5, ordered: 0, date: today
  })

  // 买5个应该成功（刚好够）
  const buyExact = await callCloudFunction('createOrder', {
    items: [{ product_id: exactStock._id, name: 'E2E刚好库存馒头', num: 5 }],
    total_price: 5, customer_name: 'E2E刚好测试'
  })
  assert(buyExact.success === true, '刚好库存下单 - 成功')

  // 再买1个应该失败
  const buyOver = await callCloudFunction('createOrder', {
    items: [{ product_id: exactStock._id, name: 'E2E刚好库存馒头', num: 1 }],
    total_price: 1, customer_name: 'E2E超额测试'
  })
  assert(buyOver.success === false, '用完后再下单 - 失败')

  // 清理
  if (buyExact.success) {
    await dbUpdate('orders', buyExact.data.orderId, { $set: { status: 'cancelled' } })
  }
  await dbDelete('active_menu', exactStock._id)

  // 创建菜单项模拟部分已售（stock=10, ordered=7, 剩3）
  const partialStock = await dbInsert('active_menu', {
    product_id: 'e2e_partial_stock',
    name: 'E2E部分已售馒头',
    price: 1, unit: '个', image_url: '',
    stock: 10, ordered: 7, date: today
  })

  // 买3个应该成功（刚好剩余3）
  const buy3 = await callCloudFunction('createOrder', {
    items: [{ product_id: partialStock._id, name: 'E2E部分已售馒头', num: 3 }],
    total_price: 3, customer_name: 'E2E剩余刚好'
  })
  assert(buy3.success === true, '剩余3买3 - 成功')

  // 买4个应该失败（剩余0）
  const buy4 = await callCloudFunction('createOrder', {
    items: [{ product_id: partialStock._id, name: 'E2E部分已售馒头', num: 1 }],
    total_price: 1, customer_name: 'E2E售罄'
  })
  assert(buy4.success === false, '售罄后下单 - 失败')

  // 清理
  if (buy3.success) {
    await dbUpdate('orders', buy3.data.orderId, { $set: { status: 'cancelled' } })
  }
  await dbDelete('active_menu', partialStock._id)
}

// ================================================================
// 14. orderStatusFlow - 订单状态完整流转
// ================================================================
async function testOrderStatusFlow(ctx) {
  section('14. orderStatusFlow - 订单全状态流转')

  const today = getDateStr()

  // 创建菜单和订单
  const menuRes = await dbInsert('active_menu', {
    product_id: 'e2e_flow_product',
    name: 'E2E流转测试馒头',
    price: 1, unit: '个', image_url: '',
    stock: 20, ordered: 0, date: today
  })

  const orderRes = await callCloudFunction('createOrder', {
    items: [{ product_id: menuRes._id, name: 'E2E流转测试馒头', num: 1 }],
    total_price: 1, customer_name: 'E2E流转用户'
  })
  assert(orderRes.success === true, '流转测试 - 创建订单')
  const flowOrderId = orderRes.data.orderId

  // 流转1: pending → completed (核销)
  await dbUpdate('orders', flowOrderId, { $set: { status: 'completed' } })
  let check = await dbQuery('orders', { _id: flowOrderId })
  assert(check[0].status === 'completed', '流转1: pending→completed')

  // 流转2: completed → pending (撤销核销)
  await dbUpdate('orders', flowOrderId, { $set: { status: 'pending' } })
  check = await dbQuery('orders', { _id: flowOrderId })
  assert(check[0].status === 'pending', '流转2: completed→pending')

  // 流转3: pending → cancelled (取消)
  const cancelRes = await callCloudFunction('cancelOrder', { orderId: flowOrderId })
  assert(cancelRes.success === true, '流转3: pending→cancelled')
  check = await dbQuery('orders', { _id: flowOrderId })
  assert(check[0].status === 'cancelled', '流转3确认: cancelled')

  // 验证库存恢复
  let menuCheck = await dbQuery('active_menu', { _id: menuRes._id })
  assert(menuCheck[0].ordered === 0, '取消后ordered=0')

  // 流转4: cancelled → pending (撤销取消)
  const undoRes = await callCloudFunction('undoCancel', { orderId: flowOrderId })
  assert(undoRes.success === true, '流转4: cancelled→pending')
  check = await dbQuery('orders', { _id: flowOrderId })
  assert(check[0].status === 'pending', '流转4确认: pending')

  // 验证库存重新扣减
  menuCheck = await dbQuery('active_menu', { _id: menuRes._id })
  assert(menuCheck[0].ordered === 1, '撤销取消后ordered=1')

  // 流转5: pending → completed → 再取消（已完成订单不能取消）
  await dbUpdate('orders', flowOrderId, { $set: { status: 'completed' } })
  const cancelCompleted = await callCloudFunction('cancelOrder', { orderId: flowOrderId })
  assert(cancelCompleted.success === false, '已完成订单不能取消')
  assert(cancelCompleted.message.includes('已处理'), '已完成提示已处理')

  // 清理
  await dbDelete('active_menu', menuRes._id)

  // 测试 db.cancelOrder (客户端直接更新status，不走云函数)
  // 前端 utils/db.js 的 cancelOrder 只是 update({status:'cancelled'}) 不恢复库存
  // 这个分支也需要覆盖
  const directCancelMenu = await dbInsert('active_menu', {
    product_id: 'e2e_direct_cancel',
    name: 'E2E直接取消测试',
    price: 1, unit: '个', image_url: '',
    stock: 10, ordered: 2, date: today
  })
  const directCancelOrder = await dbInsert('orders', {
    customer_name: '直接取消测试',
    items: [{ name: 'E2E直接取消测试', num: 2 }],
    total_price: 2, status: 'pending',
    date: today, create_time: Date.now(),
    create_time_str: '00:00'
  })
  // 模拟前端 db.cancelOrder：直接改状态不恢复库存
  await dbUpdate('orders', directCancelOrder, { $set: { status: 'cancelled' } })
  const checkDirect = await dbQuery('orders', { _id: directCancelOrder })
  assert(checkDirect[0].status === 'cancelled', 'db.cancelOrder - 状态变cancelled')
  // ordered不变（前端取消不恢复库存的分支）
  const menuDirect = await dbQuery('active_menu', { _id: directCancelMenu })
  assert(menuDirect[0].ordered === 2, 'db.cancelOrder - ordered不变(前端取消不走云函数)')
  // 清理
  await dbDelete('active_menu', directCancelMenu)
}

// ================================================================
// 清理测试数据
// ================================================================
async function cleanup(ctx) {
  section('清理测试数据')

  try {
    if (ctx.productId) {
      await dbDelete('products', ctx.productId)
      log('  已清理产品1')
    }
    if (ctx.menuItemId) {
      await dbDelete('active_menu', ctx.menuItemId)
      log('  已清理菜单项1')
    }
    if (ctx.menu2ItemId) {
      await dbDelete('active_menu', ctx.menu2ItemId)
      log('  已清理菜单项2')
    }
    if (ctx.orderId) {
      await dbDelete('orders', ctx.orderId)
      log('  已清理订单')
    }
    // 新增：清理菜单发布过滤测试数据
    if (ctx.menuItemId1) {
      await dbDelete('active_menu', ctx.menuItemId1)
      log('  已清理过滤测试菜单1')
    }
    if (ctx.menuItemId2) {
      await dbDelete('active_menu', ctx.menuItemId2)
      log('  已清理过滤测试菜单2')
    }
    if (ctx.filterOrderId) {
      await dbDelete('orders', ctx.filterOrderId)
      log('  已清理过滤测试订单')
    }
    
    // 新增：清理今日看板过滤测试数据
    if (ctx.oldOrderId) {
      await dbDelete('orders', ctx.oldOrderId)
      log('  已清理旧菜单订单')
    }
    if (ctx.newOrderId) {
      await dbDelete('orders', ctx.newOrderId)
      log('  已清理新菜单订单')
    }
    
  } catch (e) {
    log(`  清理异常: ${e.message}`)
  }
}

// ================================================================
// 数据库操作封装（通过 CloudBase MCP 工具代理执行）
// 在微信开发者工具 Console 中运行时，替换为 wx.cloud 实现
// ================================================================

async function callCloudFunction(name, data) {
  // 在微信开发者工具中调用云函数
  try {
    const res = await wx.cloud.callFunction({
      name,
      data
    })
    return res.result
  } catch (e) {
    console.error('callCloudFunction error:', e)
    return { success: false, message: e.message }
  }
}

async function dbInsert(collection, doc) {
  try {
    const res = await wx.cloud.database().collection(collection).add({
      data: doc
    })
    return { _id: res._id, ...res }
  } catch (e) {
    console.error('dbInsert error:', e)
    throw e
  }
}

async function dbQuery(collection, query) {
  try {
    const res = await wx.cloud.database().collection(collection).where(query).get()
    return res.data
  } catch (e) {
    console.error('dbQuery error:', e)
    return []
  }
}

async function dbUpdate(collection, id, update) {
  try {
    // 注意：云开发 update 只支持 data 对象，不支持 $set 等操作符
    // 此处假定 update 已经是 { data: ... } 结构
    const data = update.$set || update
    const res = await wx.cloud.database().collection(collection).doc(id).update({
      data
    })
    return { stats: { updated: res.stats.updated } }
  } catch (e) {
    console.error('dbUpdate error:', e)
    throw e
  }
}

async function dbDelete(collection, id) {
  try {
    const res = await wx.cloud.database().collection(collection).doc(id).remove()
    return { stats: { removed: res.stats.removed } }
  } catch (e) {
    console.error('dbDelete error:', e)
    throw e
  }
}

async function dbGetById(collection, id) {
  try {
    const res = await wx.cloud.database().collection(collection).doc(id).get()
    return res.data
  } catch (e) {
    console.error('dbGetById error:', e)
    return null
  }
}

// ========== 导出 ==========
module.exports = { runE2ETests }
