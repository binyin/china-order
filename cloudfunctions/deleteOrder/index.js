const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { orderIds } = event

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return { success: false, message: '订单ID列表不能为空' }
  }

  try {
    let deletedCount = 0

    for (const orderId of orderIds) {
      const res = await db.collection('orders').doc(orderId).remove()
      if (res.deleted > 0) {
        deletedCount++
      }
    }

    return { success: true, deletedCount }
  } catch (err) {
    console.error('[deleteOrder] error:', err)
    return { success: false, message: '删除失败' }
  }
}