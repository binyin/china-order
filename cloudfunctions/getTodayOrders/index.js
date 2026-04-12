const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { date } = event
  
  const today = date || getDateStr()
  
  try {
    // 获取今日最新菜单的发布时间
    let latestPublishTime = 0
    const menuRes = await db.collection('active_menu')
      .where({ date: today })
      .orderBy('publish_time', 'desc')
      .limit(1)
      .get()
    
    if (menuRes.data.length > 0) {
      latestPublishTime = menuRes.data[0].publish_time || 0
    }
    
    // 构建查询条件
    const query = { date: today }
    if (latestPublishTime > 0) {
      query.menu_publish_time = latestPublishTime
    } else {
      query.menu_publish_time = 0
    }
    
    const ordersRes = await db.collection('orders')
      .where(query)
      .orderBy('create_time', 'asc')
      .get()
    
    return {
      success: true,
      data: ordersRes.data
    }
  } catch (err) {
    console.error('获取今日订单失败', err)
    return { success: false, message: '获取失败' }
  }
}

function getDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
