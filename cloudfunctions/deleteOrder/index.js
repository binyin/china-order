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
    const deletedOrders = []

    for (const orderId of orderIds) {
      const orderDoc = await db.collection('orders').doc(orderId).get()
      const res = await db.collection('orders').doc(orderId).remove()
      if (res.deleted > 0) {
        deletedCount++
        if (orderDoc.data) {
          deletedOrders.push({ orderId, customer_id: orderDoc.data.customer_id, date: orderDoc.data.date })
        }
      }
    }

    for (const order of deletedOrders) {
      await db.collection('user_logs').add({ data: {
        user_id: order.customer_id,
        action: 'delete_order',
        result: 'success',
        details: { orderId: order.orderId, date: order.date },
        create_time: Date.now()
      }})
    }

    return { success: true, deletedCount }
  } catch (err) {
    try {
      await db.collection('user_logs').add({ data: {
        user_id: '',
        action: 'delete_order',
        result: 'failed',
        details: { error: err.message },
        create_time: Date.now()
      }})
    } catch (e) {}
    console.error('[deleteOrder] error:', err)
    return { success: false, message: '删除失败' }
  }
}