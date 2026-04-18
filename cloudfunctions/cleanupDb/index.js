const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    // 清理 active_menu 冗余字段
    const menuRes = await db.collection('active_menu').where({
      _id: _.neq(null)
    }).update({
      data: {
        name: _.remove(),
        price: _.remove(),
        unit: _.remove(),
        image_url: _.remove()
      }
    })

    // 清理 orders 表 - 遍历处理 items 数组
    let offset = 0
    const batchSize = 20
    let ordersCleaned = 0

    while (true) {
      const ordersRes = await db.collection('orders')
        .skip(offset)
        .limit(batchSize)
        .get()

      if (ordersRes.data.length === 0) break

      for (const order of ordersRes.data) {
        const cleanedItems = order.items.map(item => ({
          num: item.num,
          product_id: item.product_id,
          item_status: item.item_status
        }))

        await db.collection('orders').doc(order._id).update({
          data: { items: cleanedItems }
        })
        ordersCleaned++
      }

      offset += batchSize
    }

    return {
      success: true,
      message: `active_menu: ${menuRes.stats.updated}条, orders: ${ordersCleaned}条`
    }
  } catch (err) {
    return { success: false, message: err.message }
  }
}