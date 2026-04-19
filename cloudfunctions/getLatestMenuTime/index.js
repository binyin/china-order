// 云函数：获取今日最新菜单的发布时间（新结构）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const today = getTodayBJDate()
  
  try {
    const menuRes = await db.collection('active_menu')
      .where({
        date: _.gte(today)
      })
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
    console.error('[getLatestMenuTime] 获取失败', err)
    return { success: false, message: '获取失败' }
  }
}

function getTodayBJDate() {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}