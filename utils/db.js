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
 * 获取今日订单（分页获取全部）
 */
async function getTodayOrders() {
  const today = getDateStr()
  const countRes = await db.collection('orders').where({ date: today }).count()
  const total = countRes.total
  if (total === 0) return { data: [] }
  const batchTimes = Math.ceil(total / 20)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(db.collection('orders')
      .where({ date: today })
      .orderBy('create_time', 'asc')
      .skip(i * 20)
      .limit(20)
      .get())
  }
  const results = await Promise.all(tasks)
  return { data: results.reduce((acc, res) => acc.concat(res.data), []) }
}

/**
 * 获取历史订单（按日期，分页获取全部）
 */
async function getOrdersByDate(date) {
  const countRes = await db.collection('orders').where({ date: date }).count()
  const total = countRes.total
  if (total === 0) return { data: [] }
  const batchTimes = Math.ceil(total / 20)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(db.collection('orders')
      .where({ date: date })
      .orderBy('create_time', 'desc')
      .skip(i * 20)
      .limit(20)
      .get())
  }
  const results = await Promise.all(tasks)
  return { data: results.reduce((acc, res) => acc.concat(res.data), []) }
}

/**
 * 获取最近 N 天的订单（分页获取全部）
 */
async function getRecentOrders(days) {
  const d = new Date()
  d.setDate(d.getDate() - (days || 30))
  const startDate = getDateStr(d)
  const countRes = await db.collection('orders').where({ date: _.gte(startDate) }).count()
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
  return { data: results.reduce((acc, res) => acc.concat(res.data), []) }
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
