const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { items, date } = event
  const { OPENID } = cloud.getWXContext()

  console.log('[publishMenu] 收到请求:', JSON.stringify({ items, date }))

  if (!items || items.length === 0) {
    return { success: false, message: '请选择品种' }
  }

  const targetDate = date || getTodayBJDate()
  const menuId = 'menu_' + targetDate
  const publishTime = Date.now()
  const productIds = items.map(function(i) { return i.product_id })

  console.log('[publishMenu] targetDate:', targetDate, 'productIds:', productIds)

  try {
    const existing = await db.collection('active_menu').where({ date: targetDate }).get()

    if (existing.data.length > 0) {
      await db.collection('active_menu').doc(existing.data[0]._id).update({
        data: {
          items: productIds,
          publish_time: publishTime,
          menu_id: menuId,
          update_time: db.serverDate()
        }
      })
      console.log('[publishMenu] 更新菜单:', targetDate, productIds.length, '个产品')
    } else {
      await db.collection('active_menu').add({
        data: {
          date: targetDate,
          items: productIds,
          publish_time: publishTime,
          menu_id: menuId,
          _openid: OPENID,
          create_time: db.serverDate()
        }
      })
      console.log('[publishMenu] 新增菜单:', targetDate, productIds.length, '个产品')
    }

    return {
      success: true,
      data: { date: targetDate, count: productIds.length }
    }
  } catch (err) {
    console.error('[publishMenu] 失败:', err)
    return { success: false, message: '发布失败: ' + err.message }
  }
}

function getTodayBJDate() {
  var now = new Date(Date.now() + 8 * 3600 * 1000)
  var year = now.getFullYear()
  var month = String(now.getMonth() + 1).padStart(2, '0')
  var day = String(now.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}