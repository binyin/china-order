// pages/user/index.js
const { getTodayMenu, getMyOrders } = require('../../utils/db')

Page({
  data: {
    loading: true,
    menuList: [],
    totalPrice: '0.00',
    hasSelected: false,
    submittedOrders: [],
    showModal: false,
    customerName: '',
    orderSummary: [],
    submitting: false,
    hasProfile: false,
    statusText: {
      pending: '待取货',
      completed: '已完成',
      cancelled: '已取消'
    }
  },

  onLoad() {
    // 读取缓存的昵称
    const cached = wx.getStorageSync('userProfile') || {}
    if (cached.nickname) {
      this.setData({
        customerName: cached.nickname,
        hasProfile: true
      })
    }
    this.loadMenu()
    this.loadMyOrders()
  },

  onShow() {
    this.loadMenu()
    this.loadMyOrders()
  },

  loadMenu() {
    this.setData({ loading: true })
    getTodayMenu().then(res => {
      const list = res.data.map(item => ({ ...item, qty: 0 }))
      this.setData({ menuList: list, loading: false })
      this.calcTotal()
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'error' })
    })
  },

  increase(e) {
    const index = e.currentTarget.dataset.index
    const list = this.data.menuList
    const item = list[index]
    const remaining = item.stock - (item.ordered || 0)
    if (item.qty >= remaining) {
      wx.showToast({ title: `最多预定 ${remaining} 件`, icon: 'none' })
      return
    }
    list[index].qty = (item.qty || 0) + 1
    this.setData({ menuList: list })
    this.calcTotal()
  },

  decrease(e) {
    const index = e.currentTarget.dataset.index
    const list = this.data.menuList
    if (list[index].qty > 0) {
      list[index].qty -= 1
      this.setData({ menuList: list })
      this.calcTotal()
    }
  },

  calcTotal() {
    const list = this.data.menuList
    let total = 0
    let hasSelected = false
    list.forEach(item => {
      if (item.qty > 0) {
        total += item.price * item.qty
        hasSelected = true
      }
    })
    this.setData({ totalPrice: total.toFixed(2), hasSelected })
  },

  cancelAllItems() {
    const list = this.data.menuList.map(item => ({ ...item, qty: 0 }))
    this.setData({ menuList: list })
    this.calcTotal()
  },

  loadMyOrders() {
    getMyOrders().then(res => {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const todayOrders = (res.data || []).filter(o => o.date === todayStr)
      this.setData({ submittedOrders: todayOrders })
    }).catch(() => {})
  },

  submitOrder() {
    const summary = this.data.menuList
      .filter(item => item.qty > 0)
      .map(item => ({
        name: item.name,
        qty: item.qty,
        subtotal: (item.price * item.qty).toFixed(2)
      }))
    this.setData({ showModal: true, orderSummary: summary })
  },

  closeModal() {
    this.setData({ showModal: false })
  },

  // 名字输入框变化
  onNameInput(e) {
    this.setData({ customerName: e.detail.value })
  },

  confirmOrder() {
    const name = this.data.customerName.trim()
    if (!name) {
      wx.showToast({ title: '请输入您的姓名', icon: 'none' })
      return
    }

    // 缓存昵称，标记已有身份
    wx.setStorageSync('userProfile', { nickname: name })
    this.setData({ hasProfile: true })

    const items = this.data.menuList
      .filter(i => i.qty > 0)
      .map(i => ({ product_id: i._id, name: i.name, num: i.qty }))

    // 添加日志
    console.group('[User:Index] 提交订单')
    console.log('用户:', name)
    console.log('商品数量:', items.length)
    console.log('总价:', this.data.totalPrice)
    console.groupEnd()

    this.setData({ submitting: true })

    wx.cloud.callFunction({
      name: 'createOrder',
      data: {
        items,
        total_price: parseFloat(this.data.totalPrice),
        customer_name: name
      }
    }).then(res => {
      this.setData({ submitting: false })
      const result = res.result
      if (result.success) {
        const menuList = this.data.menuList.map(i => ({ ...i, qty: 0 }))
        this.setData({ menuList, showModal: false })
        this.calcTotal()
        wx.showToast({ title: '预定成功！', icon: 'success' })
        this.loadMenu()
        this.loadMyOrders()
      } else {
        wx.showModal({ title: '提交失败', content: result.message, showCancel: false })
      }
    }).catch(() => {
      this.setData({ submitting: false })
      wx.showToast({ title: '网络错误，请重试', icon: 'error' })
    })
  },

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id
    // 添加日志
    console.group('[User:Index] 取消订单')
    console.log('订单ID:', id)
    console.groupEnd()
    
    wx.cloud.callFunction({
      name: 'cancelOrder',
      data: { orderId: id }
    }).then(res => {
      if (res.result.success) {
        wx.vibrateShort()
        wx.showToast({ title: '已取消', icon: 'success' })
        this.loadMenu()
        this.loadMyOrders()
      } else {
        wx.showToast({ title: res.result.message || '取消失败', icon: 'none' })
      }
    }).catch(() => {
      wx.showToast({ title: '取消失败', icon: 'error' })
    })
  },

  // 修改昵称
  editProfile() {
    this.setData({ showModal: true, orderSummary: [] })
  },

  // 保存昵称（从修改信息弹窗）
  saveProfile() {
    const name = this.data.customerName.trim()
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    wx.setStorageSync('userProfile', { nickname: name })
    this.setData({ hasProfile: true, showModal: false })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/login' })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/user/history' })
  }
})
