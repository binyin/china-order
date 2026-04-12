const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { items } = event
  const { OPENID } = cloud.getWXContext() // 获取老板的ID

  if (!items || items.length === 0) return { success: false, message: '请选择品种' }

  // 1. 获取北京时间日期字符串
  const today = new Date(new Date().getTime() + 8 * 3600 * 1000)
    .toISOString().split('T')[0]

  try {
    // 2. 清理逻辑 (优化：一次性清理提高性能)
    console.log(`正在清理日期为 ${today} 的旧菜单...`)
    await db.collection('active_menu').where({
      date: today
    }).remove()

    // 3. 批量插入 (使用Promise.all提升速度)
    const insertTasks = items.map(item => {
      return db.collection('active_menu').add({
        data: {
          product_id: item.product_id,
          name: item.name,
          price: Number(item.price), // 强制转数字，防止前端传字符串导致计算错误
          unit: item.unit || '个',
          image_url: item.image_url || '',
          stock: Number(item.stock) || 50,
          ordered: 0,
          date: today,
          _openid: OPENID, // 标记是谁发布的
          create_time: db.serverDate() // 记录发布时间戳
        }
      })
    })

    await Promise.all(insertTasks)
    
    return {
      success: true,
      data: { date: today, count: items.length }
    }
  } catch (err) {
    console.error('发布失败详情:', err)
    return { success: false, message: `发布失败: ${err.errMsg}` }
  }
}