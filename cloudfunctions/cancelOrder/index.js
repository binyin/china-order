// 云函数：取消订单（恢复库存）
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
        // 同时更新所有产品项状态
        items: order.items.map(item => ({
          ...item,
          item_status: 'cancelled'
        }))
      }
    })

    // 3. 恢复库存（ordered 减少对应数量）
    const today = order.date
    for (const item of order.items) {
      const menuRes = await db.collection('active_menu')
        .where({ name: item.name, date: today })
        .get()

      if (menuRes.data.length > 0) {
        await db.collection('active_menu').doc(menuRes.data[0]._id).update({
          data: { ordered: _.inc(-item.num) }
        })
      }
    }

    return { success: true }
  } catch (err) {
    console.error('取消订单失败', err)
    return { success: false, message: '取消订单失败' }
  }
}
