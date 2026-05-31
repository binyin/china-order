const cloudbase = require('./cloudbase-test-utils');

const TEST_TIMEOUT = 120000;

async function log(msg) {
  console.log(`[TEST] ${msg}`);
}

async function assert_(condition, msg) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    return true;
  } else {
    console.log(`  FAIL: ${msg}`);
    throw new Error(`断言失败: ${msg}`);
  }
}

function getDateStr(d) {
  const date = d || new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function runTests() {
  console.log('========================================');
  console.log('橙馨馒头店 - 预定/浏览模式完整测试');
  console.log('========================================\n');

  let passed = 0;
  const testDate = getDateStr();
  const ctx = { orderIds: [] };

  try {
    log('【准备】获取用户 OpenID');
    const userOpenId = await cloudbase.getUserOpenId();
    await assert_(userOpenId, '获取用户 OpenID');
    passed++;

    log('【1】店长设置预定模式 (order_mode = order)');
    await cloudbase.setSystemConfig('order_mode', 'order');
    const mode1 = await cloudbase.getSystemConfig('order_mode');
    await assert_(mode1 === 'order', '预定模式已设置: ' + mode1);
    passed++;

    log('【2】店长发布今日菜单');
    await cloudbase.publishMenu(testDate, ['全麦馒头', '南瓜馒头']);
    const menu = await cloudbase.getMenuByDate(testDate);
    await assert_(menu && menu.length > 0, '今日菜单已发布');
    passed++;

    log('【3】用户首页显示菜单 (getMenuByDate)');
    const userMenu = await cloudbase.getMenuByDate(testDate);
    await assert_(userMenu && userMenu.length > 0, '用户可见菜单: ' + userMenu.length + '个商品');
    passed++;

    log('【4】用户提交订单 (createOrder)');
    const orderItems = [{ name: '全麦馒头', product_id: 'test-product-1', num: 2, price: 2 }];
    const orderResult = await cloudbase.createOrder(orderItems, 4, testDate, userOpenId);
    await assert_(orderResult.success, '订单创建成功');
    ctx.orderIds.push(orderResult.orderId);
    passed++;

    log('【5】用户首页显示订单 (getUserTodayOrder)');
    const userOrders = await cloudbase.getUserTodayOrder(testDate, userOpenId);
    await assert_(userOrders.length > 0, '用户订单: ' + userOrders.length + '条');
    passed++;

    log('【6】用户取消订单 (cancelOrder)');
    await cloudbase.cancelOrder(ctx.orderIds[0]);
    const cancelledOrder = await cloudbase.getOrderById(ctx.orderIds[0]);
    await assert_(cancelledOrder.status === 'cancelled', '订单已取消: ' + cancelledOrder.status);
    passed++;

    const orderId3 = (await cloudbase.createOrder(orderItems, 4, testDate, userOpenId)).orderId;
    ctx.orderIds.push(orderId3);

    log('【8】店长查看用户订单 (getAdminTodayOrders)');
    const adminOrders = await cloudbase.getAdminTodayOrders(testDate);
    await assert_(adminOrders.length > 0, '店长可见订单: ' + adminOrders.length + '条');
    passed++;

    log('【9】店长取走订单 (verifyOrder)');
    await cloudbase.verifyOrder(orderId3);
    const completedOrder = await cloudbase.getOrderById(orderId3);
    await assert_(completedOrder.status === 'completed', '订单已完成: ' + completedOrder.status);
    passed++;

    log('【10】店长切换浏览模式 (order_mode = browse)');
    await cloudbase.setSystemConfig('order_mode', 'browse');
    const mode2 = await cloudbase.getSystemConfig('order_mode');
    await assert_(mode2 === 'browse', '浏览模式已设置: ' + mode2);
    passed++;

    log('【11-12】浏览模式用户页面显示联系我');
    const browseMenu = await cloudbase.getMenuByDate(testDate);
    await assert_(browseMenu && browseMenu.length > 0, '浏览模式下菜单仍可见');
    passed++;

    log('【13】恢复预定模式');
    await cloudbase.setSystemConfig('order_mode', 'order');
    const mode3 = await cloudbase.getSystemConfig('order_mode');
    await assert_(mode3 === 'order', '恢复预定模式: ' + mode3);
    passed++;

    log('【14】清理测试数据');
    for (const oid of ctx.orderIds) {
      await cloudbase.deleteOrder(oid);
    }
    await cloudbase.unpublishMenu(testDate);
    const cleanOrders = await cloudbase.getAdminTodayOrders(testDate);
    await assert_(cleanOrders.length === 0 || cleanOrders.every(o => o.status === 'hidden'), '订单已清理');
    passed++;

    console.log('\n========================================');
    console.log(`测试完成! ${passed}/14 通过`);
    console.log('========================================');
    process.exit(0);

  } catch (err) {
    console.log('\n========================================');
    console.log(`测试失败: ${err.message}`);
    console.log('========================================');
    process.exit(1);
  }
}

setTimeout(() => {
  console.error('测试超时');
  process.exit(1);
}, TEST_TIMEOUT);

runTests().catch(e => {
  console.error('未捕获异常:', e.message);
  process.exit(1);
});