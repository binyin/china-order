// 云函数：店主登录验证
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { username, password } = event

  if (!username || !password) {
    return { success: false, message: '账号和密码不能为空' }
  }

  try {
    const res = await db.collection('configs')
      .where({ username: username, password: password })
      .get()

    if (res.data.length > 0) {
      const admin = res.data[0]
      return {
        success: true,
        data: {
          nickname: admin.nickname,
          username: admin.username,
          role: admin.role || 'admin'
        }
      }
    } else {
      return { success: false, message: '账号或密码错误' }
    }
  } catch (err) {
    console.error('登录验证失败', err)
    return { success: false, message: '登录验证失败' }
  }
}
