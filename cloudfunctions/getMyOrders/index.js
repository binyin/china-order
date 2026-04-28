// 云函数：获取当前用户的订单
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const MAX_LIMIT = 100

function getTodayBJDate() {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { success: false, data: [], message: '无法获取用户身份' }
  }

  const dateParam = event.date
  const days = event.days || 90
  const filterByDate = dateParam ? true : false
  const targetDate = dateParam || getTodayBJDate()
  
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
  
  console.log('[getMyOrders] dateParam:', dateParam, 'days:', days, 'startDate:', startDateStr, 'OPENID:', OPENID)

  try {
    const orderRes = await db.collection('orders')
      .where({ 
        customer_id: OPENID,
        date: _.gte(startDateStr)
      })
      .orderBy('date', 'desc')
      .orderBy('create_time', 'desc')
      .limit(MAX_LIMIT)
      .get()
    
    let allData = orderRes.data || []
    
    allData = allData.filter(o => o.status !== 'hidden')
    
    if (filterByDate) {
      allData = allData.filter(o => o.date === targetDate)
    }
    
    console.log('[getMyOrders] 找到订单:', allData.length, filterByDate ? `(日期${targetDate})` : `(最近${days}天)`)
    return { success: true, data: allData }
  } catch (err) {
    console.error('[getMyOrders] error:', err)
    return { success: false, data: [], message: err.message }
  }
}
