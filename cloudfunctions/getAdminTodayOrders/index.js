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
    orders = orders.filter(o => o.status !== 'hidden')

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