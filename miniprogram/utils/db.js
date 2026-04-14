// utils/db.js - 数据库操作封装
const db = wx.cloud.database()
const _ = db.command

/**
 * 获取今日菜单（active_menu）- 返回明天的菜单
 * 业务场景：老板提前一天发布明天要销售的品种
 */
function getTodayMenu() {
  const tomorrow = getTomorrowBJDateStr()
  return db.collection('active_menu')
    .where({ date: tomorrow })
    .orderBy('publish_time', 'desc')
    .get()
}

/**
 * 获取指定日期的菜单
 * @param {string} date - 可选，不传则返回明天的菜单（用户端用）
 */
function getMenuByDate(date) {
  const targetDate = date || getTomorrowBJDateStr()
  return db.collection('active_menu')
    .where({ date: targetDate })
    .orderBy('publish_time', 'desc')
    .get()
}

/**
 * 获取今日订单（通过云函数，使用 menu_id 关联）- 使用北京时间
 */
function getTodayOrders(date) {
  const targetDate = date || getTomorrowBJDateStr()
  return wx.cloud.callFunction({
    name: 'getTodayOrders',
    data: { date: targetDate }
  }).then(res => {
    if (res.result && res.result.success) {
      return { data: res.result.data || [] }
    }
    return { data: [] }
  })
}

/**
 * 获取所有产品模板（分页获取全部）
 */
async function getAllProducts() {
  const countRes = await db.collection('products').count()
  const total = countRes.total
  if (total === 0) return { data: [] }
  const batchTimes = Math.ceil(total / 20)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(db.collection('products')
      .orderBy('name', 'asc')
      .skip(i * 20)
      .limit(20)
      .get())
  }
  const results = await Promise.all(tasks)
  return { data: results.reduce((acc, res) => acc.concat(res.data), []) }
}

/**
 * 新增产品模板
 */
function addProduct(data) {
  return db.collection('products').add({ data })
}

/**
 * 更新产品模板
 */
function updateProduct(id, data) {
  return db.collection('products').doc(id).update({ data })
}

/**
 * 删除产品模板
 */
function deleteProduct(id) {
  return db.collection('products').doc(id).remove()
}

/**
 * 向今日菜单新增单个产品
 */
function addMenuItem(item) {
  const today = getDateStr()
  return db.collection('active_menu').add({
    data: {
      product_id: item.product_id || item._id,
      name: item.name,
      price: item.price,
      unit: item.unit || '个',
      image_url: item.image_url || '',
      stock: item.stock || 50,
      ordered: 0,
      date: today
    }
  })
}

/**
 * 从今日菜单删除单个产品
 */
function removeMenuItem(id) {
  return db.collection('active_menu').doc(id).remove()
}

/**
 * 更新今日菜单产品的库存
 */
function updateMenuStock(id, stock) {
  return db.collection('active_menu').doc(id).update({
    data: { stock }
  })
}

/**
 * 获取历史订单（按日期，使用 menu_id 关联）
 */
async function getOrdersByDate(date) {
  try {
    const result = await wx.cloud.callFunction({
      name: 'getTodayOrders',
      data: { date: date }
    })
    
    if (result.result && result.result.success) {
      return { data: result.result.data || [] }
    }
    return { data: [] }
  } catch (e) {
    console.warn('获取历史订单失败', e)
    return { data: [] }
  }
}

/**
 * 获取最近 N 天的订单（只返回关联最新菜单的订单）
 * 进一步优化：使用云函数批量处理，减少客户端数据库查询压力
 */
async function getRecentOrders(days) {
  try {
    // 调用云函数来处理复杂的查询逻辑
    const result = await wx.cloud.callFunction({
      name: 'getRecentOrders',
      data: { days: days || 30 }
    })
    
    if (result.result && result.result.success) {
      return { data: result.result.data || [] }
    }
    return { data: [] }
  } catch (error) {
    console.error('调用getRecentOrders云函数失败，使用降级方案:', error)
    // 降级方案：使用原逻辑但限制查询天数
    return await getRecentOrdersFallback(Math.min(days || 30, 7))
  }
}

/**
 * 降级方案：客户端查询，但限制为最近7天以减少性能影响
 */
async function getRecentOrdersFallback(days) {
  const d = new Date()
  d.setDate(d.getDate() - (days || 7))
  const startDate = getDateStr(d)
  
  // 获取有订单的日期列表
  const dateRes = await db.collection('orders')
    .where({ date: _.gte(startDate) })
    .field({ date: true })
    .orderBy('date', 'desc')
    .get()
  
  // 提取不重复的日期
  const dateSet = new Set()
  dateRes.data.forEach(order => dateSet.add(order.date))
  const dates = Array.from(dateSet)
  
  if (dates.length === 0) {
    return { data: [] }
  }
  
  // 为每个日期获取最新菜单的 menu_id
  const dateMenuPromises = dates.map(date => 
    db.collection('active_menu')
      .where({ date: date })
      .orderBy('publish_time', 'desc')
      .limit(1)
      .get()
      .then(res => ({
        date,
        menuId: res.data.length > 0 ? (res.data[0].menu_id || null) : null
      }))
      .catch(() => ({
        date,
        menuId: null
      }))
  )
  
  const dateMenuResults = await Promise.all(dateMenuPromises)
  const dateMenuMap = {}
  dateMenuResults.forEach(result => {
    dateMenuMap[result.date] = result.menuId
  })
  
  // 构建查询条件
  const orderPromises = dates.map(date => {
    const menuId = dateMenuMap[date]
    if (!menuId) {
      return Promise.resolve([])
    }
    
    return db.collection('orders')
      .where({
        date: date,
        menu_id: menuId
      })
      .orderBy('create_time', 'desc')
      .get()
      .then(res => res.data)
      .catch(() => [])
  })
  
  const orderResults = await Promise.all(orderPromises)
  const allOrders = orderResults.reduce((acc, orders) => acc.concat(orders), [])
  
  return { data: allOrders }
}

/**
 * 更新订单状态
 */
function updateOrderStatus(id, status) {
  return db.collection('orders').doc(id).update({
    data: { status }
  })
}

/**
 * 取消订单（用户端）
 */
function cancelOrder(id) {
  return db.collection('orders').doc(id).update({
    data: { status: 'cancelled' }
  })
}

/**
 * 获取当前用户的订单（通过云函数获取OPENID）
 */
function getMyOrders() {
  return wx.cloud.callFunction({
    name: 'getMyOrders'
  }).then(res => {
    if (res.result && res.result.success) {
      return { data: res.result.data }
    }
    return { data: [] }
  })
}

/**
 * 获取历史发布过的菜单（分页获取全部）
 */
async function getMenuHistory() {
  const countRes = await db.collection('active_menu').count()
  const total = countRes.total
  if (total === 0) return { data: [] }
  const batchTimes = Math.ceil(total / 20)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(db.collection('active_menu')
      .orderBy('date', 'desc')
      .skip(i * 20)
      .limit(20)
      .get())
  }
  const results = await Promise.all(tasks)
  return { data: results.reduce((acc, res) => acc.concat(res.data), []) }
}

/**
 * 获取日期字符串 YYYY-MM-DD（本地时区）
 */
function getDateStr(date) {
  const d = date || new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 获取北京时间日期字符串 YYYY-MM-DD
 */
function getBJDateStr(date) {
  const d = date || new Date()
  const bjTime = new Date(d.getTime() + 8 * 3600 * 1000)
  return `${bjTime.getFullYear()}-${String(bjTime.getMonth() + 1).padStart(2, '0')}-${String(bjTime.getDate()).padStart(2, '0')}`
}

/**
 * 获取明天北京时间日期字符串 YYYY-MM-DD
 */
function getTomorrowBJDateStr() {
  const d = new Date()
  const bjTime = new Date(d.getTime() + 8 * 3600 * 1000)
  bjTime.setDate(bjTime.getDate() + 1)
  return `${bjTime.getFullYear()}-${String(bjTime.getMonth() + 1).padStart(2, '0')}-${String(bjTime.getDate()).padStart(2, '0')}`
}

module.exports = {
  db,
  _,
  getTodayMenu,
  getMenuByDate,
  getAllProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  addMenuItem,
  removeMenuItem,
  updateMenuStock,
  getTodayOrders,
  getOrdersByDate,
  getRecentOrders,
  updateOrderStatus,
  cancelOrder,
  getMyOrders,
  getMenuHistory,
  getDateStr,
  getBJDateStr,
  getTomorrowBJDateStr
}
