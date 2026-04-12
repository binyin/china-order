// 云函数：创建订单（原子化库存扣减）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { items, total_price, customer_name } = event
  const { OPENID } = cloud.getWXContext()

  if (!items || items.length === 0) {
    return { success: false, message: '订单为空' }
  }

  const today = getDateStr()
  const now = new Date()

  try {
    // 获取最新菜单发布时间
    let latestPublishTime = 0
    try {
      const menuTimeRes = await db.collection('active_menu')
        .where({ date: today })
        .orderBy('publish_time', 'desc')
        .limit(1)
        .get()
      
      if (menuTimeRes.data.length > 0) {
        latestPublishTime = menuTimeRes.data[0].publish_time || 0
      }
    } catch (e) {
      console.warn('获取最新菜单时间失败，使用默认值0', e)
    }

    // 1. 逐项检查库存并原子扣减
    for (const item of items) {
      // product_id 实际是 active_menu 的文档 _id
      let menuItem = null
      try {
        const docRes = await db.collection('active_menu').doc(item.product_id).get()
        menuItem = docRes.data
      } catch (e) {
        // doc查询失败，尝试用 product_id 字段 + date 查询
        const menuRes = await db.collection('active_menu')
          .where({ product_id: item.product_id, date: today })
          .get()
        if (menuRes.data.length > 0) menuItem = menuRes.data[0]
      }

      if (!menuItem) {
        return { success: false, message: `${item.name} 今日未上架` }
      }
      const remaining = menuItem.stock - (menuItem.ordered || 0)

      if (remaining < item.num) {
        return { success: false, message: `${item.name} 库存不足，仅剩 ${remaining} 件` }
      }

      // 原子化库存扣减
      await db.collection('active_menu').doc(menuItem._id).update({
        data: { ordered: _.inc(item.num) }
      })
    }

    // 2. 创建订单
    const orderData = {
      customer_name: customer_name || '微信用户',
      customer_id: OPENID,
      items: items.map(i => ({
        name: i.name,
        num: i.num,
        product_id: i.product_id,  // 添加产品ID
        item_status: 'pending'      // 添加产品状态字段
      })),
      total_price: total_price,
      status: 'pending',
      date: today,
      menu_publish_time: latestPublishTime,  // 新增：记录菜单发布时间
      create_time: now.getTime(),
      create_time_str: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    }

    const orderRes = await db.collection('orders').add({ data: orderData })

    return {
      success: true,
      data: { orderId: orderRes._id }
    }
  } catch (err) {
    console.error('创建订单失败', err)
    return { success: false, message: '创建订单失败，请重试' }
  }
}

function getDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
