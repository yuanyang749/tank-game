const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function runHeadlessAutomation() {
  console.log('🚀 正在启动 Termux 原生无头浏览器 (Headless Chromium)...');

  const screenshotsDir = path.join(__dirname, '../screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--mute-audio',
      '--window-size=412,915'
    ],
    headless: 'new'
  });

  const page = await browser.newPage();
  
  // 模拟现代安卓大屏触控环境
  await page.setViewport({
    width: 412,
    height: 915,
    deviceScaleFactor: 2.6,
    isMobile: true,
    hasTouch: true
  });

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => pageErrors.push(err.message));

  console.log('📱 正在加载本地游戏主页 http://127.0.0.1:8080 ...');
  await page.goto('http://127.0.0.1:8080', { waitUntil: 'networkidle2', timeout: 15000 });

  // 1. 截取卡带菜单封面
  const menuShotPath = path.join(screenshotsDir, 'headless_menu.png');
  await page.screenshot({ path: menuShotPath });
  console.log(`✅ [1/3] 菜单页无头截图保存至: ${menuShotPath}`);

  // 2. 点击 A 键启动坦克大战
  console.log('🎮 模拟触控点击 A 键启动游戏 (坦克大战)...');
  await page.tap('#gb-btn-a');
  await new Promise(r => setTimeout(r, 1500)); // 等待游戏初始化及音效上下文就绪

  const tankShotPath = path.join(screenshotsDir, 'headless_tank.png');
  await page.screenshot({ path: tankShotPath });
  console.log(`✅ [2/3] 坦克大战进入运行态截图: ${tankShotPath}`);

  // 3. 复位到菜单并选择太空侵略者
  console.log('🔄 模拟点击屏幕右上角【◄目录】徽章返回卡带选择页...');
  await page.tap('#in-game-menu-btn');
  await new Promise(r => setTimeout(r, 600));

  // 模拟按下方向下选择第 2 项（太空侵略者）
  console.log('⬇️ 按下方向键选择太空侵略者...');
  await page.tap('#dpad-down');
  await new Promise(r => setTimeout(r, 400));
  await page.tap('#gb-btn-a');
  await new Promise(r => setTimeout(r, 1500));

  const spaceShotPath = path.join(screenshotsDir, 'headless_space.png');
  await page.screenshot({ path: spaceShotPath });
  console.log(`✅ [3/4] 太空侵略者运行态截图: ${spaceShotPath}`);

  // 4. 复位到菜单并选择俄罗斯方块 1989
  console.log('🔄 模拟点击屏幕右上角【◄目录】徽章返回卡带选择页...');
  await page.tap('#in-game-menu-btn');
  await new Promise(r => setTimeout(r, 600));

  // 模拟按下方向键选择第 3 项（俄罗斯方块 1989，当前索引为 1，按一次下到索引 2）
  console.log('⬇️ 按下方向键选择俄罗斯方块 1989...');
  await page.tap('#dpad-down');
  await new Promise(r => setTimeout(r, 400));
  await page.tap('#gb-btn-a');
  await new Promise(r => setTimeout(r, 1200));

  // 模拟在标题画面按下 A 键正式启动游戏
  console.log('🎮 模拟按下 A 键进入方块堆叠实战...');
  await page.tap('#gb-btn-a');
  await new Promise(r => setTimeout(r, 1000));

  // 模拟方块旋转与微移
  await page.tap('#dpad-left');
  await new Promise(r => setTimeout(r, 200));
  await page.tap('#gb-btn-a'); // 旋转
  await new Promise(r => setTimeout(r, 300));
  await page.tap('#dpad-down'); // 软降落
  await new Promise(r => setTimeout(r, 500));

  const tetrisShotPath = path.join(screenshotsDir, 'headless_tetris.png');
  await page.screenshot({ path: tetrisShotPath });
  console.log(`✅ [4/4] 俄罗斯方块 1989 运行态截图: ${tetrisShotPath}`);

  await browser.close();
  console.log('🎉 无头浏览器自动化流程与截图全部成功完成！');

  if (pageErrors.length > 0) {
    console.error('⚠️ 页面运行产生以下错误:', pageErrors);
  } else {
    console.log('✨ 页面运行 0 报错，控制台日志量:', consoleLogs.length);
  }
}

runHeadlessAutomation().catch(err => {
  console.error('❌ 无头自动化执行失败:', err);
  process.exit(1);
});
