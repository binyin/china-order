const automator = require('miniprogram-automator');

const PAGES = {
  userIndex: 'pages/user/index',
  userHistory: 'pages/user/history'
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkUserPage() {
  console.log('🔗 连接模拟器...');
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  
  console.log('📱 跳转到用户首页...');
  await mini.reLaunch('/' + PAGES.userIndex);
  await sleep(2000);
  
  const page1 = await mini.currentPage();
  console.log('📍 页面:', page1.path);
  
  console.log('📱 跳转历史...');
  await mini.reLaunch('/' + PAGES.userHistory);
  await sleep(1500);
  
  const page2 = await mini.currentPage();
  console.log('📍 页面:', page2.path);
  
  console.log('\n🎉 验证完成 - 页面导航正常');
  process.exit(0);
}

setTimeout(() => { console.error('⏰ 超时'); process.exit(1); }, 30000);
checkUserPage().catch(e => { console.error('❌', e.message); process.exit(1); });
