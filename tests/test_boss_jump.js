const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function testBossJump() {
  console.log('🚀 启动 Termux 原生无头浏览器验证 Boss 起跳物理与屏幕安全范围...');

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

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 412,
      height: 915,
      deviceScaleFactor: 2.0,
      isMobile: true,
      hasTouch: true
    });

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    console.log('📱 加载第 5 关 Boss 战场: http://127.0.0.1:8080/games/squishy-buddies/ ...');
    await page.goto('http://127.0.0.1:8080/games/squishy-buddies/', { waitUntil: 'networkidle2', timeout: 15000 });

    // 载入第 5 关并触发跳跃
    const jumpResult = await page.evaluate(async () => {
      const app = window.squishyApp;
      app.loadLevel(4); // Room 5
      app.state = 'PLAYING';

      // 强制触发跳跃践踏
      app.boss.state = 'PREPARE_STOMP';
      app.boss.stateTimer = 0.01;

      const samples = [];
      for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 16));
        samples.push({
          time: i * 16,
          y: app.boss.y,
          vy: app.boss.vy,
          state: app.boss.state,
          onGround: app.boss.onGround
        });
      }

      const minY = Math.min(...samples.map(s => s.y));
      const maxY = Math.max(...samples.map(s => s.y));
      return {
        initialY: samples[0].y,
        minY,
        maxY,
        finalY: samples[samples.length - 1].y,
        finalState: samples[samples.length - 1].state,
        finalOnGround: samples[samples.length - 1].onGround
      };
    });

    console.log('📊 Boss 跳跃轨迹采样结果:', jumpResult);
    if (jumpResult.minY < 52) {
      throw new Error(`Boss 跳跃超出屏幕安全区 (minY=${jumpResult.minY})`);
    }
    if (jumpResult.finalY !== 196) {
      throw new Error(`Boss 落地未精准回到地面 (finalY=${jumpResult.finalY})`);
    }

    const shotPath = path.join(__dirname, '../screenshots/boss_jump_fixed.png');
    await page.screenshot({ path: shotPath });
    console.log(`📸 已截取修复后 Boss 战实机截屏: ${shotPath}`);

    const dlPath = '/data/data/com.termux/files/home/storage/downloads/boss_jump_fixed.png';
    try {
      fs.copyFileSync(shotPath, dlPath);
      console.log(`💾 已同步至下载目录: ${dlPath}`);
    } catch (e) {}

    console.log('✅ Boss 跳跃物理修复验证 100% 通过！全程未超出屏幕！');
  } finally {
    await browser.close();
    console.log('🧹 浏览器进程已关闭，手机内存已完全释放。');
  }
}

testBossJump().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
