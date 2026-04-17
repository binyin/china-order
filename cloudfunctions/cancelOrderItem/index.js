// 云函数：取消订单中的单个产品
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { orderId, productId } = event

  if (!orderId || !productId) {
    return { success: false, message: '订单ID和产品ID不能为空' }
  }

  try {
    // 1. 获取订单信息
    const orderRes = await db.collection('orders').doc(orderId).get()
    const order = orderRes.data

    if (!order || order.status === 'cancelled') {
      return { success: false, message: '订单不存在或已取消' }
    }

    // 2. 更新订单中指定产品的状态
    const updatedItems = order.items.map(item => {
      if (item.product_id === productId) {
        return { ...item, item_status: 'cancelled' }
      }
      return item
    })

    // 3. 检查是否所有产品都取消了
    const allCancelled = updatedItems.every(item => item.item_status === 'cancelled')

    // 4. 更新订单
    await db.collection('orders').doc(orderId).update({
      data: {
        items: updatedItems,
        status: allCancelled ? 'cancelled' : order.status
      }
    })

    // 5. 恢复库存
    const cancelledItem = order.items.find(item => item.product_id === productId)
    if (cancelledItem) {
      const today = order.date
      // 使用 product_id 匹配更准确
      let menuRes = null
      try {
        const docRes = await db.collection('active_menu').doc(cancelledItem.product_id).get()
        menuRes = { data: [docRes.data] }
      } catch (e) {
        menuRes = await db.collection('active_menu')
          .where({ product_id: cancelledItem.product_id, date: today })
          .get()
      }

      if (menuRes.data.length > 0) {
        await db.collection('active_menu').doc(menuRes.data[0]._id).update({
          data: { ordered: _.inc(-cancelledItem.num) }
        })
      }
    }

    return { success: true, message: '产品取消成功' }
  } catch (err) {
    console.error('取消产品失败', err)
    return { success: false, message: '取消产品失败' }
  }
}
