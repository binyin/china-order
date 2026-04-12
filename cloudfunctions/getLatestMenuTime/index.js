// 云函数：获取今日最新菜单的发布时间
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const today = getDateStr()
  
  try {
    // 获取今日所有菜单，按发布时间降序排序
    const menuRes = await db.collection('active_menu')
      .where({ date: today })
      .orderBy('publish_time', 'desc')
      .limit(1)
      .get()
    
    if (menuRes.data.length > 0) {
      return { 
        success: true, 
        latest_publish_time: menuRes.data[0].publish_time || 0 
      }
    }
    
    return { success: true, latest_publish_time: 0 }
  } catch (err) {
    console.error('获取最新菜单时间失败', err)
    return { success: false, message: '获取失败' }
  }
}

function getDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
