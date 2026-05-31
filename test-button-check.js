const automator = require('miniprogram-automator');

async function test() {
  let miniProgram;
  try {
    miniProgram = await automator.connect({
      wsEndpoint: 'ws://127.0.0.1:9420'
    });
    
    let page = await miniProgram.currentPage();
    
    if (!page.path.includes('admin/orders')) {
      await miniProgram.navigateTo('/pages/admin/orders');
      await miniProgram.waitFor(2000);
      page = await miniProgram.currentPage();
    }
    
    // 截图查看实际效果
    await miniProgram.screenshot({ path: '/data/work/idear/china-order-new/test-button.png' });
    console.log('[TEST] Screenshot saved to test-button.png');
    
    // 检查按钮样式
    const takeButtons = await page.$$('.btn-take');
    if (takeButtons.length > 0) {
      const btnInfo = await takeButtons[0].$('.btn-take');
      const styles = await takeButtons[0].style();
      console.log('[TEST] Button styles:', JSON.stringify(styles, null, 2));
    }
    
    await miniProgram.close();
    process.exit(0);
  } catch (error) {
    console.error('[TEST_ERROR]', error.message);
    if (miniProgram) {
      try { await miniProgram.close(); } catch(e) {}
    }
    process.exit(1);
  }
}

test();
