// 初始化数据库集合
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 尝试创建 users 集合
    await db.createCollection('users')
    return { success: true, message: 'users 集合已创建' }
  } catch (err) {
    return { success: false, message: err.message }
  }
}