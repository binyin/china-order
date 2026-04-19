const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { items, date } = event
  const { OPENID } = cloud.getWXContext()

  if (!items || items.length === 0) return { success: false, message: '请选择品种' }

  const targetDate = date || getTodayBJDate()
  const menuId = `menu_${targetDate}`
  const publishTime = Date.now()
  const productIds = items.map(i => i.product_id)

  try {
    // 查询是否已存在该日期的菜单
    const existing = await db.collection('active_menu')
      .where({ date: targetDate })
      .get()

    if (existing.data.length > 0) {
      // 存在则更新
      await db.collection('active_menu').doc(existing.data[0]._id).update({
        data: {
          items: productIds,
          publish_time: publishTime,
          menu_id: menuId,
          update_time: db.serverDate()
        }
      })
      console.log(`[publishMenu] 更新菜单: ${targetDate}, ${productIds.length}个产品`)
    } else {
      // 不存在则新增
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
      console.log(`[publishMenu] 新增菜单: ${targetDate}, ${productIds.length}个产品`)
    }

    return {
      success: true,
      data: { date: targetDate, count: productIds.length }
    }
  } catch (err) {
    console.error('[publishMenu] 失败:', err)
    return { success: false, message: `发布失败: ${err.message}` }
  }
}

function getTodayBJDate() {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`