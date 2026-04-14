// pages/admin/orders.js
const app = getApp()
const { getTodayOrders, getTodayMenu, getMenuByDate, getRecentOrders, updateOrderStatus, getDateStr } = require('../../utils/db')

Page({
  data: {
    activeTab: 'verify',
    // 核销页数据
    menuStats: [],      // [{name, total, pending, customers:[{name,num}], expanded}]
    totalRevenue: '0.00',
    actualRevenue: '0.00',
    pendingOrders: [],
    historyOrders: [],
    // 历史订单页数据
    dailyList: [],
    detailDate: '',
    detailOrders: [],
    showDetail: false,
    today: '',
    // 实时监听
    orderWatcher: null,
    newOrderFlag: false,
    statusText: {
      pending: '待取走',
      completed: '已取走',
      cancelled: '已取消'
    }
  },

  onLoad() {
    this.checkLogin()
  },

  onShow() {
    this.checkLogin()
    this.loadVerifyData()
    this.startWatch()
  },

  onHide() {
    this.stopWatch()
  },

  onUnload() {
    this.stopWatch()
  },

  checkLogin() {
    if (!app.globalData.adminInfo) {
      wx.redirectTo({ url: '/pages/admin/login' })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab, showDetail: false })
    if (tab === 'verify') {
      this.loadVerifyData()
    } else {
      this.loadDailyList()
    }
  },

  // ========== 预定核销 ==========

  async loadVerifyData() {
    try {
      const targetDate = getDateStr()
      const [menuRes, orderRes] = await Promise.all([
        getMenuByDate(targetDate),
        getTodayOrders(targetDate)
      ])

      const menuItems = menuRes.data || []
      const orders = orderRes.data || []

      // 区域1：按品类统计 + 预定人明细
      const statsMap = {}
      menuItems.forEach(m => {
        statsMap[m.name] = {
          name: m.name,
          price: m.price,
          total: 0,
          pending: 0,
          customers: [],
          expanded: false
        }
      })

      orders.forEach(o => {
        o.items.forEach(item => {
          if (!statsMap[item.name]) {
            statsMap[item.name] = {
              name: item.name, price: 0, total: 0, pending: 0, customers: [], expanded: false
            }
          }
          statsMap[item.name].total += item.num
          if (o.status === 'pending') statsMap[item.name].pending += item.num
          // 记录每个预定人
          if (o.status === 'pending') {
            statsMap[item.name].customers.push({
              name: o.customer_name,
              num: item.num,
              orderId: o._id,
              time: o.create_time_str || ''
            })
          }
        })
      })

      // 按待取数量降序排列
      const menuStats = Object.values(statsMap).sort((a, b) => b.pending - a.pending)

      // 营收统计
      let totalRev = 0, actualRev = 0
      orders.forEach(o => {
        if (o.status === 'pending') totalRev += o.total_price || 0
        if (o.status === 'completed') { totalRev += o.total_price || 0; actualRev += o.total_price || 0 }
      })

      // 区域2：客户清单
      const pendingOrders = orders
        .filter(o => o.status === 'pending')
        .sort((a, b) => (b.create_time || 0) - (a.create_time || 0))
      const historyOrders = orders
        .filter(o => o.status !== 'pending')
        .sort((a, b) => (b.create_time || 0) - (a.create_time || 0))

      this.setData({
        menuStats,
        totalRevenue: totalRev.toFixed(2),
        actualRevenue: actualRev.toFixed(2),
        pendingOrders,
        historyOrders,
        newOrderFlag: false
      })
    } catch (err) {
      console.error('加载核销数据失败', err)
    }
  },

  // 展开/收起品类详情
  toggleStatExpand(e) {
    const index = e.currentTarget.dataset.index
    const menuStats = this.data.menuStats
    menuStats[index].expanded = !menuStats[index].expanded
    this.setData({ menuStats })
  },

  // 核销订单 - 无二次确认
  verifyOrder(e) {
    const id = e.currentTarget.dataset.id
    // 添加日志
    console.group('[Admin:Orders] 核销订单')
    console.log('订单ID:', id)
    console.log('状态: pending → completed')
    console.groupEnd()
    
    updateOrderStatus(id, 'completed').then(() => {
      wx.vibrateShort()
      wx.showToast({ title: '已取走', icon: 'success' })
      this.loadVerifyData()
    }).catch(() => {
      wx.showToast({ title: '操作失败', icon: 'error' })
    })
  },

  // 取消订单 - 无二次确认，恢复库存
  cancelOrder(e) {
    const id = e.currentTarget.dataset.id
    // 添加日志
    console.group('[Admin:Orders] 取消订单')
    console.log('订单ID:', id)
    console.log('状态: pending → cancelled')
    console.groupEnd()
    
    wx.cloud.callFunction({
      name: 'cancelOrder',
      data: { orderId: id }
    }).then(res => {
      if (res.result.success) {
        wx.vibrateShort()
        wx.showToast({ title: '已取消', icon: 'success' })
        this.loadVerifyData()
      } else {
        wx.showToast({ title: res.result.message || '取消失败', icon: 'none' })
      }
    }).catch(() => {
      wx.showToast({ title: '操作失败', icon: 'error' })
    })
  },

  // 撤销（已取走→待取走，已取消→待取走）
  undoAction(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    // 添加日志
    console.group('[Admin:Orders] 撤销操作')
    console.log('订单ID:', id)
    console.log('原状态:', status)
    console.log('新状态: pending')
    console.groupEnd()
    
    // 已取走撤销：completed→pending，不需要恢复库存（库存本来就没动）
    // 已取消撤销：cancelled→pending，需要恢复库存
    if (status === 'cancelled') {
      // 需要恢复库存，用专门的云函数
      wx.cloud.callFunction({
        name: 'undoCancel',
        data: { orderId: id }
      }).then(res => {
        if (res.result.success) {
          wx.vibrateShort()
          wx.showToast({ title: '已撤销', icon: 'success' })
          this.loadVerifyData()
        } else {
          wx.showToast({ title: res.result.message || '撤销失败', icon: 'none' })
        }
      }).catch(() => {
        wx.showToast({ title: '操作失败', icon: 'error' })
      })
    } else {
      // completed→pending，直接更新状态
      updateOrderStatus(id, 'pending').then(() => {
        wx.vibrateShort()
        wx.showToast({ title: '已撤销', icon: 'success' })
        this.loadVerifyData()
      }).catch(() => {
        wx.showToast({ title: '操作失败', icon: 'error' })
      })
    }
  },

  // ========== 实时监听 ==========

  startWatch() {
    if (this.data.orderWatcher) return

    const db = wx.cloud.database()
    const today = getDateStr()
    
    // 先同步获取最新发布时间，然后创建监听
    this.getLatestPublishTimeAsync(today).then(latestPublishTime => {
      console.log('[Admin:Orders] 开始监听，最新发布时间:', latestPublishTime)
      
      let query = { date: today }
      if (latestPublishTime > 0) {
        query.menu_publish_time = latestPublishTime
      }
      
      const watcher = db.collection('orders')
        .where(query)
        .watch({
          onChange: snapshot => {
            if (snapshot.type === 'init') return
            if (snapshot.type === 'replace' || snapshot.type === 'update') {
              this.setData({ newOrderFlag: true })
            }
            this.loadVerifyData()
          },
          onError: err => {
            console.error('订单监听错误', err)
          }
        })

      this.setData({ orderWatcher: watcher })
    }).catch(err => {
      console.error('获取发布时间失败，使用默认监听', err)
      // 降级：监听所有今日订单
      const watcher = db.collection('orders')
        .where({ date: today })
        .watch({
          onChange: snapshot => {
            if (snapshot.type === 'init') return
            if (snapshot.type === 'replace' || snapshot.type === 'update') {
              this.setData({ newOrderFlag: true })
            }
            this.loadVerifyData()
          },
          onError: err => {
            console.error('订单监听错误', err)
          }
        })
      
      this.setData({ orderWatcher: watcher })
    })
  },

  stopWatch() {
    if (this.data.orderWatcher) {
      this.data.orderWatcher.close()
      this.setData({ orderWatcher: null })
    }
  },

  // ========== 历史订单 ==========

  loadDailyList() {
    getRecentOrders(30).then(res => {
      const orders = (res.data || []).sort((a, b) => (b.create_time || 0) - (a.create_time || 0))
      const dateMap = {}
      orders.forEach(o => {
        if (!dateMap[o.date]) {
          dateMap[o.date] = {
            date: o.date,
            orders: [],
            totalRevenue: 0,
            productNames: new Set()
          }
        }
        dateMap[o.date].orders.push(o)
        if (o.status === 'completed' || o.status === 'pending') {
          dateMap[o.date].totalRevenue += o.total_price || 0
        }
        o.items.forEach(i => dateMap[o.date].productNames.add(i.name))
      })

      const dailyList = Object.values(dateMap)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(d => ({
          date: d.date,
          orderCount: d.orders.length,
          totalRevenue: d.totalRevenue.toFixed(2),
          productNames: [...d.productNames].join('、'),
          pendingCount: d.orders.filter(o => o.status === 'pending').length,
          completedCount: d.orders.filter(o => o.status === 'completed').length,
          _orders: d.orders
        }))

      this.setData({ dailyList })
    })
  },

  openDetail(e) {
    const index = e.currentTarget.dataset.index
    const day = this.data.dailyList[index]
    this.setData({
      showDetail: true,
      detailDate: day.date,
      detailOrders: day._orders
    })
  },

  backToList() {
    this.setData({ showDetail: false })
  },

  // 获取最新菜单发布时间
  async getLatestPublishTimeAsync(date) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getLatestMenuTime',
        data: { date: date }
      })
      
      if (res.result.success) {
        return res.result.latest_publish_time || 0
      } else {
        console.error('获取最新菜单时间失败:', res.result.message)
        return 0
      }
    } catch (err) {
      console.error('调用获取最新菜单时间失败', err)
      return 0
    }
  },

  // ========== 导航 ==========

  goProducts() {
    wx.navigateTo({ url: '/pages/admin/products' })
  },

  goMenu() {
    wx.navigateTo({ url: '/pages/admin/menu' })
  },

  showMenu() {
    wx.showActionSheet({
      itemList: ['退出登录'],
      success: res => {
        if (res.tapIndex === 0) {
          app.globalData.adminInfo = null
          wx.redirectTo({ url: '/pages/admin/login' })
        }
      }
    })
  }
})
