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
      
      const dbMenu = menuRes.data || []
      const allProducts = prodRes.data || []

      const localSelectedIds = new Set(
        this.data.todayMenu
          .filter(m => !m._id || !dbMenu.find(d => d._id === m._id))
          .map(m => m.product_id || m._id)
      )

      const dbMenuIds = new Set(dbMenu.map(m => m.product_id || m._id))
      const todayMenu = [
        ...dbMenu,
        ...this.data.todayMenu.filter(m => {
          const id = m.product_id || m._id
          return localSelectedIds.has(id) && !dbMenuIds.has(id)
        })
      ]

      const todayIds = new Set(todayMenu.map(m => m.product_id || m._id))
      const unlistedProducts = allProducts
        .filter(p => !todayIds.has(p._id))
        .map(p => {
          const localId = p._id
          const isSelected = localSelectedIds.has(localId)
          return { ...p, product_id: p._id, isSelected }
        })

      console.log('[Admin:Menu] 数据刷新', {
        date: this.data.selectedDate,
        db发布: dbMenu.length,
        本地选择: localSelectedIds.size,
        合并后: todayMenu.length
      })

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
    
    if (product.isSelected) {
      const targetId = product.product_id || product._id
      this.setData({
        todayMenu: this.data.todayMenu.filter(m => (m.product_id || m._id) !== targetId),
        unlistedProducts: this.data.unlistedProducts.filter((_, i) => i !== index)
      })
    } else {
      this.setData({
        todayMenu: [...this.data.todayMenu, { ...product, qty: 0 }],
        unlistedProducts: this.data.unlistedProducts.filter((_, i) => i !== index)
      })
    }
  },

  removeFromMenu(e) {
    const index = e.currentTarget.dataset.index
    if (index === undefined) return
    const product = this.data.todayMenu[index]
    const productToAdd = { ...product, isSelected: false }
    
    this.setData({
      todayMenu: this.data.todayMenu.filter((_, i) => i !== index),
      unlistedProducts: [...this.data.unlistedProducts, productToAdd].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'))
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
    
    console.log('[Admin:Menu] 发布菜单:', { date: this.data.selectedDate, count: postItems.length, items: postItems.map(i => i.name) })
    
    wx.showLoading({ title: '发布中...' })
    wx.cloud.callFunction({
      name: 'publishMenu',
      data: { items: postItems, date: this.data.selectedDate }
    }).then(res => {
      console.log('[Admin:Menu] 发布结果原始:', res)
      wx.hideLoading()
      if (!res) {
        console.error('[Admin:Menu] 结果为空')
        wx.showToast({ title: '网络错误', icon: 'error' })
        return
      }
      const r = res.result
      console.log('[Admin:Menu] 发布结果:', r)
      if (r && r.success) {
        wx.showToast({ title: `已发布 ${r.data.count} 种`, icon: 'success' })
        this.loadPublishData()
      } else {
        wx.showModal({ title: '发布失败', content: r?.message || JSON.stringify(r), showCancel: false })
      }
    }).catch(err => {
      console.error('[Admin:Menu] 调用异常:', err)
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
    this.setData({ loading: true })
    getRecentMenuDates().then(res => {
      const dateList = res.data || []
      const historyPromises = dateList.map(date => getMenuByDate(date))
      return Promise.all(historyPromises)
    }).then(menuResults => {
      const historyDates = (dateList || []).map((date, i) => ({
        date,
        items: (menuResults[i]?.data || []).map(m => ({ name: m.name, price: m.price })),
        expanded: false
      }))
      this.setData({ historyDates, loading: false })
    }).catch(err => {
      console.error('[Admin:Menu] 历史加载失败:', err)
      this.setData({ loading: false })
    })
  },

  toggleExpand(e) {
    const index = e.currentTarget.dataset.index
    const historyDates = [...this.data.historyDates]
    historyDates[index].expanded = !historyDates[index].expanded
    this.setData({ historyDates })
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