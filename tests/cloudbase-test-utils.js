const TCB_ENV = 'cloudbase-2gjs1hdd0c429545';

async function getUserOpenId() {
  return 'test-user-openid-' + Date.now();
}

async function callFn(name, data) {
  return { success: false, message: 'use MCP tools instead' };
}

async function setSystemConfig(key, value) {
  return { success: false, message: 'use MCP tools instead' };
}

async function getSystemConfig(key) {
  return null;
}

async function publishMenu(date, productNames) {
  return { success: false, message: 'use MCP tools instead' };
}

async function unpublishMenu(date) {
  return { success: false, message: 'use MCP tools instead' };
}

async function getMenuByDate(date) {
  return [];
}

async function createOrder(items, totalPrice, date, openId) {
  return { success: false, message: 'use MCP tools instead' };
}

async function cancelOrder(orderId) {
  return { success: false, message: 'use MCP tools instead' };
}

async function verifyOrder(orderId) {
  return { success: false, message: 'use MCP tools instead' };
}

async function deleteOrder(orderId) {
  return { success: false, message: 'use MCP tools instead' };
}

async function getOrderById(orderId) {
  return null;
}

async function getUserTodayOrder(date, openId) {
  return [];
}

async function getAdminTodayOrders(date) {
  return [];
}

module.exports = {
  getUserOpenId,
  setSystemConfig,
  getSystemConfig,
  publishMenu,
  unpublishMenu,
  getMenuByDate,
  createOrder,
  cancelOrder,
  verifyOrder,
  deleteOrder,
  getOrderById,
  getUserTodayOrder,
  getAdminTodayOrders
};