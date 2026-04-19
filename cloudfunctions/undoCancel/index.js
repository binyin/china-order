// 云函数：撤销取消订单（库存从 orders 表实时计算）
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

    if (!order || order.status !== 'cancelled') {
      return { success: false, message: '订单不存在或非取消状态' }
    }

    // 恢复订单状态
    await db.collection('orders').doc(orderId).update({
      data: { status: 'pending' }
    })

    return { success: true }
  } catch (err) {
    console.error('[undoCancel] 撤销取消失败', err)
    return { success: false, message: '操作失败' }
  }
}