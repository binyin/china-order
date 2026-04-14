// pages/admin/menu.js
const app = getApp()
const { getAllProducts, getTodayMenu, getMenuByDate, addMenuItem, removeMenuItem, updateMenuStock, getMenuHistory, getBJDateStr } = require('../../utils/db')

Page({
  data: {
    activeTab: 'publish',
    selectedDate: '',
    dateIndex: 1,
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
    for (let i = 0; i < 3; i++) {
      const d = new Date(today.getTime() + i * 24 * 3600 * 1000)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      let label = ''
      if (i === 0) label = '今天'
      else if (i === 1) label = '明天'
      else label = '后天'
      dates.push({ date: dateStr, label })
    }
    this.setData({
      dateList: dates,
      selectedDate: dates[1].date,
      dateIndex: 1
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

      // --- 优化日志：折叠显示 ---
      console.group('[Admin:Menu] 数据刷新');
      console.log('今日上架数量:', todayMenu.length);
      console.log('产品池总数:', allProducts.length);
      console.debug('详情数据:', { todayMenu, allProducts });
      console.groupEnd();

      const todayIds = new Set(todayMenu.map(m => m.product_id))
      const unlistedProducts = allProducts
        .filter(p => !todayIds.has(p._id))
        .map(p => ({ ...p, product_id: p._id, initStock: 50 }))

      this.setData({ todayMenu, unlistedProducts, loading: false })
    } catch (err) {
      console.error('[Admin:Menu] 初始化加载失败:', err);
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'error' })
    }
  },

  // 添加产品到今日菜单 (上架)
  addToMenu(e) {
    const index = e.currentTarget.dataset.index
    const product = this.data.unlistedProducts[index]
    const targetDate = this.data.selectedDate

    const postData = {
      product_id: product._id,
      name: product.name,
      price: Number(product.price),
      unit: product.unit || '个',
      image_url: product.image_url || '',
      stock: Number(product.initStock) || 50,
      date: targetDate
    }

    this.setData({ loading: true })
    addMenuItem(postData).then((res) => {
      wx.showToast({ title: '已添加', icon: 'success' })
      this.loadPublishData()
    }).catch((err) => {
      console.error(`[Admin:Menu] 上架失败 [${postData.name}]:`, err);
      this.setData({ loading: false })
      wx.showToast({ title: '添加失败', icon: 'error' })
    })
  },

  // 从今日菜单取消上架
  removeFromMenu(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.todayMenu.find(m => m._id === id)
    
    // 优化日志格式
    console.group('[Admin:Menu] 下架产品')
    console.log('产品ID:', id)
    console.log('产品名:', item?.name || '未知')
    console.groupEnd()
    
    this.setData({ loading: true })
    removeMenuItem(id).then(() => {
      wx.vibrateShort()
      wx.showToast({ title: '已取消', icon: 'success' })
      this.loadPublishData()
    }).catch((err) => {
      console.error('[Admin:Menu] 下架失败:', err);
      this.setData({ loading: false })
      wx.showToast({ title: '操作失败', icon: 'error' })
    })
  },

  // 今日菜单库存保存 (失焦触发)
  saveMenuStock(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.todayMenu.find(m => m._id === id)
    if (!item) return
    
    updateMenuStock(id, item.stock).then(() => {
      console.log(`[Admin:Menu] 库存更新成功: ${item.name} -> ${item.stock}`);
      wx.showToast({ title: '库存已更新', icon: 'success' })
    }).catch(err => {
      console.error('[Admin:Menu] 库存更新失败:', err);
    })
  },

  onMenuStockInput(e) {
    const id = e.currentTarget.dataset.id
    const val = parseInt(e.detail.value) || 0
    const todayMenu = this.data.todayMenu.map(m =>
      m._id === id ? { ...m, stock: val } : m
    )
    this.setData({ todayMenu })
  },

  onInitStockInput(e) {
    const index = e.currentTarget.dataset.index
    const val = parseInt(e.detail.value) || 0
    const unlistedProducts = this.data.unlistedProducts
    unlistedProducts[index].initStock = val
    this.setData({ unlistedProducts })
  },

  publishTodayMenu() {
    if (this.data.todayMenu.length === 0) {
      wx.showToast({ title: '请先选择产品', icon: 'none' })
      return
    }
    const items = this.data.todayMenu.map(m => ({
      product_id: m.product_id,
      name: m.name,
      price: m.price,
      unit: m.unit,
      image_url: m.image_url,
      stock: m.stock
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
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '网络错误', icon: 'error' })
    })
  },

  loadHistory() {
    getMenuHistory().then(res => {
      const dateMap = {}
      res.data.forEach(item => {
        if (!dateMap[item.date]) {
          dateMap[item.date] = { date: item.date, items: [] }
        }
        dateMap[item.date].items.push({ 
          product_id: item.product_id, 
          name: item.name, 
          price: item.price 
        })
      })
      const historyDates = Object.values(dateMap).sort((a, b) => b.date.localeCompare(a.date))
      this.setData({ historyDates })
      console.log('[Admin:Menu] 历史记录加载完成，条数:', historyDates.length);
    }).catch(err => {
      console.error('[Admin:Menu] 历史加载失败:', err);
    })
  },

  reuseMenu(e) {
    const date = e.currentTarget.dataset.date
    const dayData = this.data.historyDates.find(d => d.date === date)
    if (!dayData) return

    wx.showModal({
      title: '再次发布',
      content: `将 ${date} 的菜单发布为今日菜单？`,
      success: res => {
        if (!res.confirm) return

        // 优化日志格式
        console.group('[Admin:Menu] 复用历史菜单')
        console.log('历史日期:', date)
        console.log('产品数量:', dayData.items.length)
        console.groupEnd()
        const allProducts = [...this.data.todayMenu, ...this.data.unlistedProducts]
        const items = dayData.items.map(h => {
          const found = allProducts.find(p => p.product_id === h.product_id || p._id === h.product_id)
          if (!found) {
            const foundByName = allProducts.find(p => p.name === h.name)
            if (foundByName) {
              return {
                product_id: foundByName.product_id || foundByName._id,
                name: foundByName.name,
                price: foundByName.price,
                unit: foundByName.unit || '个',
                image_url: foundByName.image_url || '',
                stock: 50
              }
            }
            return null
          }
          return {
            product_id: found.product_id || found._id,
            name: found.name,
            price: found.price,
            unit: found.unit || '个',
            image_url: found.image_url || '',
            stock: 50
          }
        }).filter(Boolean)

        if (items.length === 0) {
          console.warn('[Admin:Menu] 复用匹配失败: 无有效产品项');
          wx.showToast({ title: '产品信息不匹配', icon: 'none' }); 
          return
        }

        wx.showLoading({ title: '发布中...' })
        wx.cloud.callFunction({
          name: 'publishMenu',
          data: { items, date: this.data.selectedDate }
        }).then(result => {
          wx.hideLoading()
          const r = result.result
          if (r.success) {
            console.log(`[Admin:Menu] 复用发布成功: ${r.data.count} 种，日期: ${r.data.date}`);
            wx.showToast({ title: `已发布 ${r.data.count} 种`, icon: 'success' })
            this.loadPublishData()
          } else {
            console.error('[Admin:Menu] 复用发布失败说明:', r.message);
            wx.showModal({ title: '发布失败', content: r.message, showCancel: false })
          }
        }).catch(err => {
          wx.hideLoading()
          console.error('[Admin:Menu] 复用发布网络错误:', err)
          wx.showToast({ title: '网络错误', icon: 'error' })
        })
      }
    })
  }
})
