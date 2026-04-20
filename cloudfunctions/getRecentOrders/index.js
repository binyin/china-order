// 云函数：获取最近N天的订单（优化版本）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { days = 30 } = event
  
  try {
    // 计算开始日期
    const startDate = getDateStr(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
    
    // 1. 获取日期范围内的所有日期（有订单的日期）
    const dateRes = await db.collection('orders')
      .where({
        date: db.command.gte(startDate)
      })
      .field({
        date: true
      })
      .orderBy('date', 'desc')
      .get()
    
    // 提取不重复的日期
    const dateSet = new Set()
    dateRes.data.forEach(order => dateSet.add(order.date))
    const dates = Array.from(dateSet)
    
    if (dates.length === 0) {
      return { success: true, data: [] }
    }
    
    // 2. 批量获取每个日期的最新菜单的 menu_id
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
    
    // 3. 为每个日期查询对应最新菜单的订单
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
    
    // 4. 合并所有订单并按日期排序
    let allOrders = orderResults.reduce((acc, orders) => acc.concat(orders), [])
    
    // 5. 关联 users 表获取头像
    if (allOrders.length > 0) {
      const openids = [...new Set(allOrders.map(o => o.customer_id).filter(Boolean))]
      if (openids.length > 0) {
        const userRes = await db.collection('users')
          .where({
            _id: db.command.in(openids)
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
