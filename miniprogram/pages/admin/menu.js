// pages/admin/menu.js
const app = getApp()
const { getMenuByDate, getAllProducts, getTodayBJDateStr } = require('../../utils/db')

Page({
  data: {
    activeTab: 'publish',
    selectedDate: '',
    dateIndex: 0,
    dateList: [],
    todayMenu: [],
    unlistedProducts: [],
    historyDates: [],
    loading: false
  },

  onLoad() {
    if (!app.globalData.adminInfo) {
      wx.redirectTo({ url: '/pages/admin/login' })
      return
    }
    this.initDateList()
  },

  onShow() {
    if (this.data.selectedDate) {
      this.loadPublishData()
    }
  },

  initDateList() {
    const dates = []
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() + i * 24 * 3600 * 1000)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const day = d.getDay()
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const weekDay = weekDays[day]
      let label = ''
      if (i === 0) label = '今天'
      else if (i === 1) label = '明天'
      else label = weekDay
      dates.push({ date: dateStr, label, month: d.getMonth() + 1, day: d.getDate() })
    }
    this.setData({
      dateList: dates,
      selectedDate: dates[0].date,
      dateIndex: 0
    })
    this.loadPublishData()
  },

  onDateChange(e) {
    const index = e.currentTarget.dataset.index
    const date = this.data.dateList[index].date
    this.setData({
      selectedDate: date,
      dateIndex: index
    })
    this.loadPublishData()
  },

  onDateSwipe(e) {
    const direction = e.detail.direction
    let newIndex = this.data.dateIndex
    if (direction === 'left' && newIndex < 2) {
      newIndex++
    } else if (direction === 'right' && newIndex > 0) {
      newIndex--
    }
    if (newIndex !== this.data.dateIndex) {
      this.setData({
        selectedDate: this.data.dateList[newIndex].date,
        dateIndex: newIndex
      })
      this.loadPublishData()
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'history') {
      this.loadHistory()
    }
  },

  async loadPublishData() {
    this.setData({ loading: true })
    try {
      const [menuRes, prodRes] = await Promise.all([
        getMenuByDate(this.data.selectedDate),
        getAllProducts()
      ])
      
      const todayMenu = menuRes.data || []
      const allProducts = prodRes.data || []

      console.group('[Admin:Menu] 数据刷新')
      console.log('日期:', this.data.selectedDate)
      console.log('已发布数量:', todayMenu.length)
      console.log('产品池总数:', allProducts.length)
      console.groupEnd()

      const todayIds = new Set(todayMenu.map(m => m.product_id))
      const unlistedProducts = allProducts
        .filter(p => !todayIds.has(p._id))
        .map(p => ({ ...p, product_id: p._id }))

      this.setData({ todayMenu, unlistedProducts, loading: false })
    } catch (err) {
      console.error('[Admin:Menu] 加载失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'error' })
    }
  },

  addToMenu(e) {
    const index = e.currentTarget.dataset.index
    const product = this.data.unlistedProducts[index]
    
    this.setData({
      todayMenu: [...this.data.todayMenu, { ...product, qty: 0 }],
      unlistedProducts: this.data.unlistedProducts.filter((_, i) => i !== index)
    })
  },

  removeFromMenu(e) {
    const index = e.currentTarget.dataset.index
    const product = this.data.todayMenu[index]
    
    this.setData({
      todayMenu: this.data.todayMenu.filter((_, i) => i !== index),
      unlistedProducts: [...this.data.unlistedProducts, product]
    })
  },

  updateStock(e) {
    const index = e.currentTarget.dataset.index
    const val = parseInt(e.detail.value) || 0
    const menu = [...this.data.todayMenu]
    menu[index].stock = val
    this.setData({ todayMenu: menu })
  },

  updateQty(e) {
    const index = e.currentTarget.dataset.index
    const val = parseInt(e.detail.value) || 0
    const menu = [...this.data.todayMenu]
    menu[index].qty = val
    this.setData({ todayMenu: menu })
  },

  publishTodayMenu() {
    const items = this.data.todayMenu
    if (items.length === 0) {
      wx.showToast({ title: '请先选择产品', icon: 'none' })
      return
    }
    
    const postItems = items.map(m => ({
      product_id: m.product_id || m._id,
      name: m.name,
      price: m.price,
      unit: m.unit,
      image_url: m.image_url
    }))
    
    wx.showLoading({ title: '发布中...' })
    wx.cloud.callFunction({
      name: 'publishMenu',
      data: { items: postItems, date: this.data.selectedDate }
    }).then(result => {
      wx.hideLoading()
      const r = result.result
      if (r.success) {
        wx.showToast({ title: `已发布 ${r.data.count} 种`, icon: 'success' })
        this.loadPublishData()
      } else {
        wx.showModal({ title: '发布失败', content: r.message, showCancel: false })
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'error' })
    })
  },

  clearMenu() {
    this.setData({
      todayMenu: [],
      unlistedProducts: [...this.data.todayMenu, ...this.data.unlistedProducts]
    })
  },

  loadHistory() {
    getRecentMenuDates().then(res => {
      this.setData({ historyDates: res.data || [] })
    }).catch(err => {
      console.error('[Admin:Menu] 历史加载失败:', err)
    })
  },

  reuseMenu(e) {
    const date = e.currentTarget.dataset.date
    wx.showModal({
      title: '再次发布',
      content: `将 ${date} 的菜单发布为${this.data.selectedDate}的菜单？`,
      success: res => {
        if (!res.confirm) return
        getMenuByDate(date).then(menuRes => {
          const items = (menuRes.data || []).map(m => ({
            product_id: m.product_id || m._id,
            name: m.name,
            price: m.price,
            unit: m.unit,
            image_url: m.image_url
          }))
          wx.showLoading({ title: '发布中...' })
          wx.cloud.callFunction({
            name: 'publishMenu',
            data: { items, date: this.data.selectedDate }
          }).then(result => {
            wx.hideLoading()
            const r = result.result
            if (r.success) {
              wx.showToast({ title: `已发布 ${r.data.count} 种`, icon: 'success' })
              this.loadPublishData()
            } else {
              wx.showModal({ title: '发布失败', content: r.message, showCancel: false })
            }
          })
        })
      }
    })
  }
})

async function getRecentMenuDates() {
  const dates = []
  const today = new Date()
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    dates.push(dateStr)
  }
  
  const db = wx.cloud.database()
  const _ = db.command
  const result = await db.collection('active_menu')
    .where({
      date: _.in(dates)
    })
    .field({ date: true })
    .get()
  
  const dateMap = {}
  result.data.forEach(m => {
    dateMap[m.date] = true
  })
  
  return { data: Object.keys(dateMap).slice(0, 10) }
}