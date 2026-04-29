// pages/user/setting.js
Page({
  data: {
    version: '1.4.3.20260426',
    userProfile: {
      nickname: '',
      avatarUrl: '',
      phone: ''
    },
    orderMode: 'order'
  },

  onLoad() {
    this.loadProfile()
    this.loadOrderMode()
  },

  onShow() {
    this.loadProfile()
    this.loadOrderMode()
  },

  loadOrderMode() {
    wx.cloud.callFunction({
      name: 'getSystemConfig',
      data: { key: 'order_mode' }
    }).then(res => {
      const mode = res.result?.value || 'order'
      this.setData({ orderMode: mode })
    }).catch(() => {
      this.setData({ orderMode: 'order' })
    })
  },

  loadProfile() {
    const profile = wx.getStorageSync('userProfile') || {}
    this.setData({ userProfile: profile })
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    console.log('[setting] onChooseAvatar:', { avatarUrl: avatarUrl ? 'has_value' : 'empty' })
    
    const isTemp = avatarUrl && (avatarUrl.indexOf('127.0.0.1') > -1 || avatarUrl.indexOf('wxfile://tmp_') > -1)
    
    if (isTemp) {
      wx.showLoading({ title: '上传头像...', mask: true })
      const timestamp = Date.now()
      const ext = avatarUrl.split('.').pop().split('?')[0] || 'jpg'
      const cloudPath = `avatars/${timestamp}.${ext}`
      
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl
      }).then(res => {
        wx.hideLoading()
        if (res.fileID) {
          console.log('[setting] avatar uploaded to cloud:', res.fileID)
          this.setData({ 
            'userProfile.avatarUrl': res.fileID 
          })
        } else {
          console.error('[setting] upload failed, keep temp path')
        }
      }).catch(err => {
        wx.hideLoading()
        console.error('[setting] upload avatar error:', err)
        this.setData({ 
          'userProfile.avatarUrl': avatarUrl 
        })
      })
    } else {
      this.setData({ 
        'userProfile.avatarUrl': avatarUrl 
      })
    }
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

    const isTempPath = avatarUrl && (avatarUrl.indexOf('127.0.0.1') > -1 || avatarUrl.indexOf('wxfile://tmp_') > -1)
    
    if (isTempPath) {
      wx.showLoading({ title: '上传头像...', mask: true })
      const timestamp = Date.now()
      const ext = avatarUrl.split('.').pop().split('?')[0] || 'jpg'
      const cloudPath = `avatars/${timestamp}.${ext}`
      
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl
      }).then(res => {
        wx.hideLoading()
        if (res.fileID) {
          console.log('[setting] avatar uploaded in saveProfile:', res.fileID)
          this.setData({ 'userProfile.avatarUrl': res.fileID })
          this.doSaveUser(nickname.trim(), res.fileID, phone)
        } else {
          wx.hideLoading()
          wx.showToast({ title: '头像上传失败', icon: 'none' })
        }
      }).catch(err => {
        wx.hideLoading()
        console.error('[setting] upload avatar error in saveProfile:', err)
        wx.showToast({ title: '头像上传失败', icon: 'none' })
      })
    } else {
      this.doSaveUser(nickname.trim(), avatarUrl, phone)
    }
  },

  doSaveUser(nickname, avatarUrl, phone) {
    wx.setStorageSync('userProfile', { 
      nickname: nickname,
      avatarUrl: avatarUrl,
      phone: phone
    })
    
    console.log('[setting] calling saveUser cloud function:', { nickname, avatarUrl: avatarUrl ? 'has_value' : 'empty' })

    wx.showLoading({ title: '保存中...', mask: true })
    
    wx.cloud.callFunction({
      name: 'saveUser',
      data: { nickname: nickname, avatarUrl, phone: phone || null }
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
    console.log('[user:setting] goHistory click')
    wx.navigateTo({ url: '/pages/user/history' })
  }
})