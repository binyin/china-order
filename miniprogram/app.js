// app.js
App({
  onLaunch() {
    wx.cloud.init({
      env: 'cloudbase-2gjs1hdd0c429545',
      traceUser: true
    })
  },
  globalData: {
    adminInfo: null // 登录后存储管理员信息
  }
})
