// 云函数：发布今日菜单（原子化：先清后写）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  console.log('publishMenu event:', event)
  const { items } = event

  if (!items || items.length === 0) {
    console.warn('items为空或未提供')
    return { success: false, message: '请选择至少一个品种' }
  }

  const today = getDateStr()
  console.log('今日日期:', today)

  try {
    // 1. 查询今日已有菜单
    console.log('查询今日已有菜单...')
    const existing = await db.collection('active_menu')
      .where({ date: today })
      .get()
    console.log('已有菜单数量:', existing.data.length)

    // 2. 逐条删除旧数据
    if (existing.data.length > 0) {
      console.log('开始删除旧数据...')
      const deleteTasks = existing.data.map(doc =>
        db.collection('active_menu').doc(doc._id).remove()
      )
      await Promise.all(deleteTasks)
      console.log('删除完成')
    } else {
      console.log('今日无旧菜单，跳过删除')
    }

    // 3. 批量插入新菜单
    console.log('开始插入新菜单，数量:', items.length)
    const insertTasks = items.map(item => {
      const data = {
        product_id: item.product_id,
        name: item.name,
        price: item.price,
        unit: item.unit || '个',
        image_url: item.image_url || '',
        stock: item.stock || 50,
        ordered: 0,
        date: today
      }
      console.log('插入数据:', data)
      return db.collection('active_menu').add({ data })
    })
    await Promise.all(insertTasks)
    console.log('插入完成')

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
