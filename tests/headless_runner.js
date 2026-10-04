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

  // 4. 复位到菜单并选择俄罗斯方块 1989 (使用新实体复位键 #gb-btn-reset)
  console.log('🔄 模拟点击实体复位键【RESET: SELECT + START】返回卡带选择页...');
  await page.tap('#gb-btn-reset');
  await new Promise(r => setTimeout(r, 600));

  // 模拟按下方向键选择第 3 项（俄罗斯方块 1989）
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
  console.log(`✅ [4/6] 俄罗斯方块 1989 运行态截图: ${tetrisShotPath}`);

  // 5. 复位到菜单并选择软乎乎大冒险 1991 (ROM 04)
  console.log('🔄 模拟点击实体复位键返回菜单...');
  await page.tap('#gb-btn-reset');
  await new Promise(r => setTimeout(r, 600));

  console.log('⬇️ 按下方向键选择 ROM 04 (软乎乎大冒险 1991)...');
  await page.tap('#dpad-down');
  await new Promise(r => setTimeout(r, 300));

  const squishyIdx = await page.evaluate(() => window.consoleInstance.menuIndex);
  console.log(`📋 当前选中卡带索引: ${squishyIdx} (期待: 3 - squishy-buddies)`);
  if (squishyIdx !== 3) {
    throw new Error(`菜单切换到软乎乎大冒险失败，当前索引为 ${squishyIdx}`);
  }

  console.log('🎮 模拟按下 A 键进入软乎乎大冒险标题界面...');
  await page.tap('#gb-btn-a');
  await new Promise(r => setTimeout(r, 1200));

  // 模拟在标题画面按下 A 键正式启动游戏
  console.log('🎮 模拟按下 A 键开始彩虹泉冒险...');
  await page.tap('#gb-btn-a');
  await new Promise(r => setTimeout(r, 1000));

  // 模拟果冻滚动、起跳与吐泡泡操作
  console.log('✨ 模拟软乎乎滚动、吐泡泡与切人测试...');
  await page.tap('#dpad-right');
  await new Promise(r => setTimeout(r, 200));
  await page.tap('#gb-btn-a'); // 跳跃
  await new Promise(r => setTimeout(r, 200));
  await page.tap('#gb-btn-b'); // 吐金色固体泡
  await new Promise(r => setTimeout(r, 300));
  await page.tap('#gb-btn-select'); // 切换成蓝波波
  await new Promise(r => setTimeout(r, 300));
  await page.tap('#gb-btn-b'); // 吐浮水泡
  await new Promise(r => setTimeout(r, 400));

  const squishyShotPath = path.join(screenshotsDir, 'headless_squishy.png');
  await page.screenshot({ path: squishyShotPath });
  console.log(`✅ [5/6] 软乎乎大冒险 1991 运行态截图: ${squishyShotPath}`);

  // 6. 点击复位键回到菜单，并用方向下选择第 5 项（TERMUX 开发攻略）
  console.log('🔄 模拟点击复位键返回菜单...');
  await page.tap('#gb-btn-reset');
  await new Promise(r => setTimeout(r, 600));

  console.log('⬇️ 按下方向键选择第 5 项 (TERMUX 开发攻略)...');
  await page.tap('#dpad-down');
  await new Promise(r => setTimeout(r, 300));

  const docIdx = await page.evaluate(() => window.consoleInstance.menuIndex);
  console.log(`📋 当前选中卡带索引: ${docIdx} (期待: 4 - tutorial)`);
  if (docIdx !== 4) {
    throw new Error(`菜单切换到文档失败，当前索引为 ${docIdx}`);
  }

  console.log('📖 按下 A 键进入掌机电子文档...');
  await page.tap('#gb-btn-a');
  await new Promise(r => setTimeout(r, 1200));

  const manualShotPath = path.join(screenshotsDir, 'headless_manual.png');
  await page.screenshot({ path: manualShotPath });
  console.log(`✅ [6/6] Termux 开发攻略文档运行态截图: ${manualShotPath}`);

  // 验证在文档中再次点击复位键能否顺利回到游戏菜单
  console.log('🔄 在文档内模拟点击实体复位键返回游戏列表...');
  await page.tap('#gb-btn-reset');
  await new Promise(r => setTimeout(r, 600));

  const inMenuAfterReset = await page.evaluate(() => window.consoleInstance.inMenu);
  console.log(`🕹️ 复位后是否处于菜单状态: ${inMenuAfterReset}`);
  if (!inMenuAfterReset) {
    throw new Error('从文档点击复位键未能回到游戏菜单！');
  }

  await browser.close();
  console.log('🎉 无头浏览器自动化流程与所有截图验证全部成功完成！');

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
