const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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

    const orders = (orderRes.data || []).filter(o => o.status !== 'hidden')

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