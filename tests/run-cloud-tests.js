const WebSocket = require('ws')

const msgId = { val: 0 }
const nextId = () => ++msgId.val

async function send(ws, method, params = {}) {
  const id = nextId()
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`超时: ${method}`)), 30000)
    ws.once('message', (data) => {
      try {
        const res = JSON.parse(data)
        if (res.id === id) {
          clearTimeout(timeout)
          resolve(res)
        }
      } catch (e) {}
    })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function runTests() {
  const ws = new WebSocket('ws://127.0.0.1:9420')

  try {
    console.log('🔗 连接...')
    await new Promise((r, e) => { ws.on('open', r); ws.on('error', e) })
    console.log('✅ 已连接')

    console.log('📝 执行测试...')

    const testCode = `
      (async () => {
        const db = wx.cloud.database()

        // 1. 添加带图片的产品
        const prodRes = await db.collection('products').add({
          data: {
            name: '测试图片馒头',
            price: 5.0,
            unit: '个',
            image_url: 'cloud://test-img-001.jpg'
          }
        })

        // 2. 查询验证
        const prod = await db.collection('products').doc(prodRes._id).get()

        // 3. 删除测试数据
        await db.collection('products').doc(prodRes._id).remove()

        return {
          success: true,
          image_url: prod.data.image_url
        }
      })()
    `

    const result = await send(ws, 'App.evaluate', { code: testCode })

    console.log('\n========== 测试结果 ==========')
    console.log(JSON.stringify(result, null, 2))

    return result
  } catch (err) {
    console.error('❌ 失败:', err.message)
    throw err
  } finally {
    ws.close()
  }
}

runTests()