// utils/db.js - 数据库操作封装
const db = wx.cloud.database()
const _ = db.command

function getTodayBJDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDateStr(date) {
  const d = date ? new Date(date) : new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getBJDateStr(date) {
  const d = date ? new Date(date) : new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
          tasks.push(db.collection('products').where({ _id: _.in(ids) }).get())
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

async function getAllProducts() {
  const countRes = await db.collection('products').count()
  const total = countRes.total
  if (total === 0) return { data: [] }
  const batchTimes = Math.ceil(total / 20)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(db.collection('products').orderBy('name', 'asc').skip(i * 20).limit(20).get())
  }
  const results = await Promise.all(tasks)
  return { data: results.reduce((acc, res) => acc.concat(res.data), []) }
}

function addProduct(data) {
  return db.collection('products').add({ data })
}

function updateProduct(id, data) {
  return db.collection('products').doc(id).update({ data })
}

function deleteProduct(id) {
  return db.collection('products').doc(id).remove()
}

function getUserTodayOrder(date) {
  const targetDate = date || getTodayBJDateStr()
  return wx.cloud.callFunction({
    name: 'getUserTodayOrder',
    data: { date: targetDate }
  }).then(res => {
    if (res.result && res.result.success) {
      return { data: res.result.data || [] }
    }
    return { data: [] }
  })
}

function getUserOrderHistory(days = 90) {
  return wx.cloud.callFunction({
    name: 'getUserOrderHistory',
    data: { days: days }
  }).then(res => {
    if (res.result && res.result.success) {
      return { data: res.result.data || [] }
    }
    return { data: [] }
  })
}

function getAdminTodayOrders(date) {
  const targetDate = date || getTodayBJDateStr()
  return wx.cloud.callFunction({
    name: 'getAdminTodayOrders',
    data: { date: targetDate }
  }).then(res => {
    if (res.result && res.result.success) {
      return { data: res.result.data || [] }
    }
    return { data: [] }
  })
}

function getAdminOrderHistory(days = 30, startDate, endDate, customerId) {
  return wx.cloud.callFunction({
    name: 'getAdminOrderHistory',
    data: { days: days, startDate: startDate, endDate: endDate, customerId: customerId }
  }).then(res => {
    if (res.result && res.result.success) {
      return { data: res.result.data || [] }
    }
    return { data: [] }
  })
}

function updateOrderStatus(id, status) {
  return db.collection('orders').doc(id).update({ data: { status } })
}

function cancelOrder(id) {
  return db.collection('orders').doc(id).update({ data: { status: 'cancelled' } })
}

function deleteOrder(orderId) {
  return db.collection('orders').doc(orderId).remove()
}

function getOrdersByDate(date) {
  return wx.cloud.callFunction({
    name: 'getAdminTodayOrders',
    data: { date: date }
  }).then(res => {
    if (res.result && res.result.success) {
      return { data: res.result.data || [] }
    }
    return { data: [] }
  }).catch(() => ({ data: [] }))
}

module.exports = {
  db,
  _,
  getMenuByDate,
  getAllProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getUserTodayOrder,
  getUserOrderHistory,
  getAdminTodayOrders,
  getAdminOrderHistory,
  getOrdersByDate,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  getDateStr,
  getBJDateStr,
  getTodayBJDateStr
}