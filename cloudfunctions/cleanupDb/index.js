const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function getCutoffDate(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

exports.main = async (event, context) => {
  const menuDays = event.menuDays || 30
  const orderDays = event.orderDays || 365

  const menuCutoff = getCutoffDate(menuDays)
  const orderCutoff = getCutoffDate(orderDays)

  console.log(`[cleanupDb] 开始清理: menuCutoff=${menuCutoff}, orderCutoff=${orderCutoff}`)

  try {
    let menuDeleted = 0, orderDeleted = 0

    // 清理过期菜单（30天）
    while (true) {
      const menuRes = await db.collection('active_menu')
        .where({ date: _.lt(menuCutoff) })
        .limit(100)
        .get()

      if (menuRes.data.length === 0) break

      for (const m of menuRes.data) {
        await db.collection('active_menu').doc(m._id).remove()
        menuDeleted++
      }
      console.log(`[cleanupDb] 已删除菜单: ${menuDeleted}`)
    }

    // 清理过期订单（365天）
    while (true) {
      const orderRes = await db.collection('orders')
        .where({ date: _.lt(orderCutoff) })
        .limit(100)
        .get()

      if (orderRes.data.length === 0) break

      for (const o of orderRes.data) {
        await db.collection('orders').doc(o._id).remove()
        orderDeleted++
      }
      console.log(`[cleanupDb] 已删除订单: ${orderDeleted}`)
    }

    console.log(`[cleanupDb] 完成: menuDeleted=${menuDeleted}, orderDeleted=${orderDeleted}`)

    return {
      success: true,
      menuDeleted,
      orderDeleted,
      menuCutoff,
      orderCutoff
    }
  } catch (err) {
    console.error('[cleanupDb] 错误:', err)
    return { success: false, message: err.message }
  }
}