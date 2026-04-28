const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const MAX_LIMIT = 100

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { success: false, data: [], message: '无法获取用户身份' }
  }

  const days = event.days || 90
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`

  console.log('[getUserOrderHistory] days:', days, 'startDate:', startDateStr, 'OPENID:', OPENID)

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

    const orders = (orderRes.data || []).filter(o => o.status !== 'hidden')

    console.log('[getUserOrderHistory] 找到订单:', orders.length, `(最近${days}天)`)
    return { success: true, data: orders }
  } catch (err) {
    console.error('[getUserOrderHistory] error:', err)
    return { success: false, data: [], message: err.message }
  }
}