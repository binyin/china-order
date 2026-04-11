// 云函数：获取当前用户的订单
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const MAX_LIMIT = 100

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { success: false, data: [], message: '无法获取用户身份' }
  }

  try {
    // 先获取总数
    const countRes = await db.collection('orders')
      .where({ customer_id: OPENID })
      .count()

    const total = countRes.total
    if (total === 0) {
      return { success: true, data: [] }
    }

    // 分批获取所有数据
    const batchTimes = Math.ceil(total / MAX_LIMIT)
    const tasks = []
    for (let i = 0; i < batchTimes; i++) {
      const promise = db.collection('orders')
        .where({ customer_id: OPENID })
        .orderBy('date', 'desc')
        .orderBy('create_time', 'desc')
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .get()
      tasks.push(promise)
    }

    const results = await Promise.all(tasks)
    const data = results.reduce((acc, res) => acc.concat(res.data), [])

    return { success: true, data }
  } catch (err) {
    console.error('获取用户订单失败', err)
    return { success: false, data: [] }
  }
}
