const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('🔗 [AI Test] 正在初始化自适应测试...');

  // 1. 自动定位项目首页
  let initialPage = '';
  try {
    const appJsonPath = path.resolve(process.cwd(), 'miniprogram/app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    initialPage = appJson.pages[0]; // 自动取第一项
    console.log(`📍 检测到项目首页: ${initialPage}`);
  } catch (e) {
    console.error('❌ 无法读取 app.json，请确认脚本在项目根目录运行');
    process.exit(1);
  }

  try {
    const miniProgram = await automator.connect({
      wsEndpoint: 'ws://127.0.0.1:9420'
    });

    console.log('✅ [AI Test] 已成功连接 IDE！');

    miniProgram.on('console', msg => {
      const text = msg.text();
      console.log(`  [小程序输出] ${text}`);
      if (text.includes('[TEST_SUCCESS]')) {
        console.log('🎉 验证通过！');
        process.exit(0);
      }
    });

    // 2. 使用绝对路径跳转 (注意：不需要加 /miniprogram 前缀)
    // 微信内部路由只识别从 app.json 定义开始的路径
    console.log(`🚀 正在尝试重载页面: ${initialPage}`);
    await miniProgram.reLaunch(`/${initialPage}`); 
    
  } catch (err) {
    console.error('❌ [AI Test] 执行失败:', err.message);
    process.exit(1);
  }
}

setTimeout(() => {
  console.error('⏰ 测试超时，未收到埋点信号。');
  process.exit(1);
}, 30000);

runTest();