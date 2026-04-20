// pages/user/index.js
const { getLatestMenu, getMyOrders } = require('../../utils/db')
const logger = require('../../utils/logger')

const TAG = 'user:index'

Page({
  data: {
    loading: true,
    menuList: [],
    totalPrice: '0.00',
    hasSelected: false,
    submittedOrders: [],
    showModal: false,
    customerName: '',
    customerPhone: '',
    orderSummary: [],
    submitting: false,
    hasProfile: false,
    needAuth: false,
    loadingOrders: false,
    dateTime: '',
    tempNickname: '',
    tempAvatarUrl: '',
    statusText: {
      pending: '待取货',
      completed: '已完成',
      cancelled: '已取消'
    }
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    logger.info(TAG + ':onLoad', { 
      time: new Date().toISOString(),
      system: systemInfo,
      version: wx.envVersion
    })
    this.setDateTime()
    this.checkAuthStatus()
  },

  setDateTime() {
    const now = new Date()
    const month = now.getMonth() + 1
    const day = now.getDate()
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekDay = weekDays[now.getDay()]
    this.setData({ dateTime: `${month}月${day}日 ${weekDay}` })
  },

  onShow() {
    const now = Date.now()
    const isFromPreview = this._lastHideTime && (now - this._lastHideTime) < 2000
    logger.info(TAG + ':onShow', { time: new Date().toISOString(), isFromPreview, lastHide: this._lastHideTime })
    
    if (isFromPreview) {
      this._lastHideTime = null
      return
    }
    
    this.checkAuthStatus()
    this.loadMenu()
    this.loadMyOrders()
  },

  onHide() {
    this._lastHideTime = Date.now()
    logger.info(TAG + ':onHide', { time: new Date().toISOString() })
  },

  getTodayStr() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  },

loadMenu() {
    logger.info(TAG + ':loadMenu', { start: true })
    this.setData({ loading: true })
    const todayStr = this.getTodayStr()
    return getLatestMenu().then(res => {
      const list = res.data.map(item => ({ 
        ...item, 
        qty: 0,
        disabled: false
      }))
      logger.info(TAG + ':loadMenu', { count: list.length, date: res.menuInfo?.date, today: todayStr })
      
      if (list.length > 0) {
        const menuDate = res.menuInfo?.date || ''
        const isExpired = menuDate < todayStr
        
        const processedList = list.map(item => ({
          ...item,
          disabled: isExpired
        }))
        
        const dateParts = menuDate.split('-')
        const month = parseInt(dateParts[1])
        const day = parseInt(dateParts[2])
        
        this.setData({ 
          dateTime: isExpired ? `${month}月${day}日(已过期)` : `${month}月${day}日`,
          menuList: processedList,
          loading: false
        })
        
        this.calcTotal()
      } else {
        this.setData({ menuList: [], dateTime: '', loading: false })
      }
    }).catch((err) => {
      this.setData({ loading: false })
      logger.error(TAG + ':loadMenu', { error: err.message || String(err) })
      wx.showToast({ title: '加载失败', icon: 'error' })
    })
  },

  MAX_ORDER_QTY: 50,

  increase(e) {
    const index = e.currentTarget.dataset.index
    const list = this.data.menuList
    const item = list[index]
    if (item.disabled) {
      wx.showToast({ title: '该菜单已过期', icon: 'none' })
      return
    }
    const currentQty = list[index].qty || 0
    if (currentQty >= this.MAX_ORDER_QTY) {
      wx.showToast({ title: `每种最多订${this.MAX_ORDER_QTY}个`, icon: 'none' })
      return
    }
    list[index].qty = currentQty + 1
    this.setData({ menuList: list })
    logger.info(TAG + ':increase', { index, qty: list[index].qty })
    this.calcTotal()
  },

  decrease(e) {
    const index = e.currentTarget.dataset.index
    const list = this.data.menuList
    const item = list[index]
    if (item.disabled || !list[index].qty) {
      return
    }
    list[index].qty -= 1
    this.setData({ menuList: list })
    logger.info(TAG + ':decrease', { index, qty: list[index].qty })
    this.calcTotal()
  },

  editQty(e) {
    const index = e.currentTarget.dataset.index
    const list = this.data.menuList
    const item = list[index]
    if (item.disabled) {
      return
    }
    const currentQty = item.qty || 0
    wx.showModal({
      title: '输入数量',
      editable: true,
      placeholderText: '请输入1-50的数字',
      content: String(currentQty),
      success: (res) => {
        if (res.confirm) {
          const content = (res.content || '').trim()
          const inputQty = parseInt(content)
          const maxQty = this.MAX_ORDER_QTY
          
          if (content === '' || isNaN(inputQty)) {
            wx.showToast({ title: '请输入有效数字', icon: 'none' })
            return
          }
          
          if (inputQty < 0 || inputQty > maxQty) {
            wx.showToast({ title: `超出范围(0-${maxQty})`, icon: 'none' })
            return
          }
          
          list[index].qty = inputQty
          this.setData({ menuList: list })
          logger.info(TAG + ':editQty', { index, qty: inputQty })
          this.calcTotal()
        }
      }
    })
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url
    logger.info(TAG + ':previewImage', { url, exist: !!url })
    if (!url) return
    wx.previewImage({
      urls: [url],
      success: () => logger.info(TAG + ':previewImage', { action: 'open' }),
      fail: (err) => logger.error(TAG + ':previewImage', { error: err.message })
    })
  },

  onImageError(e) {
    const index = e.currentTarget.dataset.index
    const list = this.data.menuList
    if (list[index]) {
      logger.warn(TAG + ':onImageError', { index, url: list[index].image_url })
      list[index].image_url = ''
      this.setData({ menuList: list })
    }
  },

  async onPullDownRefresh() {
    logger.info(TAG + ':onPullDownRefresh', { action: 'refresh' })
    await this.loadMenu()
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    logger.info(TAG + ':onReachBottom', { action: 'loadMore' })
    this.loadMyOrders()
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
    logger.info(TAG + ':cancelAllItems', { action: 'clear' })
    const list = this.data.menuList.map(item => ({ ...item, qty: 0 }))
    this.setData({ menuList: list })
    this.calcTotal()
  },

  loadMyOrders() {
    if (this.loadingOrders) return
    this.loadingOrders = true
    logger.info(TAG + ':loadMyOrders', { start: true })
    
    getMyOrders().then(orders => {
      this.setData({ submittedOrders: orders || [] })
      this.loadingOrders = false
      logger.info(TAG + ':loadMyOrders', { success: true, count: orders?.length || 0 })
    }).catch((err) => {
      this.loadingOrders = false
      logger.error(TAG + ':loadMyOrders', { error: err.message || String(err) })
    })
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
    let value = (e.detail.value || '').replace(/[<>\'\"\\]/g, '').slice(0, 20)
    this.setData({ customerName: value })
  },

  // 电话输入框变化
  onPhoneInput(e) {
    let value = (e.detail.value || '').replace(/[^\d]/g, '').slice(0, 11)
    this.setData({ customerPhone: value })
  },

  confirmOrder() {
    const userProfile = wx.getStorageSync('userProfile') || {}
    const tempNickname = this.data.tempNickname || ''
    const tempAvatarUrl = this.data.tempAvatarUrl || ''
    const name = (this.data.customerName || '').trim()
    const phone = this.data.customerPhone || ''

    if (!this.data.hasProfile) {
      if (!tempNickname) {
        wx.showToast({ title: '请输入预订人', icon: 'none' })
        return
      }
      if (!tempAvatarUrl) {
        wx.showToast({ title: '请选择头像', icon: 'none' })
        return
      }
    }

    const nickname = tempNickname || userProfile.nickname || name
    const avatarUrl = tempAvatarUrl || userProfile.avatarUrl || ''

    wx.setStorageSync('userProfile', { 
      nickname: nickname,
      avatarUrl: avatarUrl,
      phone: phone
    })
    this.setData({ 
      hasProfile: true,
      tempNickname: '',
      tempAvatarUrl: ''
    })

    const items = this.data.menuList
      .filter(i => i.qty > 0)
      .map(i => ({ 
        product_id: (i._id || '').toString().slice(0, 100), 
        name: (i.name || '').slice(0, 50), 
        num: Math.min(Math.max(1, parseInt(i.qty) || 0), 50)
      }))

    if (items.length === 0) {
      wx.showToast({ title: '请选择产品', icon: 'none' })
      return
    }

    const customerName = userProfile.nickname || nickname
    logger.info(TAG + ':confirmOrder', { customer: customerName, itemCount: items.length, totalPrice: this.data.totalPrice })

    this.setData({ submitting: true })

    const savedProfile = wx.getStorageSync('userProfile') || {}
    
    wx.cloud.callFunction({
      name: 'createOrder',
      data: {
        items,
        total_price: parseFloat(this.data.totalPrice) || 0,
        customer_name: customerName,
        customer_phone: phone,
        customer_nickname: (savedProfile.nickname || '').slice(0, 50),
        customer_avatar: savedProfile.avatarUrl || ''
      }
    }).then(res => {
      this.setData({ submitting: false })
      const result = res.result
      if (result.success) {
        wx.cloud.callFunction({
          name: 'saveUser',
          data: {
            nickname: savedProfile.nickname,
            avatarUrl: savedProfile.avatarUrl,
            phone: phone || null
          }
        }).catch(e => logger.error(TAG + ':saveUser', { error: e.message }))
        const menuList = this.data.menuList.map(i => ({ ...i, qty: 0 }))
        this.setData({ menuList, showModal: false })
        logger.info(TAG + ':confirmOrder', { success: true, orderId: result.orderId })
        this.calcTotal()
        wx.showToast({ title: '预定成功！', icon: 'success' })
        this.loadMenu()
        this.loadMyOrders()
      } else {
        logger.warn(TAG + ':confirmOrder', { success: false, message: result.message })
        wx.showModal({ title: '提交失败', content: result.message, showCancel: false })
      }
    }).catch((err) => {
      this.setData({ submitting: false })
      logger.error(TAG + ':confirmOrder', { error: err.message || String(err) })
      wx.showToast({ title: '网络错误，请重试', icon: 'error' })
    })
  },

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id
    
    logger.info(TAG + ':cancelOrder', { orderId: id })
    this.createOrderExitAnimation(id)
    
    wx.showLoading({ title: '处理中', mask: true })
    
    wx.cloud.callFunction({
      name: 'cancelOrder',
      data: { orderId: id }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        wx.vibrateShort()
        logger.info(TAG + ':cancelOrder', { success: true, orderId: id })
        wx.showToast({ 
          title: '已取消', 
          icon: 'success',
          duration: 1500
        })
        this.updateMenuStock(id)
      } else {
        logger.warn(TAG + ':cancelOrder', { success: false, message: res.result.message })
        this.loadMyOrders()
        wx.showToast({ title: res.result.message || '取消失败', icon: 'none' })
      }
    }).catch((err) => {
      wx.hideLoading()
      logger.error(TAG + ':cancelOrder', { error: err.message || String(err) })
      this.loadMyOrders()
      wx.showToast({ title: '取消失败', icon: 'error' })
    })
  },

  cancelOrderItem(e) {
    const { orderid, productid } = e.currentTarget.dataset
    
    logger.info(TAG + ':cancelOrderItem', { orderId: orderid, productId: productid })
    
    const orders = this.data.submittedOrders.map(order => {
      if (order._id === orderid) {
        const updatedItems = order.items.map(item => {
          if (item.product_id === productid) {
            return { ...item, item_status: 'cancelling' }
          }
          return item
        })
        return { ...order, items: updatedItems }
      }
      return order
    })
    
    this.setData({ submittedOrders: orders })
    
    wx.cloud.callFunction({
      name: 'cancelOrderItem',
      data: { 
        orderId: orderid, 
        productId: productid 
      }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({ 
          title: '产品取消成功', 
          icon: 'success',
          duration: 1500
        })
        
        const updatedOrders = this.data.submittedOrders.map(order => {
          if (order._id === orderid) {
            const items = order.items
              .map(item => {
                if (item.product_id === productid) {
                  return { ...item, item_status: 'cancelled' }
                }
                return item
              })
              .filter(item => item.item_status !== 'cancelled')
        
            if (items.length === 0) {
              return null
            }
            return { ...order, items }
          }
          return order
        }).filter(order => order !== null)
      
        this.setData({ submittedOrders: updatedOrders })
        logger.info(TAG + ':cancelOrderItem', { success: true, orderId: orderid, productId: productid })
        this.updateMenuStock(orderid)
      } else {
        logger.warn(TAG + ':cancelOrderItem', { success: false, message: res.result.message })
        this.loadMyOrders()
        wx.showToast({ title: res.result.message || '取消失败', icon: 'none' })
      }
    }).catch((err) => {
      logger.error(TAG + ':cancelOrderItem', { error: err.message || String(err) })
      this.loadMyOrders()
      wx.showToast({ title: '网络错误，请重试', icon: 'error' })
    })
  },

  // 更新菜单库存（局部更新，避免整个页面重新加载）
  updateMenuStock(orderId) {
    // 这里可以调用一个专门的云函数来获取订单详情并更新库存
    // 但为了简化，我们可以选择性地重新加载菜单数据
    const { menuList } = this.data
    
    // 模拟更新：重新获取今日菜单，但使用更平滑的方式
    getLatestMenu().then(res => {
      const todayMenu = res.data
      const updatedMenuList = menuList.map(menuItem => {
        const todayItem = todayMenu.find(item => item._id === menuItem._id)
        if (todayItem) {
          return {
            ...menuItem,
            ordered: todayItem.ordered,
            stock: todayItem.stock
          }
        }
        return menuItem
      })
      
      // 使用动画效果更新数据
      this.setData({
        menuList: updatedMenuList
      })
    }).catch(() => {
      // 如果获取失败，可以延迟一小段时间后重新加载
      setTimeout(() => {
        this.loadMenu()
      }, 500)
    })
  },

  // 创建订单消失动画
  createOrderExitAnimation(orderId) {
    const animation = wx.createAnimation({
      duration: 300,
      timingFunction: 'ease-out'
    })
    
    animation.opacity(0).height(0).step()
    
    const orders = this.data.submittedOrders.map(order => {
      if (order._id === orderId) {
        return { ...order, animationData: animation.export() }
      }
      return order
    })
    
    this.setData({ submittedOrders: orders })
    
    // 300ms后移除该订单
    setTimeout(() => {
      const filteredOrders = orders.filter(o => o._id !== orderId)
      this.setData({ submittedOrders: filteredOrders })
    }, 300)
  },

  checkAuthStatus() {
    logger.info(TAG + ':checkAuthStatus', { check: true })
    const userProfile = wx.getStorageSync('userProfile')
    if (userProfile && userProfile.nickname) {
      this.setData({
        customerName: userProfile.nickname,
        customerPhone: userProfile.phone || '',
        hasProfile: true
      })
      logger.info(TAG + ':checkAuthStatus', { fromStorage: true, nickname: userProfile.nickname })
    } else {
      this.setData({
        customerName: '',
        customerPhone: '',
        hasProfile: false
      })
    }
    this.loadMenu()
    this.loadMyOrders()
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    logger.info(TAG + ':onChooseAvatar', { avatarUrl: !!avatarUrl })
    this.setData({ tempAvatarUrl: avatarUrl })
  },

  onNicknameInput(e) {
    const nickname = (e.detail.value || '').trim()
    this.setData({ tempNickname: nickname })
  },

  onAuthConfirm() {
    const nickname = (this.data.tempNickname || '').trim()
    const avatarUrl = this.data.tempAvatarUrl || ''
    
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (!avatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' })
      return
    }

    logger.info(TAG + ':onAuthConfirm', { nickname, hasAvatar: !!avatarUrl })
    
    wx.setStorageSync('userProfile', { 
      nickname: nickname,
      avatarUrl: avatarUrl 
    })
    
    this.setData({
      customerName: nickname,
      hasProfile: true,
      needAuth: false
    })

    wx.cloud.callFunction({
      name: 'saveUser',
      data: { nickname, avatarUrl }
    }).then(r => {
      logger.info(TAG + ':saveUser', { success: r.result && r.result.success })
    }).catch(e => {
      logger.error(TAG + ':saveUser', { error: e.message })
    })

    this.loadMenu()
    this.loadMyOrders()
  },

  getUserInfo() {
    logger.info(TAG + ':getUserInfo', { get: true, deprecated: true })
    wx.showToast({ title: '请使用新版授权', icon: 'none' })
  },

  onAuthSuccess(e) {
    if (e.detail.userInfo) {
      this.getUserInfo()
    } else {
      wx.showToast({ 
        title: '需要授权才能使用预定功能', 
        icon: 'none',
        duration: 2000
      })
    }
  },

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
  },

  goSetting() {
    wx.navigateTo({ url: '/pages/user/setting' })
  }
})
