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
    console.log('[setting] onChooseAvatar:', { avatarUrl: avatarUrl ? 'has_value' : 'empty' })
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
    
    console.log('[setting] saveProfile input:', { nickname, avatarUrl: avatarUrl ? 'has_value' : 'empty', phone })
    
    if (!nickname || nickname.trim().length < 2) {
      wx.showToast({ title: '预订人至少2个字', icon: 'none' })
      return
    }

    wx.setStorageSync('userProfile', { 
      nickname: nickname.trim(),
      avatarUrl: avatarUrl,
      phone: phone
    })
    
    console.log('[setting] calling saveUser cloud function:', { nickname: nickname.trim(), avatarUrl: avatarUrl ? 'has_value' : 'empty' })

    wx.showLoading({ title: '保存中...', mask: true })
    
    wx.cloud.callFunction({
      name: 'saveUser',
      data: { nickname: nickname.trim(), avatarUrl, phone: phone || null }
    }).then(r => {
      wx.hideLoading()
      console.log('[setting] saveUser result:', JSON.stringify(r))
      if (r.result && r.result.success) {
        wx.showToast({ title: '已保存到云端', icon: 'success' })
      } else {
        wx.showToast({ title: '保存失败: ' + (r.result?.message || ''), icon: 'none' })
      }
    }).catch(e => {
      wx.hideLoading()
      console.log('[setting] saveUser error:', e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/user/history' })
  }
})