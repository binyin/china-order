const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const res = await db.collection('users').limit(100).get()
    console.log('[queryUsers] users:', JSON.stringify(res.data))
    return { success: true, data: res.data }
  } catch (err) {
    console.error('[queryUsers] error:', err.message)
    return { success: false, message: err.message }
  }
}