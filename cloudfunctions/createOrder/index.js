// 云函数：创建订单（库存从 orders 表实时计算）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { items, total_price, customer_name, customer_phone, customer_nickname, customer_avatar } = event
  const { OPENID } = cloud.getWXContext()

  if (!items || items.length === 0) {
    return { success: false, message: '订单为空' }
  }

  if (!customer_name) {
    return { success: false, message: '请填写姓名' }
  }

  const today = getTodayBJDate()
  const now = new Date(Date.now() + 8 * 3600 * 1000)

  try {
    // 获取今日菜单（新结构）
    let latestMenu = null
    try {
      const menuRes = await db.collection('active_menu')
        .where({
          date: _.gte(today)
        })
        .orderBy('publish_time', 'desc')
        .limit(1)
        .get()
      
      if (menuRes.data.length > 0) {
        latestMenu = menuRes.data[0]
      }
    } catch (e) {
      console.warn('[createOrder] 获取菜单失败', e)
    }

    if (!latestMenu) {
      return { success: false, message: '今日未发布菜单' }
    }

    // 从 items 数组获取产品ID列表
    const menuProductIds = latestMenu.items || []
    if (menuProductIds.length === 0) {
      return { success: false, message: '今日菜单为空' }
    }

    // 从 orders 表实时计算每个产品的销量
    const orderStats = await calcOrderStats(today)

    // 验证库存
    const STOCK = 50
    for (const item of items) {
      if (!menuProductIds.includes(item.product_id)) {
        return { success: false, message: `${item.name} 今日未上架` }
      }
      const sold = orderStats[item.product_id] || 0
      const remaining = STOCK - sold
      if (remaining < item.num) {
        return { success: false, message: `${item.name} 库存不足，仅剩 ${remaining} 件` }
      }
    }

    // 从 products 表获取产品信息
    const productIds = items.map(i => i.product_id)
    let productMap = {}
    try {
      const prodRes = await db.collection('products')
        .where({ _id: _.in(productIds) })
        .get()
      prodRes.data.forEach(p => {
        productMap[p._id] = { name: p.name, image_url: p.image_url || '' }
      })
    } catch (e) {
      console.warn('[createOrder] 获取产品信息失败', e)
    }

    const orderItems = items.map(i => ({
      name: productMap[i.product_id]?.name || i.name,
      num: i.num,
      product_id: i.product_id,
      item_status: 'pending',
      image_url: productMap[i.product_id]?.image_url || ''
    }))

    const orderData = {
      customer_name: customer_name,
      customer_id: OPENID,
      customer_nickname: customer_nickname || '',
      customer_avatar: customer_avatar || '',
      items: orderItems,
      total_price: total_price,
      status: 'pending',
      date: today,
      menu_id: latestMenu.menu_id,
      menu_publish_time: latestMenu.publish_time,
      create_time: now.getTime(),
      create_time_str: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    }
    if (customer_phone) orderData.customer_phone = customer_phone

    const orderRes = await db.collection('orders').add({ data: orderData })

    return {
      success: true,
      data: { orderId: orderRes._id }
    }
  } catch (err) {
    console.error('[createOrder] 创建订单失败', err)
    return { success: false, message: '创建订单失败，请重试' }
  }
}

// 计算当天每个产品的销量
async function calcOrderStats(date) {
  const stats = {}
  try {
    const orderRes = await db.collection('orders')
      .where({
        date: date,
        status: _.nin(['cancelled'])
      })
      .get()
    
    orderRes.data.forEach(order => {
      (order.items || []).forEach(item => {
        stats[item.product_id] = (stats[item.product_id] || 0) + item.num
      })
    })
  } catch (e) {
    console.warn('[calcOrderStats] 计算销量失败', e)
  }
  return stats
}

function getTodayBJDate() {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}