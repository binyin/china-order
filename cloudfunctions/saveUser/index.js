const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { nickname, avatarUrl, phone } = event
  const { OPENID } = cloud.getWXContext()
  
  console.log('[saveUser] received:', { nickname, avatarUrl: avatarUrl ? 'has_value' : 'empty', phone, OPENID })

  if (!nickname) {
    return { success: false, message: '缺少用户信息' }
  }

  try {
    const existRes = await db.collection('users').where({
      _id: OPENID
    }).get()

    const changes = {}
    if (nickname) changes.nickname = nickname
    if (avatarUrl) changes.avatarUrl = avatarUrl
    if (phone) changes.phone = phone

    if (existRes.data.length > 0) {
      const oldUser = existRes.data[0]
      changes.update_time = Date.now()
      await db.collection('users').doc(OPENID).update({ data: changes })
      
      if (nickname && nickname !== oldUser.nickname) {
        await db.collection('user_logs').add({ data: {
          user_id: OPENID,
          action: 'update_nickname',
          result: 'success',
          details: { old: oldUser.nickname, new: nickname },
          create_time: Date.now()
        }})
      }
      if (phone && phone !== oldUser.phone) {
        await db.collection('user_logs').add({ data: {
          user_id: OPENID,
          action: 'update_phone',
          result: 'success',
          details: { old: oldUser.phone, new: phone },
          create_time: Date.now()
        }})
      }
      if (avatarUrl && avatarUrl !== oldUser.avatarUrl) {
        await db.collection('user_logs').add({ data: {
          user_id: OPENID,
          action: 'update_avatar',
          result: 'success',
          details: {},
          create_time: Date.now()
        }})
      }
    } else {
      const addData = {
        _id: OPENID,
        nickname,
        avatarUrl,
        create_time: Date.now()
      }
      if (phone) addData.phone = phone
      await db.collection('users').add({ data: addData })
      
      await db.collection('user_logs').add({ data: {
        user_id: OPENID,
        action: 'create_profile',
        result: 'success',
        details: { nickname },
        create_time: Date.now()
      }})
    }

    return { success: true }
  } catch (err) {
    try {
      await db.collection('user_logs').add({ data: {
        user_id: OPENID,
        action: 'update_profile',
        result: 'failed',
        details: { error: err.message },
        create_time: Date.now()
      }})
    } catch (e) {}
    console.error('保存用户失败', err)
    return { success: false, message: err.message }
  }
}