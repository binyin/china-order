// 云函数：取消订单（库存从 orders 表实时计算）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { orderId } = event

  if (!orderId) {
    return { success: false, message: '订单ID不能为空' }
  }

  try {
    // 1. 获取订单信息
    const orderRes = await db.collection('orders').doc(orderId).get()
    const order = orderRes.data

    if (!order || order.status !== 'pending') {
      return { success: false, message: '订单不存在或已处理' }
    }

    // 2. 更新订单状态
    await db.collection('orders').doc(orderId).update({
      data: { 
        status: 'cancelled',
        items: order.items.map(item => ({
          ...item,
          item_status: 'cancelled'
        }))
      }
    })

    return { success: true }
  } catch (err) {
    console.error('[cancelOrder] 取消订单失败', err)
    return { success: false, message: '取消订单失败' }
  }
}