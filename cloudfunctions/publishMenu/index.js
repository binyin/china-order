// 云函数：发布今日菜单（原子化：先清后写）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { items } = event

  if (!items || items.length === 0) {
    return { success: false, message: '请选择至少一个品种' }
  }

  const today = getDateStr()

  try {
    // 1. 查询今日已有菜单
    const existing = await db.collection('active_menu')
      .where({ date: today })
      .get()

    // 2. 逐条删除旧数据
    const deleteTasks = existing.data.map(doc =>
      db.collection('active_menu').doc(doc._id).remove()
    )
    await Promise.all(deleteTasks)

    // 3. 批量插入新菜单
    const insertTasks = items.map(item =>
      db.collection('active_menu').add({
        data: {
          product_id: item.product_id,
          name: item.name,
          price: item.price,
          unit: item.unit || '个',
          image_url: item.image_url || '',
          stock: item.stock || 50,
          ordered: 0,
          date: today
        }
      })
    )
    await Promise.all(insertTasks)

    return {
      success: true,
      data: { date: today, count: items.length }
    }
  } catch (err) {
    console.error('发布失败', err)
    return { success: false, message: '发布失败，请重试' }
  }
}

function getDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
