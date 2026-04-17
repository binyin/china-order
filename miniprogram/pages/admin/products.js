// pages/admin/products.js
const app = getApp()
const { getAllProducts, addProduct, updateProduct, deleteProduct } = require('../../utils/db')

Page({
  data: {
    products: [],
    showModal: false,
    editId: null,
    form: { name: '', price: '', unit: '个', image_url: '' },
    saving: false,
    uploading: false
  },

  onLoad() {
    if (!app.globalData.adminInfo) {
      wx.redirectTo({ url: '/pages/admin/login' })
      return
    }
    this.loadProducts()
  },

  onShow() {
    this.loadProducts()
  },

  loadProducts() {
    getAllProducts().then(res => {
      this.setData({ products: res.data })
    })
  },

  showAddModal() {
    this.setData({
      showModal: true,
      editId: null,
      form: { name: '', price: '', unit: '个', image_url: '' }
    })
  },

  showEditModal(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.products[index]
    this.setData({
      showModal: true,
      editId: item._id,
      form: { name: item.name, price: String(item.price), unit: item.unit || '个', image_url: item.image_url || '' }
    })
  },

  closeModal() {
    this.setData({ showModal: false })
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field
    const form = { ...this.data.form, [field]: e.detail.value }
    this.setData({ form })
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({ 'form.tempImage': tempFilePath, uploading: true })
        
        wx.compressImage({
          src: tempFilePath,
          quality: 80,
          success: (compressRes) => {
            this.uploadImage(compressRes.tempFilePath)
          },
          fail: () => {
            this.setData({ uploading: false })
            this.uploadImage(tempFilePath)
          }
        })
      }
    })
  },

  uploadImage(filePath) {
    const cloudPath = `products/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`
    
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: res => {
        this.setData({ 
          'form.image_url': res.fileID,
          uploading: false 
        })
        wx.showToast({ title: '图片上传成功', icon: 'success' })
      },
      fail: err => {
        this.setData({ uploading: false })
        wx.showToast({ title: '上传失败', icon: 'error' })
        console.error('uploadImage fail:', err)
      }
    })
  },

  saveProduct() {
    const { name, price, unit, image_url } = this.data.form
    if (!name.trim()) {
      wx.showToast({ title: '请输入产品名称', icon: 'none' }); return
    }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) {
      wx.showToast({ title: '请输入有效价格', icon: 'none' }); return
    }

    this.setData({ saving: true })
    const data = { name: name.trim(), price: priceNum, unit: unit.trim() || '个', image_url: image_url || '' }

    const op = this.data.editId
      ? updateProduct(this.data.editId, data)
      : addProduct(data)

    op.then(() => {
      this.setData({ saving: false, showModal: false })
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.loadProducts()
    }).catch(() => {
      this.setData({ saving: false })
      wx.showToast({ title: '保存失败', icon: 'error' })
    })
  },

  deleteProduct(e) {
    const { id } = e.currentTarget.dataset
    deleteProduct(id).then(() => {
      wx.vibrateShort()
      wx.showToast({ title: '已删除', icon: 'success' })
      this.loadProducts()
    }).catch(() => {
      wx.showToast({ title: '删除失败', icon: 'error' })
    })
  }
})
