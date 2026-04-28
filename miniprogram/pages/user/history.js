// pages/user/history.js
const { getUserOrderHistory, hideOrder } = require('../../utils/db')

Page({
  data: {
    loading: true,
    dailyList: [],
    showDetail: false,
    detailDate: '',
    detailOrders: [],
    statusText: {
      pending: '待取货',
      completed: '已完成',
      cancelled: '已取消',
      hidden: '已删除'
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
    getUserOrderHistory().then(orders => {
      const validOrders = (orders || []).filter(o => o.status !== 'cancelled')
      // 按日期聚合
      const dateMap = {}
      validOrders.forEach(o => {
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
  },

  deleteOrder(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确认删除该订单?',
      confirmText: '删除',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中', mask: true })
          
          hideOrder(id).then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadOrders()
          }).catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'error' })
          })
        }
      }
    })
  }
})
