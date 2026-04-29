const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { date } = event
  
  if (!OPENID) {
    return { success: false, data: [], message: '无法获取用户身份' }
  }
  
  const targetDate = date || getBJDateStr()
  console.log('[getUserTodayOrder] date:', targetDate, 'OPENID:', OPENID)
  
  try {
    const orderRes = await db.collection('orders')
      .where({
        customer_id: OPENID,
        date: targetDate
      })
      .orderBy('create_time', 'desc')
      .get()
    
    let orders = (orderRes.data || []).filter(o => o.status !== 'hidden')
    
    if (orders.length > 0) {
      const openids = [...new Set(orders.map(o => o.customer_id).filter(Boolean))]
      
      if (openids.length > 0) {
        const userRes = await db.collection('users')
          .where({ _id: _.in(openids) })
          .get()
        
        const userMap = {}
        userRes.data.forEach(u => {
          userMap[u._id] = u
        })
        
        orders = orders.map(o => {
          if (userMap[o.customer_id]) {
            if (!o.customer_nickname) {
              o.customer_nickname = userMap[o.customer_id].nickname || ''
            }
            if (!o.customer_avatar) {
              o.customer_avatar = userMap[o.customer_id].avatarUrl || ''
            }
          }
          return o
        })
      }
    }
    
    console.log('[getUserTodayOrder] 找到订单:', orders.length)
    return { success: true, data: orders }
  } catch (err) {
    console.error('[getUserTodayOrder] error:', err)
    return { success: false, data: [], message: err.message }
  }
}

function getBJDateStr() {
  const d = new Date()
  const bjTime = new Date(d.getTime() + 8 * 3600 * 1000)
  return `${bjTime.getFullYear()}-${String(bjTime.getMonth() + 1).padStart(2, '0')}-${String(bjTime.getDate()).padStart(2, '0')}`
}