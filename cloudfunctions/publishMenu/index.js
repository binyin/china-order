const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { items, date } = event
  const { OPENID } = cloud.getWXContext() // 获取老板的ID

  if (!items || items.length === 0) return { success: false, message: '请选择品种' }

  // 1. 获取日期字符串（默认明天）
  const targetDate = date || getTomorrowBJDate()

  try {
    // 2. 清理逻辑
    console.log(`正在清理日期为 ${targetDate} 的旧菜单...`)
    await db.collection('active_menu').where({
      date: targetDate
    }).remove()

    // 生成唯一菜单ID
    const menuId = `${targetDate}_${Date.now()}`
    const publishTime = Date.now()

    // 3. 批量插入 (使用Promise.all提升速度)
    const insertTasks = items.map(item => {
      return db.collection('active_menu').add({
        data: {
          product_id: item.product_id,
          name: item.name,
          price: Number(item.price),
          unit: item.unit || '个',
          image_url: item.image_url || '',
          stock: Number(item.stock) || 50,
          ordered: 0,
          date: targetDate,
          menu_id: menuId,
          publish_time: publishTime,
          _openid: OPENID,
          create_time: db.serverDate()
        }
      })
    })

    await Promise.all(insertTasks)
    
    return {
      success: true,
      data: { date: targetDate, count: items.length }
    }
  } catch (err) {
    console.error('发布失败详情:', err)
    return { success: false, message: `发布失败: ${err.errMsg}` }
  }
}

function getTomorrowBJDate() {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  now.setDate(now.getDate() + 1)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}