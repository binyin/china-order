// 云函数：获取今日最新菜单的发布时间
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const targetDate = event.date || getBJDateStr()
  
  try {
    const menuRes = await db.collection('active_menu')
      .where({ date: targetDate })
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

function getBJDateStr() {
  const d = new Date()
  const bjTime = new Date(d.getTime() + 8 * 3600 * 1000)
  return `${bjTime.getFullYear()}-${String(bjTime.getMonth() + 1).padStart(2, '0')}-${String(bjTime.getDate()).padStart(2, '0')}`
}
