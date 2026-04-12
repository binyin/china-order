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
 */
async function getRecentOrders(days) {
  const d = new Date()
  d.setDate(d.getDate() - (days || 30))
  const startDate = getDateStr(d)
  
  // 由于跨日期查询，无法在数据库层面过滤menu_publish_time
  // 先获取所有订单，然后在内存中过滤
  const countRes = await db.collection('orders')
    .where({ date: _.gte(startDate) })
    .count()
  
  const total = countRes.total
  if (total === 0) return { data: [] }
  
  const batchTimes = Math.ceil(total / 20)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(db.collection('orders')
      .where({ date: _.gte(startDate) })
      .orderBy('date', 'desc')
      .skip(i * 20)
      .limit(20)
      .get())
  }
  
  const results = await Promise.all(tasks)
  const allOrders = results.reduce((acc, res) => acc.concat(res.data), [])
  
  // 按日期分组，获取每个日期的最新菜单时间
  const dateGroups = {}
  allOrders.forEach(order => {
    if (!dateGroups[order.date]) {
      dateGroups[order.date] = []
    }
    dateGroups[order.date].push(order)
  })
  
  // 获取每个日期的最新菜单时间
  const datePromises = Object.keys(dateGroups).map(date => 
    db.collection('active_menu')
      .where({ date: date })
      .orderBy('publish_time', 'desc')
      .limit(1)
      .get()
  )
  
  const menuTimesRes = await Promise.all(datePromises)
  const latestTimes = {}
  
  menuTimesRes.forEach((res, index) => {
    const date = Object.keys(dateGroups)[index]
    if (res.data.length > 0) {
      latestTimes[date] = res.data[0].publish_time || 0
    } else {
      latestTimes[date] = 0
    }
  })
  
  // 过滤订单，只保留关联最新菜单的
  const filteredOrders = allOrders.filter(order => {
    const latestTime = latestTimes[order.date] || 0
    return order.menu_publish_time === latestTime
  })
  
  return { data: filteredOrders }
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
