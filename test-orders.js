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
    
    const data = await page.data();
    
    if (!data.pendingOrders || !data.historyOrders) {
      console.log('[TEST_ERROR] pendingOrders or historyOrders not found in page data');
      process.exit(1);
    }
    
    const orderCards = await page.$$('.order-card');
    
    if (orderCards.length === 0) {
      console.log('[TEST_SUCCESS] No orders to display, no overlap possible');
      await miniProgram.close();
      process.exit(0);
    }
    
    const boundingBoxes = [];
    for (let i = 0; i < orderCards.length; i++) {
      const box = await orderCards[i].boundingBox();
      boundingBoxes.push({ index: i, ...box });
    }
    
    // Only check vertical overlap since cards are arranged vertically
    let overlapFound = false;
    for (let i = 0; i < boundingBoxes.length; i++) {
      for (let j = i + 1; j < boundingBoxes.length; j++) {
        const box1 = boundingBoxes[i];
        const box2 = boundingBoxes[j];
        const verticalOverlap = box1.y < box2.y + box2.height && box1.y + box1.height > box2.y;
        if (verticalOverlap) {
          console.log(`[TEST_ERROR] Vertical overlap found between card ${i} and card ${j}`);
          overlapFound = true;
        }
      }
    }
    
    if (!overlapFound) {
      console.log('[TEST_SUCCESS] No overlapping order cards found!');
    } else {
      process.exit(1);
    }
    
    await miniProgram.close();
    process.exit(0);
    
  } catch (error) {
    console.error('[TEST_ERROR]', error.message);
    if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
      console.log('[TEST] IDE not running. Please run: cli auto --auto-port 9420');
    }
    if (miniProgram) {
      try { await miniProgram.close(); } catch(e) {}
    }
    process.exit(1);
  }
}

test();
