// pages/admin/history.js
const app = getApp()
const { getRecentOrders, getDateStr, getBJDateStr } = require('../../utils/db')

Page({
  data: {
    loading: true,
    // 视图模式：day=按日, week=按周, month=按月, customer=按用户
    viewMode: 'week',
    // 日期范围
    queryDays: 7,
    customDateStart: '',
    customDateEnd: '',
    showDatePicker: false,
    // 每日/周/月视图数据
    dailyList: [],
    // 按用户视图数据
    customerList: [],
    // 当前详情视图
    showDetail: false,
    detailTitle: '',
    detailOrders: [],
    detailLoading: false,
    // 订单状态映射
    statusText: {
      pending: '待取货',
      completed: '已完成',
      cancelled: '已取消'
    }
  },

  onLoad() {
    this.checkLogin()
  },

  onShow() {
    if (app.globalData.adminInfo) {
      this.loadData()
    }
  },

  checkLogin() {
    if (!app.globalData.adminInfo) {
      wx.redirectTo({ url: '/pages/admin/login' })
    }
  },

  // 切换视图模式
  switchViewMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ 
      viewMode: mode,
      showDetail: false
    })
    this.loadData()
  },

  // 切换日期范围
  onQueryChange(e) {
    const days = parseInt(e.currentTarget.dataset.days)
    this.setData({ 
      queryDays: days,
      customDateStart: '',
      customDateEnd: '',
      showDetail: false
    })
    this.loadData()
  },

  // 显示自定义日期选择
  showCustomDatePicker() {
    this.setData({ showDatePicker: true })
  },

  // 隐藏日期选择器
  hideDatePicker() {
    this.setData({ showDatePicker: false })
  },

  // 选择开始日期
  onDateStartChange(e) {
    this.setData({ customDateStart: e.detail.value })
  },

  // 选择结束日期
  onDateEndChange(e) {
    this.setData({ customDateEnd: e.detail.value })
  },

  // 应用自定义日期范围
  applyCustomDate() {
    const { customDateStart, customDateEnd } = this.data
    if (!customDateStart || !customDateEnd) {
      wx.showToast({ title: '请选择日期', icon: 'none' })
      return
    }
    if (customDateStart > customDateEnd) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' })
      return
    }
    this.setData({ 
      queryDays: 0,
      showDatePicker: false,
      showDetail: false
    })
    this.loadData()
  },

  // 加载数据
  loadData() {
    this.setData({ loading: true })
    const { viewMode, queryDays, customDateStart, customDateEnd } = this.data

    if (queryDays === 0 && customDateStart && customDateEnd) {
      if (viewMode === 'customer') {
        this.loadCustomerDataByRange(customDateStart, customDateEnd)
      } else {
        this.loadDailyDataByRange(customDateStart, customDateEnd)
      }
    } else {
      if (viewMode === 'customer') {
        this.loadCustomerData(queryDays)
      } else {
        this.loadDailyData(queryDays)
      }
    }
  },

  // 加载按日/周/月视图数据（指定日期范围）
  loadDailyDataByRange(startDate, endDate) {
    getRecentOrders(0, startDate, endDate).then(res => {
      const orders = (res.data || []).sort((a, b) => (b.create_time || 0) - (a.create_time || 0))
      if (this.data.viewMode === 'day') {
        this.processDailyData(orders)
      } else if (this.data.viewMode === 'week') {
        this.processWeeklyData(orders)
      } else {
        this.processMonthlyData(orders)
      }
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  // 加载按用户视图数据（指定日期范围）
  loadCustomerDataByRange(startDate, endDate) {
    getRecentOrders(0, startDate, endDate).then(res => {
      const orders = (res.data || [])
      this.processCustomerData(orders)
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  // 加载按日/周/月视图数据
  loadDailyData(days) {
    getRecentOrders(days).then(res => {
      const orders = (res.data || []).sort((a, b) => (b.create_time || 0) - (a.create_time || 0))
      
      if (this.data.viewMode === 'day') {
        this.processDailyData(orders)
      } else if (this.data.viewMode === 'week') {
        this.processWeeklyData(orders)
      } else {
        this.processMonthlyData(orders)
      }
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  // 按日视图数据处理
  processDailyData(orders) {
    const dateMap = {}
    orders.forEach(o => {
      if (!dateMap[o.date]) {
        dateMap[o.date] = {
          date: o.date,
          orders: [],
          totalRevenue: 0,
          productNames: new Set(),
          customerNames: new Set()
        }
      }
      dateMap[o.date].orders.push(o)
      if (o.status === 'completed' || o.status === 'pending') {
        dateMap[o.date].totalRevenue += o.total_price || 0
      }
      o.items.forEach(i => dateMap[o.date].productNames.add(i.name))
      const cName = o.customer_nickname || o.customer_name
      if (cName) dateMap[o.date].customerNames.add(cName)
    })

    const dailyList = Object.values(dateMap)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(d => ({
        date: d.date,
        label: this.formatDateLabel(d.date),
        orderCount: d.orders.length,
        totalRevenue: d.totalRevenue.toFixed(2),
        productNames: [...d.productNames].join('、') || '-',
        customerNames: [...d.customerNames].join('、') || '-',
        pendingCount: d.orders.filter(o => o.status === 'pending').length,
        completedCount: d.orders.filter(o => o.status === 'completed').length,
        _orders: d.orders
      }))

    this.setData({ dailyList, loading: false })
  },

  // 按周视图数据处理
  processWeeklyData(orders) {
    const weekMap = {}
    orders.forEach(o => {
      const weekKey = this.getWeekKey(o.date)
      if (!weekMap[weekKey]) {
        weekMap[weekKey] = {
          weekStart: weekKey,
          weekLabel: this.getWeekLabel(weekKey),
          orders: [],
          totalRevenue: 0,
          productNames: new Set(),
          customerNames: new Set(),
          dates: new Set()
        }
      }
      weekMap[weekKey].orders.push(o)
      weekMap[weekKey].dates.add(o.date)
      if (o.status === 'completed' || o.status === 'pending') {
        weekMap[weekKey].totalRevenue += o.total_price || 0
      }
      o.items.forEach(i => weekMap[weekKey].productNames.add(i.name))
      const cName = o.customer_nickname || o.customer_name
      if (cName) weekMap[weekKey].customerNames.add(cName)
    })

    const dailyList = Object.values(weekMap)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .map(d => ({
        date: d.weekStart,
        label: d.weekLabel,
        orderCount: d.orders.length,
        totalRevenue: d.totalRevenue.toFixed(2),
        productNames: [...d.productNames].join('、') || '-',
        customerNames: [...d.customerNames].join('、') || '-',
        pendingCount: d.orders.filter(o => o.status === 'pending').length,
        completedCount: d.orders.filter(o => o.status === 'completed').length,
        _orders: d.orders
      }))

    this.setData({ dailyList, loading: false })
  },

  // 按月视图数据处理
  processMonthlyData(orders) {
    const monthMap = {}
    orders.forEach(o => {
      const monthKey = o.date.substring(0, 7) // YYYY-MM
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          month: monthKey,
          monthLabel: monthKey + '月',
          orders: [],
          totalRevenue: 0,
          productNames: new Set(),
          customerNames: new Set(),
          dates: new Set()
        }
      }
      monthMap[monthKey].orders.push(o)
      monthMap[monthKey].dates.add(o.date)
      if (o.status === 'completed' || o.status === 'pending') {
        monthMap[monthKey].totalRevenue += o.total_price || 0
      }
      o.items.forEach(i => monthMap[monthKey].productNames.add(i.name))
      const cName = o.customer_nickname || o.customer_name
      if (cName) monthMap[monthKey].customerNames.add(cName)
    })

    const dailyList = Object.values(monthMap)
      .sort((a, b) => b.month.localeCompare(a.month))
      .map(d => ({
        date: d.month,
        label: d.monthLabel,
        orderCount: d.orders.length,
        totalRevenue: d.totalRevenue.toFixed(2),
        productNames: [...d.productNames].join('、') || '-',
        customerNames: [...d.customerNames].join('、') || '-',
        pendingCount: d.orders.filter(o => o.status === 'pending').length,
        completedCount: d.orders.filter(o => o.status === 'completed').length,
        _orders: d.orders
      }))

    this.setData({ dailyList, loading: false })
  },

  // 加载按用户视图数据
  loadCustomerData(days) {
    getRecentOrders(days).then(res => {
      const orders = (res.data || [])
      
      // 按用户聚合
      const customerMap = {}
      orders.forEach(o => {
        const customerId = o.customer_id || 'unknown'
        const customerName = o.customer_nickname || o.customer_name || '未知用户'
        
        if (!customerMap[customerId]) {
          customerMap[customerId] = {
            customerId,
            customerName,
            orders: [],
            totalRevenue: 0,
            firstOrderDate: o.date,
            lastOrderDate: o.date,
            productNames: new Set()
          }
        }
        customerMap[customerId].orders.push(o)
        if (o.status === 'completed' || o.status === 'pending') {
          customerMap[customerId].totalRevenue += o.total_price || 0
        }
        o.items.forEach(i => customerMap[customerId].productNames.add(i.name))
        // 更新首末订单日期
        if (o.date < customerMap[customerId].firstOrderDate) {
          customerMap[customerId].firstOrderDate = o.date
        }
        if (o.date > customerMap[customerId].lastOrderDate) {
          customerMap[customerId].lastOrderDate = o.date
        }
      })

      const customerList = Object.values(customerMap)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .map(c => ({
          customerId: c.customerId,
          customerName: c.customerName,
          orderCount: c.orders.length,
          totalRevenue: c.totalRevenue.toFixed(2),
          productNames: [...c.productNames].join('、') || '-',
          firstOrderDate: c.firstOrderDate,
          lastOrderDate: c.lastOrderDate,
          pendingCount: c.orders.filter(o => o.status === 'pending').length,
          completedCount: c.orders.filter(o => o.status === 'completed').length,
          _orders: c.orders
        }))

      this.setData({ customerList, loading: false })
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  // 处理按用户数据（共用方法）
  processCustomerData(orders) {
    const customerMap = {}
    orders.forEach(o => {
      const customerId = o.customer_id || 'unknown'
      const customerName = o.customer_nickname || o.customer_name || '未知用户'
      
      if (!customerMap[customerId]) {
        customerMap[customerId] = {
          customerId,
          customerName,
          orders: [],
          totalRevenue: 0,
          firstOrderDate: o.date,
          lastOrderDate: o.date,
          productNames: new Set()
        }
      }
      customerMap[customerId].orders.push(o)
      if (o.status === 'completed' || o.status === 'pending') {
        customerMap[customerId].totalRevenue += o.total_price || 0
      }
      o.items.forEach(i => customerMap[customerId].productNames.add(i.name))
      if (o.date < customerMap[customerId].firstOrderDate) {
        customerMap[customerId].firstOrderDate = o.date
      }
      if (o.date > customerMap[customerId].lastOrderDate) {
        customerMap[customerId].lastOrderDate = o.date
      }
    })

    const customerList = Object.values(customerMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map(c => ({
        customerId: c.customerId,
        customerName: c.customerName,
        orderCount: c.orders.length,
        totalRevenue: c.totalRevenue.toFixed(2),
        productNames: [...c.productNames].join('、') || '-',
        firstOrderDate: c.firstOrderDate,
        lastOrderDate: c.lastOrderDate,
        pendingCount: c.orders.filter(o => o.status === 'pending').length,
        completedCount: c.orders.filter(o => o.status === 'completed').length,
        _orders: c.orders
      }))

    this.setData({ customerList, loading: false })
  },

  // 获取周键（周一为起始）
  getWeekKey(dateStr) {
    const date = new Date(dateStr)
    const day = date.getDay() || 7
    const monday = new Date(date.getTime() - (day - 1) * 24 * 60 * 60 * 1000)
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
  },

  // 获取周标签
  getWeekLabel(weekStart) {
    const start = new Date(weekStart)
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000)
    const startMonth = start.getMonth() + 1
    const startDay = start.getDate()
    const endMonth = end.getMonth() + 1
    const endDay = end.getDate()
    
    if (startMonth === endMonth) {
      return `${startMonth}月${startDay}-${endDay}日`
    } else {
      return `${startMonth}月${startDay}-${endMonth}月${endDay}日`
    }
  },

  // 格式化日期标签
  formatDateLabel(dateStr) {
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
    return `${month}月${day}日 ${weekday}`
  },

  // 查看详情
  openDetail(e) {
    const index = e.currentTarget.dataset.index
    const { viewMode, dailyList, customerList } = this.data
    
    let title = ''
    let orders = []
    
    if (viewMode === 'customer') {
      const item = customerList[index]
      title = item.customerName
      orders = item._orders
    } else {
      const item = dailyList[index]
      title = item.label || item.date
      orders = item._orders
    }

    this.setData({
      showDetail: true,
      detailTitle: title,
      detailOrders: orders
    })
  },

  // 返回列表
  backToList() {
    this.setData({ showDetail: false })
  }
})