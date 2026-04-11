// pages/admin/products.js
const app = getApp()
const { getAllProducts, addProduct, updateProduct, deleteProduct } = require('../../utils/db')

Page({
  data: {
    products: [],
    showModal: false,
    editId: null,
    form: { name: '', price: '', unit: '个' },
    saving: false
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
      form: { name: '', price: '', unit: '个' }
    })
  },

  showEditModal(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.products[index]
    this.setData({
      showModal: true,
      editId: item._id,
      form: { name: item.name, price: String(item.price), unit: item.unit || '个' }
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

  saveProduct() {
    const { name, price, unit } = this.data.form
    if (!name.trim()) {
      wx.showToast({ title: '请输入产品名称', icon: 'none' }); return
    }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) {
      wx.showToast({ title: '请输入有效价格', icon: 'none' }); return
    }

    this.setData({ saving: true })
    const data = { name: name.trim(), price: priceNum, unit: unit.trim() || '个', image_url: '' }

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
