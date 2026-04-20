// pages/user/setting.js
Page({
  data: {
    version: '1.1.0.20260417',
    userProfile: {
      nickname: '',
      avatarUrl: '',
      phone: ''
    }
  },

  onLoad() {
    this.loadProfile()
  },

  onShow() {
    this.loadProfile()
  },

  loadProfile() {
    const profile = wx.getStorageSync('userProfile') || {}
    this.setData({ userProfile: profile })
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({ 
      'userProfile.avatarUrl': avatarUrl 
    })
  },

  onNicknameInput(e) {
    this.setData({ 
      'userProfile.nickname': e.detail.value 
    })
  },

  onPhoneInput(e) {
    const phone = (e.detail.value || '').replace(/[^\d]/g, '').slice(0, 11)
    this.setData({ 
      'userProfile.phone': phone 
    })
  },

  saveProfile() {
    const { nickname, avatarUrl, phone } = this.data.userProfile
    
    if (!nickname || nickname.trim().length < 2) {
      wx.showToast({ title: '预订人至少2个字', icon: 'none' })
      return
    }

    wx.setStorageSync('userProfile', { 
      nickname: nickname.trim(),
      avatarUrl: avatarUrl,
      phone: phone
    })

    wx.cloud.callFunction({
      name: 'saveUser',
      data: { nickname: nickname.trim(), avatarUrl, phone: phone || null }
    }).then(r => {
      wx.showToast({ title: '保存成功', icon: 'success' })
    }).catch(e => {
      wx.showToast({ title: '保存成功', icon: 'success' })
    })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/user/history' })
  }
})