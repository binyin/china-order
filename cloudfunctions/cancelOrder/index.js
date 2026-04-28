const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { orderId } = event

  if (!orderId) {
    return { success: false, message: '订单ID不能为空' }
  }

try {
    const orderRes = await db.collection('orders').doc(orderId).get()
    const order = orderRes.data

    if (!order || order.status !== 'pending') {
      return { success: false, message: '订单不存在或已处理' }
    }

    await db.collection('orders').doc(orderId).update({
      data: { 
        status: 'cancelled',
        items: order.items.map(item => ({
          ...item,
          item_status: 'cancelled'
        }))
      }
    })

    await db.collection('user_logs').add({ data: {
      user_id: order.customer_id,
      action: 'cancel_order',
      result: 'success',
      details: { orderId, date: order.date },
      create_time: Date.now()
    }})

    return { success: true }
  } catch (err) {
    try {
      await db.collection('user_logs').add({ data: {
        user_id: '',
        action: 'cancel_order',
        result: 'failed',
        details: { orderId, error: err.message },
        create_time: Date.now()
      }})
    } catch (e) {}
    console.error('[cancelOrder] 取消订单失败', err)
    return { success: false, message: '取消订单失败' }
  }
}