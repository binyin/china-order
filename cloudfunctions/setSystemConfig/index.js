const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { key, value } = event

  if (!key) {
    return { success: false, message: 'key不能为空' }
  }

  try {
    const existRes = await db.collection('system_config')
      .where({ key: key })
      .get()

    if (existRes.data.length > 0) {
      await db.collection('system_config')
        .doc(existRes.data[0]._id)
        .update({
          data: { value: value }
        })
    } else {
      await db.collection('system_config')
        .add({
          data: { key: key, value: value }
        })
    }

    return { success: true }
  } catch (err) {
    return { success: false, message: err.message }
  }
}