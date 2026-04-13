// pages/admin/login.js
const app = getApp()

Page({
  data: {
    username: '',
    password: '',
    loading: false
  },

  onLoad() {
    // 已登录则直接跳转
    if (app.globalData.adminInfo) {
      this.goHome()
    }
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  doLogin() {
    const { username, password } = this.data
    if (!username || !password) {
      wx.showToast({ title: '请填写账号和密码', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'adminLogin',
      data: { username, password }
    }).then(res => {
      this.setData({ loading: false })
      const result = res.result
      if (result.success) {
        app.globalData.adminInfo = result.data
        wx.showToast({ title: `欢迎，${result.data.nickname}`, icon: 'success' })
        this.goHome()
      } else {
        wx.showToast({ title: result.message || '登录失败', icon: 'error' })
      }
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '网络错误', icon: 'error' })
    })
  },

  goHome() {
    wx.redirectTo({ url: '/pages/admin/orders' })
  }
})
