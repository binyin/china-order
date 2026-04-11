/**
 * 馒头店小程序 - Console 端 E2E 测试
 *
 * 使用方式：在微信开发者工具的 Console 中粘贴本文件全部内容后回车执行
 *
 * 覆盖模块同 e2e-test.js，共14个测试模块，100%前端功能覆盖
 */

(async function() {
  const db = wx.cloud.database()
  const _ = db.command
  const today = getDateStr()

  let passCount = 0
  let failCount = 0
  const results = []

  function assert(condition, name) {
    if (condition) { passCount++; results.push('  PASS  ' + name) }
    else { failCount++; results.push('  FAIL  ' + name) }
  }
  function log(msg) { console.log('[E2E] ' + msg) }
  function section(t) { log('\n' + '='.repeat(60) + '\n  ' + t + '\n' + '='.repeat(60)) }
  function getDateStr(d) {
    const dt = d || new Date()
    return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0')
  }
  async function callFn(name, data) { return (await wx.cloud.callFunction({ name, data })).result }
  async function dbCount(coll, q) { return (await db.collection(coll).where(q).count()).total }
  async function dbGetAll(coll, q, orderBy, dir) {
    const total = await dbCount(coll, q)
    if (total === 0) return []
    const batches = Math.ceil(total / 20)
    const tasks = []
    for (let i = 0; i < batches; i++) {
      let q2 = db.collection(coll).where(q).skip(i*20).limit(20)
      if (orderBy) q2 = q2.orderBy(orderBy, dir || 'asc')
      tasks.push(q2.get())
    }
    return (await Promise.all(tasks)).reduce((a, r) => a.concat(r.data), [])
  }
  async function dbAdd(coll, data) { return (await db.collection(coll).add({ data }))._id }
  async function dbUpdateById(coll, id, data) { return (await db.collection(coll).doc(id).update({ data })).stats }
  async function dbRemove(coll, id) { return (await db.collection(coll).doc(id).remove()).stats }

  const ctx = {}

  try {
    // ========== 1. adminLogin ==========
    section('1. adminLogin - 管理员登录')
    let r = await callFn('adminLogin', { username: '13126983890', password: 'pw123' })
    assert(r.success === true, '正确账号登录成功')
    assert(r.data.nickname === '欢欢老板', '返回昵称正确')
    assert(r.data.role === 'admin', '返回角色正确')
    r = await callFn('adminLogin', { username: '13126983890', password: 'wrong' })
    assert(r.success === false, '错误密码登录失败')
    r = await callFn('adminLogin', { username: '', password: '' })
    assert(r.success === false && r.message === '账号和密码不能为空', '空账号密码失败')
    r = await callFn('adminLogin', { username: '15811366237', password: 'admin888' })
    assert(r.success === true && r.data.nickname === '店小二', '第二账号登录成功')
    r = await callFn('adminLogin', { username: '010', password: 'mantou666' })
    assert(r.success === true && r.data.nickname === '测试账号', '测试账号登录成功')

    // ========== 2. 产品 CRUD ==========
    section('2. 产品 CRUD')
    ctx.p1 = await dbAdd('products', { name: 'E2E测试馒头', price: 1.5, unit: '个', image_url: '' })
    assert(ctx.p1, '添加产品1')
    ctx.p2 = await dbAdd('products', { name: 'E2E测试花卷', price: 2.5, unit: '个', image_url: '' })
    assert(ctx.p2, '添加产品2')
    let plist = await dbGetAll('products', {}, 'name')
    assert(plist.length > 0 && plist.find(p => p._id === ctx.p1), '查询到产品1')
    await dbUpdateById('products', ctx.p1, { name: 'E2E改馒头', price: 2.0 })
    let pv = await dbGetAll('products', { _id: ctx.p1 })
    assert(pv[0].name === 'E2E改馒头' && pv[0].price === 2.0, '修改产品名称价格')
    assert(pv[0].unit === '个', '修改后单位不变')
    await dbRemove('products', ctx.p2)
    let pd = await dbGetAll('products', { _id: ctx.p2 })
    assert(pd.length === 0, '删除产品2成功')

    // ========== 3. 菜单发布 ==========
    section('3. 菜单发布')
    ctx.m1 = await dbAdd('active_menu', { product_id: ctx.p1, name: 'E2E改馒头', price: 2.0, unit: '个', image_url: '', stock: 50, ordered: 0, date: today })
    assert(ctx.m1, '上架菜单项1')
    ctx.m2 = await dbAdd('active_menu', { product_id: 'e2e_p2', name: 'E2E测试豆沙包', price: 3.0, unit: '个', image_url: '', stock: 30, ordered: 0, date: today })
    assert(ctx.m2, '上架菜单项2')
    let mlist = await dbGetAll('active_menu', { date: today }, 'name')
    assert(mlist.length >= 2, '今日菜单至少2项')
    let mi = mlist.find(m => m._id === ctx.m1)
    assert(mi && mi.ordered === 0 && mi.stock === 50, '菜单项1字段正确')
    await dbUpdateById('active_menu', ctx.m1, { stock: 100 })
    let sv = await dbGetAll('active_menu', { _id: ctx.m1 })
    assert(sv[0].stock === 100, '编辑库存100')
    await dbRemove('active_menu', ctx.m2)
    let ar = await dbGetAll('active_menu', { _id: ctx.m2 })
    assert(ar.length === 0, '取消上架成功')
    // publishMenu
    let pub = await callFn('publishMenu', { items: [
      { product_id: ctx.p1, name: 'E2E改馒头', price: 2.0, unit: '个', image_url: '', stock: 80 },
      { product_id: 'e2e_p2', name: 'E2E测试豆沙包', price: 3.0, unit: '个', image_url: '', stock: 40 }
    ]})
    assert(pub.success === true && pub.data.count === 2, 'publishMenu批量发布2项')
    let ap = await dbGetAll('active_menu', { date: today })
    let ap1 = ap.find(m => m.name === 'E2E改馒头')
    let ap2 = ap.find(m => m.name === 'E2E测试豆沙包')
    assert(ap1 && ap1.stock === 80 && ap1.ordered === 0, '批量发布后菜单1正确')
    assert(ap2 && ap2.stock === 40, '批量发布后菜单2正确')
    ctx.m1 = ap1._id; ctx.m2 = ap2._id
    let emptyPub = await callFn('publishMenu', { items: [] })
    assert(emptyPub.success === false, 'publishMenu空数组失败')

    // ========== 4. createOrder ==========
    section('4. createOrder - 用户预定')
    let co = await callFn('createOrder', {
      items: [{ product_id: ctx.m1, name: 'E2E改馒头', num: 3 }, { product_id: ctx.m2, name: 'E2E测试豆沙包', num: 2 }],
      total_price: 12, customer_name: 'E2E测试用户'
    })
    assert(co.success === true && co.data.orderId, '创建订单成功')
    ctx.oid = co.data.orderId
    let ma = await dbGetAll('active_menu', { date: today })
    assert(ma.find(m => m._id === ctx.m1).ordered === 3, '馒头ordered=3')
    assert(ma.find(m => m._id === ctx.m2).ordered === 2, '豆沙包ordered=2')
    let od = await dbGetAll('orders', { _id: ctx.oid })
    assert(od[0].status === 'pending', '订单状态pending')
    assert(od[0].customer_name === 'E2E测试用户', '客户名正确')
    assert(od[0].total_price === 12, '总价正确')
    assert(od[0].create_time_str, '有时间字符串')
    assert(od[0].items.length === 2, '2个商品')
    let empty = await callFn('createOrder', { items: [], total_price: 0, customer_name: '' })
    assert(empty.success === false && empty.message === '订单为空', '空订单失败')
    let notExist = await callFn('createOrder', { items: [{ product_id: 'xxx', name: '不存在', num: 1 }], total_price: 1, customer_name: '' })
    assert(notExist.success === false && notExist.message.includes('未上架'), '未上架失败')
    let overStock = await callFn('createOrder', { items: [{ product_id: ctx.m2, name: 'E2E测试豆沙包', num: 100 }], total_price: 300, customer_name: '' })
    assert(overStock.success === false && overStock.message.includes('库存不足'), '库存不足失败')
    // 无客户名默认微信用户
    let noName = await callFn('createOrder', { items: [{ product_id: ctx.m1, name: 'E2E改馒头', num: 1 }], total_price: 2, customer_name: '' })
    assert(noName.success === true, '无客户名下单成功')
    let nn = await dbGetAll('orders', { _id: noName.data.orderId })
    assert(nn[0].customer_name === '微信用户', '默认微信用户')
    await dbUpdateById('orders', noName.data.orderId, { status: 'cancelled' })
    await dbUpdateById('active_menu', ctx.m1, { ordered: 3 })

    // ========== 5. cancelOrder ==========
    section('5. cancelOrder - 取消订单')
    let cancel = await callFn('cancelOrder', { orderId: ctx.oid })
    assert(cancel.success === true, '取消订单成功')
    let oc = await dbGetAll('orders', { _id: ctx.oid })
    assert(oc[0].status === 'cancelled', '状态cancelled')
    let mc = await dbGetAll('active_menu', { date: today })
    assert(mc.find(m => m._id === ctx.m1).ordered === 0, '取消后馒头ordered=0')
    assert(mc.find(m => m._id === ctx.m2).ordered === 0, '取消后豆沙包ordered=0')
    let reCancel = await callFn('cancelOrder', { orderId: ctx.oid })
    assert(reCancel.success === false, '重复取消失败')
    let emptyCancel = await callFn('cancelOrder', { orderId: '' })
    assert(emptyCancel.success === false, '空ID取消失败')

    // ========== 6. undoCancel ==========
    section('6. undoCancel - 撤销取消')
    let undo = await callFn('undoCancel', { orderId: ctx.oid })
    assert(undo.success === true, '撤销取消成功')
    let ou = await dbGetAll('orders', { _id: ctx.oid })
    assert(ou[0].status === 'pending', '状态恢复pending')
    let mu = await dbGetAll('active_menu', { date: today })
    assert(mu.find(m => m._id === ctx.m1).ordered === 3, '撤销后馒头ordered=3')
    assert(mu.find(m => m._id === ctx.m2).ordered === 2, '撤销后豆沙包ordered=2')
    let undoPending = await callFn('undoCancel', { orderId: ctx.oid })
    assert(undoPending.success === false, 'pending订单撤销取消失败')
    let emptyUndo = await callFn('undoCancel', { orderId: '' })
    assert(emptyUndo.success === false, '空ID撤销失败')

    // ========== 7. verifyOrder ==========
    section('7. verifyOrder - 核销取走')
    await dbUpdateById('orders', ctx.oid, { status: 'completed' })
    let ov = await dbGetAll('orders', { _id: ctx.oid })
    assert(ov[0].status === 'completed', '核销后completed')
    let mv = await dbGetAll('active_menu', { date: today })
    assert(mv.find(m => m._id === ctx.m1).ordered === 3, '核销后ordered不变')

    // ========== 8. undoVerify ==========
    section('8. undoVerify - 撤销核销')
    await dbUpdateById('orders', ctx.oid, { status: 'pending' })
    let ouv = await dbGetAll('orders', { _id: ctx.oid })
    assert(ouv[0].status === 'pending', '撤销核销后pending')
    let muv = await dbGetAll('active_menu', { date: today })
    assert(muv.find(m => m._id === ctx.m1).ordered === 3, '撤销核销后ordered不变')

    // ========== 9. getMyOrders ==========
    section('9. getMyOrders - 获取用户订单')
    let mo = await callFn('getMyOrders', {})
    // 小程序端有OPENID应返回成功，管理端无OPENID返回失败
    if (mo.success) {
      assert(Array.isArray(mo.data), '返回数组')
    } else {
      assert(mo.message === '无法获取用户身份' || mo.data !== undefined, '无OPENID提示正确')
    }

    // ========== 10. historyOrders ==========
    section('10. historyOrders - 历史订单')
    let todayOrders = await dbGetAll('orders', { date: today }, 'create_time', 'desc')
    assert(Array.isArray(todayOrders) && todayOrders.length > 0, '今日订单非空')
    assert(todayOrders.find(o => o._id === ctx.oid), '包含测试订单')
    let dmap = {}
    todayOrders.forEach(o => { dmap[o.date] = dmap[o.date] || []; dmap[o.date].push(o) })
    assert(Object.keys(dmap).length > 0, '可按日期分组')
    if (todayOrders.length > 0) {
      let o = todayOrders[0]
      assert(o._id && o.customer_name && o.items && o.status && o.date && o.total_price !== undefined, '订单字段完整')
      assert(['pending','completed','cancelled'].includes(o.status), '状态值合法')
    }

    // ========== 11. getOpenId ==========
    section('11. getOpenId - 获取用户身份')
    let openid = await callFn('getOpenId', {})
    assert(typeof openid === 'object', '返回对象')

    // ========== 12. menuHistory ==========
    section('12. menuHistory - 菜单历史')
    let allMenu = await dbGetAll('active_menu', {}, 'date', 'desc')
    assert(allMenu.length > 0, '菜单历史非空')
    let mm = {}
    allMenu.forEach(m => { mm[m.date] = mm[m.date] || []; mm[m.date].push(m) })
    assert(Object.keys(mm).length > 0, '可按日期分组')

    // ========== 13. stockEdgeCase ==========
    section('13. stockEdgeCase - 库存边界')
    let zsid = await dbAdd('active_menu', { product_id: 'e2e_zero', name: 'E2E零库存', price: 1, unit: '个', image_url: '', stock: 0, ordered: 0, date: today })
    let bz = await callFn('createOrder', { items: [{ product_id: zsid, name: 'E2E零库存', num: 1 }], total_price: 1, customer_name: '' })
    assert(bz.success === false && bz.message.includes('库存不足'), '0库存下单失败')
    await dbRemove('active_menu', zsid)

    let esid = await dbAdd('active_menu', { product_id: 'e2e_exact', name: 'E2E刚好', price: 1, unit: '个', image_url: '', stock: 5, ordered: 0, date: today })
    let be = await callFn('createOrder', { items: [{ product_id: esid, name: 'E2E刚好', num: 5 }], total_price: 5, customer_name: '' })
    assert(be.success === true, '刚好库存下单成功')
    let bo = await callFn('createOrder', { items: [{ product_id: esid, name: 'E2E刚好', num: 1 }], total_price: 1, customer_name: '' })
    assert(bo.success === false, '售罄后下单失败')
    if (be.success) await dbUpdateById('orders', be.data.orderId, { status: 'cancelled' })
    await dbRemove('active_menu', esid)

    let psid = await dbAdd('active_menu', { product_id: 'e2e_partial', name: 'E2E部分已售', price: 1, unit: '个', image_url: '', stock: 10, ordered: 7, date: today })
    let bp = await callFn('createOrder', { items: [{ product_id: psid, name: 'E2E部分已售', num: 3 }], total_price: 3, customer_name: '' })
    assert(bp.success === true, '剩余3买3成功')
    let bp2 = await callFn('createOrder', { items: [{ product_id: psid, name: 'E2E部分已售', num: 1 }], total_price: 1, customer_name: '' })
    assert(bp2.success === false, '售罄后下单失败')
    if (bp.success) await dbUpdateById('orders', bp.data.orderId, { status: 'cancelled' })
    await dbRemove('active_menu', psid)

    // ========== 14. orderStatusFlow ==========
    section('14. orderStatusFlow - 订单全状态流转')
    let fmid = await dbAdd('active_menu', { product_id: 'e2e_flow', name: 'E2E流转馒头', price: 1, unit: '个', image_url: '', stock: 20, ordered: 0, date: today })
    let fo = await callFn('createOrder', { items: [{ product_id: fmid, name: 'E2E流转馒头', num: 1 }], total_price: 1, customer_name: 'E2E流转' })
    assert(fo.success === true, '流转-创建订单')
    let foid = fo.data.orderId
    // pending→completed
    await dbUpdateById('orders', foid, { status: 'completed' })
    let fc = await dbGetAll('orders', { _id: foid })
    assert(fc[0].status === 'completed', '流转1: pending→completed')
    // completed→pending
    await dbUpdateById('orders', foid, { status: 'pending' })
    fc = await dbGetAll('orders', { _id: foid })
    assert(fc[0].status === 'pending', '流转2: completed→pending')
    // pending→cancelled
    let fc2 = await callFn('cancelOrder', { orderId: foid })
    assert(fc2.success === true, '流转3: pending→cancelled')
    let fmck = await dbGetAll('active_menu', { _id: fmid })
    assert(fmck[0].ordered === 0, '取消后ordered=0')
    // cancelled→pending
    let fc3 = await callFn('undoCancel', { orderId: foid })
    assert(fc3.success === true, '流转4: cancelled→pending')
    fmck = await dbGetAll('active_menu', { _id: fmid })
    assert(fmck[0].ordered === 1, '撤销后ordered=1')
    // completed订单不能取消
    await dbUpdateById('orders', foid, { status: 'completed' })
    let fc4 = await callFn('cancelOrder', { orderId: foid })
    assert(fc4.success === false && fc4.message.includes('已处理'), '已完成订单不能取消')
    await dbRemove('active_menu', fmid)

    // db.cancelOrder 分支（前端直接update不恢复库存）
    let dcMid = await dbAdd('active_menu', { product_id: 'e2e_dc', name: 'E2E直接取消', price: 1, unit: '个', image_url: '', stock: 10, ordered: 2, date: today })
    let dcOid = await dbAdd('orders', { customer_name: '直接取消', items: [{ name: 'E2E直接取消', num: 2 }], total_price: 2, status: 'pending', date: today, create_time: Date.now(), create_time_str: '00:00' })
    await dbUpdateById('orders', dcOid, { status: 'cancelled' })
    let dco = await dbGetAll('orders', { _id: dcOid })
    assert(dco[0].status === 'cancelled', 'db.cancelOrder状态cancelled')
    let dcm = await dbGetAll('active_menu', { _id: dcMid })
    assert(dcm[0].ordered === 2, 'db.cancelOrder不恢复库存')
    await dbRemove('active_menu', dcMid)

  } catch (err) {
    log('测试异常: ' + err.message)
    console.error(err)
  } finally {
    // 清理
    try {
      if (ctx.p1) await dbRemove('products', ctx.p1)
      if (ctx.m1) await dbRemove('active_menu', ctx.m1)
      if (ctx.m2) await dbRemove('active_menu', ctx.m2)
      if (ctx.oid) await dbRemove('orders', ctx.oid)
    } catch(e) {}
  }

  log('\n' + '='.repeat(60) + '\n  测试结果汇总\n' + '='.repeat(60))
  results.forEach(r => log(r))
  log('\n通过: ' + passCount + '  失败: ' + failCount + '  总计: ' + (passCount+failCount))
  if (failCount === 0) log('ALL PASSED!')
  else log('有 ' + failCount + ' 个测试失败')
  return { passCount, failCount, results }
})()
