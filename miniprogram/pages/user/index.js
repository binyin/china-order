// pages/user/index.js
const { getMenuByDate, getMyOrders } = require('../../utils/db')
const logger = require('../../utils/logger')

const TAG = 'user:index'

Page({
  data: {
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
    tempNickname: '',
    tempAvatarUrl: '',
    dateList: [],
    selectedDate: '',
    dateIndex: 3,
    swiperCurrent: 3,
    showMorePopup: false,
    showDatePicker: false,
    formatDate: '',
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
    this.initDateList()
    this.checkAuthStatus()
  },

  onShow() {
    this.checkAuthStatus()
    this.loadMenu()
    this.loadMyOrders()
  },

  initDateList() {
    const dates = []
    const today = new Date()
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today.getTime() + i * 24 * 3600 * 1000)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const weekday = weekDays[d.getDay()]
      let label = ''
      let className = ''
      if (i < 0) {
        label = `${Math.abs(i)}天前`
        className = 'prev'
      } else if (i === 0) {
        label = '今天'
        className = 'active'
      } else if (i === 1) {
        label = '明天'
        className = 'next'
      } else {
        label = weekday
      }
      dates.push({ date: dateStr, label, day: d.getDate(), weekday, className })
    }
    const centerIndex = 3
    this.setData({
      dateList: dates,
      selectedDate: dates[centerIndex].date,
      dateIndex: centerIndex,
      swiperCurrent: centerIndex,
      formatDate: dates[centerIndex].weekday
    })
this.loadMenu()
    this.loadMyOrders()
  },

  getTodayStr() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  },

  loadMenu() {
    logger.info(TAG + ':loadMenu', { start: true, selectedDate: this.data.selectedDate })
    const todayStr = this.getTodayStr()
    const targetDate = this.data.selectedDate || todayStr
    return getMenuByDate(targetDate).then(res => {
      const list = (res.data || []).map(item => ({ 
        ...item, 
        qty: 0,
        disabled: false
      }))
      logger.info(TAG + ':loadMenu', { count: list.length, date: res.menuInfo?.date, selected: targetDate })
      
      if (list.length > 0) {
        const isExpired = targetDate < todayStr
        const processedList = list.map(item => ({
          ...item,
          disabled: isExpired
        }))
        this.setData({ menuList: processedList })
        this.calcTotal()
      } else {
        this.setData({ menuList: [] })
      }
    }).catch((err) => {
      this.setData({ menuList: [] })
      logger.error(TAG + ':loadMenu', { error: err.message || String(err) })
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
    const selectedDate = this.data.selectedDate || this.getTodayStr()
    logger.info(TAG + ':loadMyOrders', { start: true, selectedDate })
    
    getMyOrders(selectedDate).then(orders => {
      this.setData({ submittedOrders: orders || [] })
      this.loadingOrders = false
      logger.info(TAG + ':loadMyOrders', { success: true, count: orders?.length || 0, selectedDate })
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

    logger.info(TAG + ':confirmOrder', { itemCount: items.length, totalPrice: this.data.totalPrice })

    this.setData({ submitting: true })

    const savedProfile = wx.getStorageSync('userProfile') || {}
    
    wx.cloud.callFunction({
      name: 'createOrder',
      data: {
        items,
        total_price: parseFloat(this.data.totalPrice) || 0,
        date: this.data.selectedDate || this.getTodayStr()
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
        this.loadMenu()
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

  toggleMorePopup() {
    this.setData({ showMorePopup: !this.data.showMorePopup })
  },

  closeMorePopup() {
    this.setData({ showMorePopup: false })
  },

  toggleDatePicker() {
    this.setData({ showDatePicker: !this.data.showDatePicker })
  },

  onDateSelect(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.dateList[index]
    if (item.date === this.data.selectedDate) {
      this.setData({ showDatePicker: false })
      return
    }
    this.setData({ selectedDate: item.date, dateIndex: index, swiperCurrent: index, formatDate: item.label + ' ' + item.day + '日', showDatePicker: false })
    this.loadMenu()
    this.loadMyOrders()
  },

  onDateSwipe(e) {
    const newIndex = e.detail.current
    if (newIndex === undefined || newIndex === this.data.dateIndex) return
    const item = this.data.dateList[newIndex]
    if (item.date === this.data.selectedDate) return
    this.setData({ selectedDate: item.date, dateIndex: newIndex, swiperCurrent: newIndex, formatDate: item.label + ' ' + item.day + '日' })
    this.loadMenu()
    this.loadMyOrders()
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