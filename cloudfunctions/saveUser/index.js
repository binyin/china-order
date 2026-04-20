// 云函数：保存用户信息
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { nickname, avatarUrl, phone } = event
  const { OPENID } = cloud.getWXContext()

  if (!nickname) {
    return { success: false, message: '缺少用户信息' }
  }

  try {
    // 查询是否已存在
    const existRes = await db.collection('users').where({
      _id: OPENID
    }).get()

    if (existRes.data.length > 0) {
      // 已存在，更新
      await db.collection('users').doc(OPENID).update({
        data: {
          nickname,
          avatarUrl,
          phone: phone || '',
          update_time: Date.now()
        }
      })
    } else {
      // 新增
      await db.collection('users').add({
        data: {
          _id: OPENID,
          nickname,
          avatarUrl,
          phone: phone || '',
          create_time: Date.now()
        }
      })
    }

    return { success: true }
  } catch (err) {
    console.error('保存用户失败', err)
    return { success: false, message: err.message }
  }
}