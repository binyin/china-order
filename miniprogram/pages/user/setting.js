// pages/user/setting.js
Page({
  data: {
    version: '1.0.0'
  },

  onLoad() {
    console.log('setting page loaded')
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/user/history' })
  }
})