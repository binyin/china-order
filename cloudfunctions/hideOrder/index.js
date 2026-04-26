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

    if (!order) {
      return { success: false, message: '订单不存在' }
    }

    await db.collection('orders').doc(orderId).update({
      data: { status: 'hidden' }
    })

    return { success: true }
  } catch (err) {
    console.error('[hideOrder] error:', err)
    return { success: false, message: '操作失败' }
  }
}