// utils/db.js - 数据库操作封装
const db = wx.cloud.database()
const _ = db.command

/**
 * 获取今天北京时间日期字符串 YYYY-MM-DD
 */
function getTodayBJDateStr() {
  const d = new Date()
  const bjTime = new Date(d.getTime() + 8 * 3600 * 1000)
  return `${bjTime.getFullYear()}-${String(bjTime.getMonth() + 1).padStart(2, '0')}-${String(bjTime.getDate()).padStart(2, '0')}`
}

/**
 * 获取今日订单（通过云函数，使用 menu_id 关联）- 使用北京时间
 */
function getTodayOrders(date) {
  const targetDate = date || getTodayBJDateStr()
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
 * 获取最近 N 天的订单
 */
async function getRecentOrders(days = 7, startDate, endDate) {
  return wx.cloud.callFunction({
    name: 'getRecentOrders',
    data: { days: days, startDate: startDate, endDate: endDate }
  }).then(res => {
    if (res.result && res.result.success) {
      return { data: res.result.data || [] }
    }
    return { data: [] }
  }).catch(() => {
    return { data: [] }
  })
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
 * 获取当前用户的订单（调用云函数）
 */
async function getMyOrders(date) {
  const todayStr = date || getTodayBJDateStr()
  return wx.cloud.callFunction({
    name: 'getMyOrders',
    data: { date: todayStr }
  })
    .then(res => {
      if (res.result && res.result.success) {
        return res.result.data || []
      }
      console.error('[getMyOrders] 云函数返回失败:', res.result)
      return []
    })
    .catch(err => {
      console.error('[getMyOrders] 调用失败:', err)
      return []
    })
}

/**
 * 根据日期获取订单历史
 */
async function getMenuHistory(date) {
  return db.collection('orders')
    .where({
      date: date
    })
    .orderBy('create_time', 'desc')
    .get()
    .then(res => res.data)
    .catch(() => [])
}

/**
 * 获取日期字符串
 */
function getDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 获取北京时间日期字符串
 */
function getBJDateStr(date) {
  const d = date ? new Date(date) : new Date()
  const bjTime = new Date(d.getTime() + 8 * 3600 * 1000)
  return `${bjTime.getFullYear()}-${String(bjTime.getMonth() + 1).padStart(2, '0')}-${String(bjTime.getDate()).padStart(2, '0')}`
}

/**
 * 获取指定日期的菜单（新结构：date + items 数组）
 * @param {string} date - 可选，默认为今天
 */
function getMenuByDate(date) {
  const targetDate = date || getTodayBJDateStr()
  return db.collection('active_menu')
    .where({ date: targetDate })
    .orderBy('publish_time', 'desc')
    .limit(1)
    .get()
    .then(async res => {
      if (res.data.length === 0) {
        return { data: [] }
      }
      const menu = res.data[0]
      const productIds = menu.items || []
      let productMap = {}
      if (productIds.length > 0) {
        const batchTimes = Math.ceil(productIds.length / 20)
        const tasks = []
        for (let i = 0; i < batchTimes; i++) {
          const ids = productIds.slice(i * 20, (i + 1) * 20)
          tasks.push(db.collection('products')
            .where({
              _id: _.in(ids)
            })
            .get())
        }
        const results = await Promise.all(tasks)
        results.forEach(r => {
          r.data.forEach(p => {
            productMap[p._id] = { name: p.name, price: p.price, unit: p.unit, image_url: p.image_url }
          })
        })
      }
      const list = (menu.items || []).map(pid => ({
        _id: pid,
        product_id: pid,
        stock: 50,
        ...productMap[pid],
        qty: 0
      }))
      return { data: list, menuInfo: { date: menu.date, publish_time: menu.publish_time } }
    })
}

/**
 * 获取最近发布的菜单（最新发布的日期，且 date >= 今天）
 * 关联 products 表获取产品完整信息
 */
function getLatestMenu() {
  return db.collection('active_menu')
    .orderBy('publish_time', 'desc')
    .limit(1)
    .get()
    .then(async res => {
      if (res.data.length > 0) {
        const menu = res.data[0]
        const productIds = menu.items || []
        let productMap = {}
        if (productIds.length > 0) {
          const batchTimes = Math.ceil(productIds.length / 20)
          const tasks = []
          for (let i = 0; i < batchTimes; i++) {
            const ids = productIds.slice(i * 20, (i + 1) * 20)
            tasks.push(db.collection('products')
              .where({
                _id: _.in(ids)
              })
              .get())
          }
          const results = await Promise.all(tasks)
          results.forEach(r => {
            r.data.forEach(p => {
              productMap[p._id] = { name: p.name, price: p.price, unit: p.unit, image_url: p.image_url }
            })
          })
        }

        const list = (menu.items || []).map(pid => ({
          _id: pid,
          product_id: pid,
          date: menu.date,
          stock: 50,
          ...productMap[pid],
          qty: 0
        }))

        return { data: list, menuInfo: { date: menu.date, publish_time: menu.publish_time } }
      }
      return { data: [] }
    })
}

/**
 * 隐藏订单（用户端删除，显示状态）
 */
function hideOrder(orderId) {
  return db.collection('orders').doc(orderId).update({
    data: { status: 'hidden' }
  })
}

/**
 * 删除订单（店长端真删除）
 */
function deleteOrder(orderId) {
  return db.collection('orders').doc(orderId).remove()
}

module.exports = {
  db,
  _,
  getMenuByDate,
  getLatestMenu,
  getAllProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getTodayOrders,
  getOrdersByDate,
  getRecentOrders,
  updateOrderStatus,
  cancelOrder,
  hideOrder,
  deleteOrder,
  getMyOrders,
  getMenuHistory,
  getDateStr,
  getBJDateStr,
  getTodayBJDateStr
}