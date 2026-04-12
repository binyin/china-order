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
    needAuth: false,  // 新增：是否需要授权
    statusText: {
      pending: '待取货',
      completed: '已完成',
      cancelled: '已取消'
    }
  },

  onLoad() {
    this.checkAuthStatus()
  },

  onShow() {
    this.checkAuthStatus()
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
      // 修改：过滤掉状态为'cancelled'的订单，并且只显示当天的订单
      const todayOrders = (res.data || []).filter(o => 
        o.date === todayStr && o.status !== 'cancelled'
      )
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

  // 取消订单中的单个产品
  cancelOrderItem(e) {
    const { orderid, productid } = e.currentTarget.dataset
    
    console.group('[User:Index] 取消订单产品')
    console.log('订单ID:', orderid, '产品ID:', productid)
    console.groupEnd()
    
    wx.cloud.callFunction({
      name: 'cancelOrderItem',
      data: { 
        orderId: orderid, 
        productId: productid 
      }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({ title: '产品取消成功', icon: 'success' })
        this.loadMyOrders()
        this.loadMenu()
      } else {
        wx.showToast({ title: res.result.message || '取消失败', icon: 'none' })
      }
    }).catch(() => {
      wx.showToast({ title: '网络错误，请重试', icon: 'error' })
    })
  },

  // 检查授权状态
  checkAuthStatus() {
    // 检查是否已授权
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          // 已授权，获取用户信息
          this.getUserInfo()
        } else {
          // 未授权，显示授权按钮
          this.setData({ 
            needAuth: true,
            loading: false 
          })
        }
      },
      fail: err => {
        console.error('检查授权失败', err)
      }
    })
  },

  // 获取用户信息
  getUserInfo() {
    wx.getUserInfo({
      success: res => {
        const userInfo = res.userInfo
        // 保存到本地存储
        wx.setStorageSync('userProfile', { 
          nickname: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl 
        })
        
        this.setData({
          customerName: userInfo.nickName,
          hasProfile: true,
          needAuth: false
        })
        
        // 加载菜单和订单
        this.loadMenu()
        this.loadMyOrders()
      },
      fail: err => {
        console.error('获取用户信息失败', err)
        wx.showToast({ title: '获取用户信息失败', icon: 'none' })
      }
    })
  },

  // 授权成功回调
  onAuthSuccess(e) {
    if (e.detail.userInfo) {
      // 用户同意授权
      this.getUserInfo()
    } else {
      wx.showToast({ 
        title: '需要授权才能使用预定功能', 
        icon: 'none',
        duration: 2000
      })
    }
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
