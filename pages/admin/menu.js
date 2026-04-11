// pages/admin/menu.js
const app = getApp()
const { getAllProducts, getTodayMenu, addMenuItem, removeMenuItem, updateMenuStock, getMenuHistory } = require('../../utils/db')

Page({
  data: {
    activeTab: 'publish',
    todayMenu: [],        // 今日已上架产品
    unlistedProducts: [], // 产品池中未上架的产品（带 initStock）
    historyDates: [],
    loading: false
  },

  onLoad() {
    if (!app.globalData.adminInfo) {
      wx.redirectTo({ url: '/pages/admin/login' })
      return
    }
    this.loadPublishData()
  },

  onShow() {
    this.loadPublishData()
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
        getTodayMenu(),
        getAllProducts()
      ])

      const todayMenu = menuRes.data || []
      const todayIds = new Set(todayMenu.map(m => m.product_id))

      const unlistedProducts = prodRes.data
        .filter(p => !todayIds.has(p._id))
        .map(p => ({ ...p, initStock: 50 }))

      this.setData({ todayMenu, unlistedProducts, loading: false })
    } catch {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'error' })
    }
  },

  // 添加产品到今日菜单
  addToMenu(e) {
    const index = e.currentTarget.dataset.index
    const product = this.data.unlistedProducts[index]

    this.setData({ loading: true })
    addMenuItem({
      product_id: product._id,
      name: product.name,
      price: product.price,
      unit: product.unit || '个',
      image_url: product.image_url || '',
      stock: product.initStock || 50
    }).then(() => {
      wx.showToast({ title: '已添加', icon: 'success' })
      this.loadPublishData()
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '添加失败', icon: 'error' })
    })
  },

  // 从今日菜单取消上架 - 无二次确认
  removeFromMenu(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ loading: true })
    removeMenuItem(id).then(() => {
      wx.vibrateShort()
      wx.showToast({ title: '已取消', icon: 'success' })
      this.loadPublishData()
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '操作失败', icon: 'error' })
    })
  },

  // 今日菜单库存输入
  onMenuStockInput(e) {
    const id = e.currentTarget.dataset.id
    const val = parseInt(e.detail.value) || 0
    const todayMenu = this.data.todayMenu.map(m =>
      m._id === id ? { ...m, stock: val } : m
    )
    this.setData({ todayMenu })
  },

  // 今日菜单库存保存（失焦时）
  saveMenuStock(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.todayMenu.find(m => m._id === id)
    if (!item) return
    updateMenuStock(id, item.stock).then(() => {
      wx.showToast({ title: '库存已更新', icon: 'success' })
    })
  },

  // 产品池库存输入
  onInitStockInput(e) {
    const index = e.currentTarget.dataset.index
    const val = parseInt(e.detail.value) || 0
    const unlistedProducts = this.data.unlistedProducts
    unlistedProducts[index].initStock = val
    this.setData({ unlistedProducts })
  },

  loadHistory() {
    getMenuHistory().then(res => {
      const dateMap = {}
      res.data.forEach(item => {
        if (!dateMap[item.date]) {
          dateMap[item.date] = { date: item.date, items: [] }
        }
        dateMap[item.date].items.push({ name: item.name, price: item.price })
      })
      const historyDates = Object.values(dateMap).sort((a, b) => b.date.localeCompare(a.date))
      this.setData({ historyDates })
    })
  },

  reuseMenu(e) {
    const date = e.currentTarget.dataset.date
    const dayData = this.data.historyDates.find(d => d.date === date)
    if (!dayData) return

    wx.showModal({
      title: '再次发布',
      content: `将 ${date} 的菜单发布为今日菜单？（已有今日菜单将被覆盖）`,
      success: res => {
        if (!res.confirm) return

        // 从产品池匹配出完整信息
        const allProducts = [...this.data.todayMenu, ...this.data.unlistedProducts]
        const items = dayData.items.map(h => {
          const found = allProducts.find(p => p.name === h.name)
          return found ? {
            product_id: found.product_id || found._id,
            name: found.name,
            price: found.price,
            unit: found.unit || '个',
            image_url: found.image_url || '',
            stock: 50
          } : null
        }).filter(Boolean)

        if (items.length === 0) {
          wx.showToast({ title: '产品信息不匹配', icon: 'none' }); return
        }

        wx.showLoading({ title: '发布中...' })
        wx.cloud.callFunction({
          name: 'publishMenu',
          data: { items }
        }).then(result => {
          wx.hideLoading()
          const r = result.result
          if (r.success) {
            wx.showToast({ title: `已发布 ${r.data.count} 种`, icon: 'success' })
            this.loadPublishData()
          } else {
            wx.showModal({ title: '发布失败', content: r.message, showCancel: false })
          }
        }).catch(() => {
          wx.hideLoading()
          wx.showToast({ title: '网络错误', icon: 'error' })
        })
      }
    })
  }
})
