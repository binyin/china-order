const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { date } = event
  
  const today = date || getBJDateStr()
  console.log('[getTodayOrders] date:', today)
  
  try {
    // 获取今日最新菜单的 menu_id
    let latestMenuId = null
    const menuRes = await db.collection('active_menu')
      .where({ date: today })
      .orderBy('publish_time', 'desc')
      .limit(1)
      .get()
    
    console.log('[getTodayOrders] menuRes:', menuRes.data.length)
    
    if (menuRes.data.length > 0) {
      latestMenuId = menuRes.data[0].menu_id
    }
    
    // 如果没有发布菜单，返回空
    if (!latestMenuId) {
      return { success: true, data: [], message: '今日未发布菜单' }
    }
    
    // 使用 menu_id 查询订单
    const ordersRes = await db.collection('orders')
      .where({
        date: today,
        menu_id: latestMenuId
      })
      .orderBy('create_time', 'asc')
      .get()
    
    console.log('[getTodayOrders] ordersRes:', ordersRes.data.length)
    
    let orders = ordersRes.data
    
    // 关联 users 表获取头像
    if (orders.length > 0) {
      const openids = [...new Set(orders.map(o => o.customer_id).filter(Boolean))]
      console.log('[getTodayOrders] openids:', openids)
      
      if (openids.length > 0) {
        const userRes = await db.collection('users')
          .where({
            _id: _.in(openids)
          })
          .get()
        
        console.log('[getTodayOrders] userRes:', userRes.data.length)
        
        const userMap = {}
        userRes.data.forEach(u => {
          userMap[u._id] = u
        })
        
        orders = orders.map(o => {
          if (userMap[o.customer_id]) {
            if (!o.customer_avatar) {
              o.customer_avatar = userMap[o.customer_id].avatarUrl || ''
            }
            if (!o.customer_nickname) {
              o.customer_nickname = userMap[o.customer_id].nickname || ''
            }
          }
          return o
        })
      }
    }
    
    return {
      success: true,
      data: orders
    }
  } catch (err) {
    console.error('获取今日订单失败', err)
    return { success: false, message: '获取失败' }
  }
}

function getBJDateStr() {
  const d = new Date()
  const bjTime = new Date(d.getTime() + 8 * 3600 * 1000)
  return `${bjTime.getFullYear()}-${String(bjTime.getMonth() + 1).padStart(2, '0')}-${String(bjTime.getDate()).padStart(2, '0')}`
}
