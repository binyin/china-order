// app.js
App({
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-0guiskpadbfb2681',
      traceUser: true
    })
  },
  globalData: {
    adminInfo: null // 登录后存储管理员信息
  }
})
