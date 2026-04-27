const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { key } = event

  try {
    let query = {}
    if (key) {
      query = { key: key }
    }
    
    const res = await db.collection('system_config')
      .where(query)
      .get()

    if (key) {
      return {
        success: true,
        value: res.data.length > 0 ? res.data[0].value : null
      }
    } else {
      const config = {}
      res.data.forEach(item => {
        config[item.key] = item.value
      })
      return {
        success: true,
        config: config
      }
    }
  } catch (err) {
    return { success: false, message: err.message }
  }
}