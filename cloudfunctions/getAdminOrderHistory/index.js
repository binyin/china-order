const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { days = 30, startDate, endDate, customerId } = event

  try {
    let queryDateStart, queryDateEnd

    if (startDate && endDate) {
      queryDateStart = startDate
      queryDateEnd = endDate
    } else {
      const now = new Date()
      const bjTime = new Date(now.getTime() + 8 * 3600 * 1000)
      queryDateEnd = getDateStr(bjTime)
      const startTime = new Date(bjTime.getTime() - days * 24 * 60 * 60 * 1000)
      queryDateStart = getDateStr(startTime)
    }

    const whereCondition = {
      date: _.gte(queryDateStart).lte(queryDateEnd)
    }

    if (customerId) {
      whereCondition.customer_id = customerId
    }

    console.log('[getAdminOrderHistory] 查询条件:', JSON.stringify(whereCondition))

    const orderRes = await db.collection('orders')
      .where(whereCondition)
      .orderBy('date', 'desc')
      .orderBy('create_time', 'desc')
      .limit(500)
      .get()

    let orders = orderRes.data || []
    orders = orders.filter(o => o.status !== 'hidden' && o.status !== 'cancelled')

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
          if (!o.customer_avatar && userMap[o.customer_id]) {
            o.customer_avatar = userMap[o.customer_id].avatarUrl || ''
          }
          return o
        })
      }
    }

    orders.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date)
      }
      return b.create_time - a.create_time
    })

    console.log('[getAdminOrderHistory] 找到订单:', orders.length)
    return { success: true, data: orders }
  } catch (error) {
    console.error('[getAdminOrderHistory] error:', error)
    return { success: false, message: '查询失败', error: error.message }
  }
}

function getDateStr(date = new Date()) {
  const d = date || new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}