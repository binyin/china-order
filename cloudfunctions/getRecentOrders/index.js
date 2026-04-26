const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { days = 30, startDate, endDate } = event
  
  try {
    let queryDateStart, queryDateEnd
    
    if (startDate && endDate) {
      // 自定义日期范围
      queryDateStart = startDate
      queryDateEnd = endDate
    } else {
      const now = new Date()
      const bjTime = new Date(now.getTime() + 8 * 3600 * 1000)
      queryDateEnd = getDateStr(bjTime)
      const startTime = new Date(bjTime.getTime() - days * 24 * 60 * 60 * 1000)
      queryDateStart = getDateStr(startTime)
    }
    
    // 直接查询日期范围内的所有订单（管理员看得到全部订单，包括hidden）
    const orderRes = await db.collection('orders')
      .where({
        date: _.gte(queryDateStart).lte(queryDateEnd)
      })
      .orderBy('date', 'desc')
      .orderBy('create_time', 'desc')
      .limit(500)  // 限制最多返回500条
      .get()
    
    let allOrders = orderRes.data || []
    
    // 5. 关联 users 表获取头像
    if (allOrders.length > 0) {
      const openids = [...new Set(allOrders.map(o => o.customer_id).filter(Boolean))]
      if (openids.length > 0) {
        const userRes = await db.collection('users')
          .where({
            _id: _.in(openids)
          })
          .get()
        
        const userMap = {}
        userRes.data.forEach(u => {
          userMap[u._id] = u
        })
        
        allOrders = allOrders.map(o => {
          if (!o.customer_avatar && userMap[o.customer_id]) {
            o.customer_avatar = userMap[o.customer_id].avatarUrl || ''
          }
          return o
        })
      }
    }
    
    // 按日期倒序排列
    allOrders.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date)
      }
      return b.create_time - a.create_time
    })
    
    return { success: true, data: allOrders }
    
  } catch (error) {
    console.error('getRecentOrders云函数执行失败:', error)
    return { success: false, message: '查询失败', error: error.message }
  }
}

function getDateStr(date = new Date()) {
  const d = date || new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
