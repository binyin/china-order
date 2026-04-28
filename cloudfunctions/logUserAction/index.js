const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function cleanOldLogs() {
  try {
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000
    await db.collection('user_logs').where({
      create_time: _.lt(sevenDaysAgo)
    }).remove()
  } catch (e) {
    console.warn('[logUserAction] clean failed', e)
  }
}

exports.main = async (event, context) => {
  const { user_id, action, result, details } = event
  
  if (!user_id || !action) {
    return { success: false, message: '缺少必要参数' }
  }

  try {
    cleanOldLogs()
    
    await db.collection('user_logs').add({ data: {
      user_id,
      action,
      result: result || 'success',
      details: details || {},
      create_time: Date.now()
    }})
    
    return { success: true }
  } catch (err) {
    console.error('[logUserAction] failed', err)
    return { success: false, message: err.message }
  }
}