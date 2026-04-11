// pages/user/history.js
const { getMyOrders } = require('../../utils/db')

Page({
  data: {
    loading: true,
    dailyList: [],     // 1层：按日期聚合的经营概况
    showDetail: false, // 是否显示2层
    detailDate: '',    // 当前查看的日期
    detailOrders: [],  // 2层：该日期的订单列表
    statusText: {
      pending: '待取货',
      completed: '已完成',
      cancelled: '已取消'
    }
  },

  onLoad() {
    this.loadOrders()
  },

  onShow() {
    this.loadOrders()
  },

  loadOrders() {
    this.setData({ loading: true })
    getMyOrders().then(res => {
      const orders = res.data || []
      // 按日期聚合
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
          cancelledCount: d.orders.filter(o => o.status === 'cancelled').length,
          _orders: d.orders
        }))

      this.setData({ dailyList, loading: false })
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'error' })
    })
  },

  // 进入2层：查看某日订单详情
  openDetail(e) {
    const index = e.currentTarget.dataset.index
    const day = this.data.dailyList[index]
    this.setData({
      showDetail: true,
      detailDate: day.date,
      detailOrders: day._orders
    })
  },

  // 返回1层
  backToList() {
    this.setData({ showDetail: false })
  }
})
