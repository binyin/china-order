// utils/db.js - 数据库操作封装
const db = wx.cloud.database()
const _ = db.command

/**
 * 获取今日菜单（active_menu）
 */
function getTodayMenu() {
  const today = getDateStr()
  return db.collection('active_menu')
    .where({ date: today })
    .orderBy('name', 'asc')
    .get()
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
 * 获取今日订单（只返回关联最新菜单的订单）
 */
async function getTodayOrders() {
  const today = getDateStr()
  
  // 先获取今日最新菜单的发布时间
  let latestPublishTime = 0
  try {
    const menuRes = await db.collection('active_menu')
      .where({ date: today })
      .orderBy('publish_time', 'desc')
      .limit(1)
      .get()
    
    if (menuRes.data.length > 0) {
      latestPublishTime = menuRes.data[0].publish_time || 0
    }
  } catch (e) {
    console.warn('获取最新菜单时间失败', e)
  }
  
  // 构建查询条件：今日订单，且菜单发布时间等于最新发布时间
  // 如果 latestPublishTime = 0，则表示没有发布菜单，不应该查询到订单
  const query = { date: today }
  if (latestPublishTime > 0) {
    query.menu_publish_time = latestPublishTime
  } else {
    // 如果没有发布菜单，不应该查询到订单
    query.menu_publish_time = 0
  }
  
  const countRes = await db.collection('orders').where(query).count()
  const total = countRes.total
  if (total === 0) return { data: [] }
  
  const batchTimes = Math.ceil(total / 20)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(db.collection('orders')
      .where(query)
      .orderBy('create_time', 'asc')
      .skip(i * 20)
      .limit(20)
      .get())
  }
  
  const results = await Promise.all(tasks)
  return { data: results.reduce((acc, res) => acc.concat(res.data), []) }
}

/**
 * 获取历史订单（按日期，只返回关联最新菜单的订单）
 */
async function getOrdersByDate(date) {
  // 先获取该日期最新菜单的发布时间
  let latestPublishTime = 0
  try {
    const menuRes = await db.collection('active_menu')
      .where({ date: date })
      .orderBy('publish_time', 'desc')
      .limit(1)
      .get()
    
    if (menuRes.data.length > 0) {
      latestPublishTime = menuRes.data[0].publish_time || 0
    }
  } catch (e) {
    console.warn('获取最新菜单时间失败', e)
  }
  
  // 构建查询条件
  let query = { date: date }
  if (latestPublishTime > 0) {
    query.menu_publish_time = latestPublishTime
  }
  
  const countRes = await db.collection('orders').where(query).count()
  const total = countRes.total
  if (total === 0) return { data: [] }
  
  const batchTimes = Math.ceil(total / 20)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(db.collection('orders')
      .where(query)
      .orderBy('create_time', 'desc')
      .skip(i * 20)
      .limit(20)
      .get())
  }
  
  const results = await Promise.all(tasks)
  return { data: results.reduce((acc, res) => acc.concat(res.data), []) }
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
  
  // 为每个日期获取最新菜单时间
  const dateTimePromises = dates.map(date => 
    db.collection('active_menu')
      .where({ date: date })
      .orderBy('publish_time', 'desc')
      .limit(1)
      .get()
      .then(res => ({
        date,
        latestTime: res.data.length > 0 ? (res.data[0].publish_time || 0) : 0
      }))
      .catch(() => ({
        date,
        latestTime: 0
      }))
  )
  
  const dateTimeResults = await Promise.all(dateTimePromises)
  const dateTimeMap = {}
  dateTimeResults.forEach(result => {
    dateTimeMap[result.date] = result.latestTime
  })
  
  // 构建查询条件
  const orderPromises = dates.map(date => {
    const latestTime = dateTimeMap[date]
    if (latestTime === 0) {
      return Promise.resolve([])
    }
    
    return db.collection('orders')
      .where({
        date: date,
        menu_publish_time: latestTime
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
 * 获取日期字符串 YYYY-MM-DD
 */
function getDateStr(date) {
  const d = date || new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

module.exports = {
  db,
  _,
  getTodayMenu,
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
  getDateStr
}
