// 云函数：撤销取消订单（恢复状态+扣减库存）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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

    // 1. 恢复订单状态
    await db.collection('orders').doc(orderId).update({
      data: { status: 'pending' }
    })

    // 2. 扣减库存（ordered 增加对应数量）
    const today = order.date
    for (const item of order.items) {
      const menuRes = await db.collection('active_menu')
        .where({ name: item.name, date: today })
        .get()

      if (menuRes.data.length > 0) {
        await db.collection('active_menu').doc(menuRes.data[0]._id).update({
          data: { ordered: _.inc(item.num) }
        })
      }
    }

    return { success: true }
  } catch (err) {
    console.error('撤销取消失败', err)
    return { success: false, message: '操作失败' }
  }
}
