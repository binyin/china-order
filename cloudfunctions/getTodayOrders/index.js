const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { date } = event
  
  const today = date || getBJDateStr()
  console.log('[getTodayOrders] date:', today)
  
try {
    const ordersRes = await db.collection('orders')
      .where({ date: today })
      .orderBy('create_time', 'asc')
      .get()
    
    let orders = ordersRes.data
    // 过滤hidden状态(用户删除的订单不显示)
    orders = orders.filter(o => o.status !== 'hidden')
    let userData = []
    
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
        userData = userRes.data
        
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
      data: orders,
      users: userData
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