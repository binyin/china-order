const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { date } = event
  const targetDate = date || getBJDateStr()
  console.log('[getAdminTodayOrders] date:', targetDate)

  try {
    const ordersRes = await db.collection('orders')
      .where({ date: targetDate })
      .orderBy('create_time', 'asc')
      .get()

    let orders = ordersRes.data
    orders = orders.filter(o => o.status !== 'hidden' && o.status !== 'cancelled')
    
    console.log('[getAdminTodayOrders] 过滤后订单数:', orders.length)
    
    if (orders.length > 0) {
      const openids = [...new Set(orders.map(o => o.customer_id).filter(Boolean))]
      console.log('[getAdminTodayOrders] 需要查询的用户ID:', openids.length)
      
      if (openids.length > 0) {
        const userRes = await db.collection('users')
          .where({ _id: _.in(openids) })
          .get()
        
        console.log('[getAdminTodayOrders] 找到用户记录:', userRes.data.length)
        
        const userMap = {}
        userRes.data.forEach(u => {
          userMap[u._id] = u
        })
        
        orders = orders.map(o => {
          if (userMap[o.customer_id]) {
            if (!o.customer_avatar) {
              o.customer_avatar = userMap[o.customer_id].avatarUrl || ''
              console.log('[getAdminTodayOrders] 补全头像:', o._id)
            }
            if (!o.customer_nickname) {
              o.customer_nickname = userMap[o.customer_id].nickname || ''
              console.log('[getAdminTodayOrders] 补全昵称:', o._id, o.customer_nickname)
            }
          }
          return o
        })
      }
    }
    
    console.log('[getAdminTodayOrders] 最终订单数:', orders.length, '示例订单:', orders.length > 0 ? {
      id: orders[0]._id,
      status: orders[0].status,
      customer_nickname: orders[0].customer_nickname || '(空)',
      customer_name: orders[0].customer_name || '(空)'
    } : '无')
    
    return { success: true, data: orders }
  } catch (err) {
    console.error('[getAdminTodayOrders] error:', err)
    return { success: false, message: '获取失败' }
  }
}

function getBJDateStr() {
  const d = new Date()
  const bjTime = new Date(d.getTime() + 8 * 3600 * 1000)
  return `${bjTime.getFullYear()}-${String(bjTime.getMonth() + 1).padStart(2, '0')}-${String(bjTime.getDate()).padStart(2, '0')}`
}