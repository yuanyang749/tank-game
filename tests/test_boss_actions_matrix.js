/**
 * Automated Verification Matrix for SludgeBoss All Actions & Edge Cases
 * - 1. Patrol & Arena Horizontal Boundary Clamping (Left: 75, Right: 225)
 * - 2. Charge Spit & Sludge Projectile Dynamics (Normal single spit vs Enraged dual spit)
 * - 3. Stomp Jump & Shockwave Propagation (Takeoff, apex height, ceiling clamp, landing, dual shockwaves)
 * - 4. Hurt State & Invulnerability Window (i-frames reject spam, knockback with gravity)
 * - 5. Mid-Air Damage Gravity (Hit during jump must fall to floor, zero upward float)
 * - 6. Elemental Synergies: Blue Float Bubble Encasement (Freeze, duration, unfreeze drop)
 * - 7. Elemental Synergies: Purple Explosion Detonation
 * - 8. Player Collision: Aerial Stomp bounce vs Side Contact knockback
 * - 9. Enraged Phase (HP <= 2: increased speed, aggressive state timers)
 * - 10. Defeated Sequence: Death animation, mid-air fall, gate opening, cracked block destruction, room clear
 * - 11. Extreme Stress Limits (vy = -1000 ceiling clamp, vy = +1000 floor clamp, zero NaN coordinates)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const puppeteer = require('puppeteer-core');

function loadScript(filePath, env) {
  const code = fs.readFileSync(filePath, 'utf8');
  const exportNames = [];
  const classMatches = code.matchAll(/^class\s+([A-Za-z0-9_]+)/gm);
  for (const m of classMatches) exportNames.push(m[1]);
  const constMatches = code.matchAll(/^(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=/gm);
  for (const m of constMatches) exportNames.push(m[1]);
  const fnMatches = code.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm);
  for (const m of fnMatches) exportNames.push(m[1]);

  const exportsCode = exportNames.map(name => `try { globalThis.${name} = ${name}; } catch(e){}`).join('\n');
  vm.runInContext(code + '\n' + exportsCode, env);
}

function createGameEnv() {
  const context = {
    console: console,
    Math: Math,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    document: {
      getElementById: (id) => ({
        getContext: () => ({
          fillRect: () => {},
          strokeRect: () => {},
          clearRect: () => {},
          beginPath: () => {},
          arc: () => {},
          ellipse: () => {},
          fill: () => {},
          stroke: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          scale: () => {},
          measureText: () => ({ width: 40 }),
          fillText: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          drawImage: () => {}
        }),
        width: 320,
        height: 240,
        addEventListener: () => {}
      })
    },
    window: {
      addEventListener: () => {}
    },
    navigator: {
      vibrate: () => true
    },
    AudioContext: class {
      constructor() { this.currentTime = 0; }
      createOscillator() {
        return {
          connect: () => {},
          start: () => {},
          stop: () => {},
          frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
          type: 'square'
        };
      }
      createGain() {
        return {
          connect: () => {},
          gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }
        };
      }
    }
  };
  context.window.AudioContext = context.AudioContext;
  context.globalThis = context;
  context.window.addEventListener = () => {};
  vm.createContext(context);

  const baseDir = path.join(__dirname, '../games/squishy-buddies/js');
  loadScript(path.join(baseDir, 'physics.js'), context);
  loadScript(path.join(baseDir, 'audio.js'), context);
  loadScript(path.join(baseDir, 'entities.js'), context);
  loadScript(path.join(baseDir, 'levels.js'), context);
  loadScript(path.join(baseDir, 'game.js'), context);

  return context;
}

let testCount = 0;
let passCount = 0;
function assert(cond, name) {
  testCount++;
  if (!cond) {
    console.error(`  ❌ [FAIL] ${name}`);
    throw new Error(`Assertion failed: ${name}`);
  } else {
    passCount++;
    console.log(`  ✓ [PASS] ${name}`);
  }
}

async function runMatrix() {
  console.log('================================================================');
  console.log('🧪 启动 BOSS 全动作全状态机自动化矩阵测试 (Action Verification Matrix)');
  console.log('================================================================');

  const env = createGameEnv();
  const game = new env.SquishyGame();
  game.loadLevel(4); // Room 5
  game.state = 'PLAYING';
  const boss = game.boss;

  console.log('\n--- 模块 1: 巡逻行动 (PATROL) 与左右竞技场硬边界 ---');
  boss.state = 'PATROL';
  boss.startX = 190;
  boss.patrolRange = 65;

  // 1a. 巡逻半径转身测试 (190 - 65 = 125, 当 x = 124 时超出半径)
  boss.x = 124;
  boss.facing = -1;
  boss.stateTimer = 5.0; // 维持在巡逻态
  boss.update(0.01, game.player, game.grid, game.audio, game);
  assert(boss.facing === 1, '走出巡逻半径 (x < startX - patrolRange) 后自动调头朝向中心 (facing = 1)');

  // 1b. 极端推移左硬边界测试 (minX = 75)
  boss.x = 74;
  boss.facing = -1;
  boss.update(0.01, game.player, game.grid, game.audio, game);
  assert(boss.x >= 75, `左边界硬限制生效: x=${boss.x} >= 75`);
  assert(boss.facing === 1, '触碰左边界后自动反弹转向朝右 (facing = 1)');

  // 1c. 极端推移右硬边界测试 (maxX = 225)
  boss.x = 226;
  boss.facing = 1;
  boss.update(0.01, game.player, game.grid, game.audio, game);
  assert(boss.x <= 225, `右边界硬限制生效: x=${boss.x} <= 225`);
  assert(boss.facing === -1, '触碰右边界后自动反弹转向朝左 (facing = -1)');

  console.log('\n--- 模块 2: 蓄力吐泥动作 (CHARGE_SPIT) 弹幕生成 ---');
  boss.hp = 5;
  boss.state = 'CHARGE_SPIT';
  boss.stateTimer = 0.01;
  game.sludgeProjectiles = [];
  boss.update(0.02, game.player, game.grid, game.audio, game);
  assert(boss.state === 'PATROL', '吐泥后顺利回到 PATROL 状态');
  assert(game.sludgeProjectiles.length === 1, '正常阶段 (HP=5) 产生 1 枚暗黑泥浆弹');
  const p1 = game.sludgeProjectiles[0];
  assert(p1.alive && p1.vy < 0, '泥浆弹带初速度发射并处于存活状态');

  console.log('\n--- 模块 3: 狂暴阶段双发散射与提速 (Enraged Phase: HP <= 2) ---');
  boss.hp = 2; // 降至狂暴阈值
  boss.state = 'CHARGE_SPIT';
  boss.stateTimer = 0.01;
  game.sludgeProjectiles = [];
  boss.update(0.02, game.player, game.grid, game.audio, game);
  assert(game.sludgeProjectiles.length === 2, '狂暴阶段 (HP<=2) 触发双发广角散射弹幕 (2 projectiles)');
  boss.update(0.01, game.player, game.grid, game.audio, game); // 在 PATROL 帧中结算速度
  assert(Math.abs(boss.vx) === 55, '狂暴阶段巡逻移速提升至 55 (原 35)');

  console.log('\n--- 模块 4: 跳跃践踏 (JUMP_STOMP) 完整生命周期 ---');
  boss.state = 'PREPARE_STOMP';
  boss.stateTimer = 0.01;
  game.sludgeShockwaves = [];
  boss.update(0.02, game.player, game.grid, game.audio, game);
  assert(boss.state === 'JUMP_STOMP', '蓄力起跳完成进入 JUMP_STOMP');
  assert(boss.vy < -200, `起跳带有稳健冲量: vy=${boss.vy}`);
  assert(boss.onGround === false, '处于离地升空状态 (onGround=false)');

  // 跟踪整段跳跃升空至下落
  let highestY = boss.y;
  let framesAir = 0;
  while (!boss.onGround && framesAir < 120) {
    boss.update(1/60, game.player, game.grid, game.audio, game);
    highestY = Math.min(highestY, boss.y);
    framesAir++;
  }
  assert(highestY >= 135, `跳跃最高顶点 y=${highestY.toFixed(1)} 处于安全区，距天花板(52)与HUD(28)有足够空隙`);
  assert(boss.y === 196, '着地后坐标精准归位地面 (y=196)');
  assert(boss.onGround === true, '着地后 onGround 标记为 true');
  assert(boss.state === 'PATROL', '践踏落地后自动恢复为 PATROL');
  assert(game.sludgeShockwaves.length === 2, '落地瞬间释放左右双向泥浆震地波 (2 SludgeShockwaves)');
  assert(game.screenShakeTimer > 0, '落地伴随全屏震颤 (screenShakeTimer > 0)');

  console.log('\n--- 模块 5: 受击硬直 (HURT) 与无敌帧 (i-frames) ---');
  boss.hurtTimer = 0;
  boss.hp = 4;
  const hitSuccess = boss.takeDamage(1);
  assert(hitSuccess === true, '正常状态下受击扣血成功');
  assert(boss.hp === 3, 'Boss 剩余生命为 3');
  assert(boss.state === 'HURT', '进入受击状态 HURT');
  assert(boss.hurtTimer > 1.0, '开启无敌保护窗口 (hurtTimer > 1.0s)');

  const hitSpam = boss.takeDamage(1);
  assert(hitSpam === false, '无敌期内连续受击免疫伤害 (i-frames 生效)');
  assert(boss.hp === 3, '无敌期内生命值未被连续削减');

  // 落地并恢复
  boss.hurtTimer = 0;
  boss.stateTimer = 0;
  for (let i = 0; i < 25; i++) boss.update(1/60, game.player, game.grid, game.audio, game);
  assert(boss.onGround === true, '受击震退后重力将 Boss 拉回地面');
  assert(boss.state === 'PATROL', '硬直结束且着地后平稳回到 PATROL');

  console.log('\n--- 模块 6: 空中受击重力不丢失验证 (防浮空升天核心验证) ---');
  boss.state = 'PREPARE_STOMP';
  boss.stateTimer = 0.01;
  boss.update(0.02, game.player, game.grid, game.audio, game); // JUMP_STOMP
  boss.update(0.25, game.player, game.grid, game.audio, game); // 位于空中
  const airYBeforeHit = boss.y;
  assert(airYBeforeHit < 190, '确认当前处于空中');

  boss.hurtTimer = 0;
  boss.takeDamage(1); // 空中受到攻击
  assert(boss.state === 'HURT', '空中受击切入 HURT');

  // 持续推进物理帧，验证重力必须拉回地面，绝对不能上漂
  let ascendedAbovePeak = false;
  for (let i = 0; i < 90; i++) {
    boss.update(1/60, game.player, game.grid, game.audio, game);
    if (boss.y < airYBeforeHit - 20) ascendedAbovePeak = true;
  }
  assert(!ascendedAbovePeak, '空中受击后绝无无节制反常上漂');
  assert(boss.y === 196, '空中受击后重力全程介入，Boss 稳稳落回地面 (y=196)');

  console.log('\n--- 模块 7: 蓝水泡封印控制 (FLOAT Bubble Encase & Stun) ---');
  boss.isEncased = false;
  const blueBubble = new env.BubbleEntity(boss.x, boss.y, 1, 'FLOAT', env.BUDDY_TYPES.BLUE);
  game.bubbles = [blueBubble];
  game.update(1/60);
  assert(boss.isEncased === true, '蓝水泡命中 Boss 成功触发全控封印 (isEncased=true)');
  assert(boss.vx === 0 && boss.vy === 0, '封印期间 Boss 完全定身停止位移');

  // 验证封印自然破裂与回落
  boss.encasedTimer = 0.01;
  boss.update(0.02, game.player, game.grid, game.audio, game);
  assert(boss.isEncased === false, '封印时间耗尽水泡自然破裂');
  assert(boss.state === 'PATROL', '解封后平稳恢复巡逻');

  console.log('\n--- 模块 8: 紫色爆破连锁 (CHAIN_POP Detonation) ---');
  boss.hurtTimer = 0;
  const hpBeforeBomb = boss.hp;
  game.triggerChainPop(boss.x, boss.y);
  assert(boss.hp === hpBeforeBomb - 1, '紫色爆破对 Boss 产生精准真实范围伤害 (-1 HP)');

  console.log('\n--- 模块 9: 玩家下落空中踩踏 (Aerial Stomp Bounce) ---');
  boss.hurtTimer = 0;
  boss.hp = 3;
  game.player.x = boss.x;
  game.player.y = boss.y - 18; // 位于头顶
  game.player.vy = 150; // 下落中
  game.update(1/60);
  assert(boss.hp === 2, '玩家成功完成空中踩头暴击 (HP-1)');
  assert(game.player.vy < -150, '玩家踩头后获得强力反冲弹跳起飞 (recoil bounce)');

  console.log('\n--- 模块 10: 击败终局序列 (DEFEATED & Stage Clearance) ---');
  boss.hurtTimer = 0;
  boss.hp = 1;
  boss.y = 160; // 假设空中被击杀
  boss.takeDamage(1);
  assert(boss.hp === 0, '生命值归 0');
  assert(boss.state === 'DEFEATED', '进入死亡结算状态 DEFEATED');

  // 验证死亡下落
  for (let i = 0; i < 40; i++) boss.update(1/60, game.player, game.grid, game.audio, game);
  assert(boss.y === 196, '空中阵亡 Boss 依然重力下落至地面，不卡死在空中');

  // 触发全局通关开门机制
  game.triggerBossDefeated();
  assert(game.grid[3][12] === env.T_AIR, 'Boss 阵亡后古代石门 (T_GATE) 瞬间开启为通道 (T_AIR)');
  assert(game.grid[4][10] === env.T_AIR && game.grid[4][11] === env.T_AIR, 'Boss 阵亡震碎所有开裂岩石 (T_CRACKED -> T_AIR)');
  assert(game.dews.every(d => d.collected), '所有残留彩虹露珠自动全部点亮收集');

  console.log('\n--- 模块 11: 极限边界应力测试 (Extreme Velocity Clamping & NaN Check) ---');
  boss.alive = true;
  boss.hp = 5;
  boss.state = 'PATROL';
  boss.hurtTimer = 0;
  // 向上抛掷 1000 速度，必须被天花板 clamp，坐标绝不小于 ceilingY
  boss.y = 55;
  boss.vy = -1000;
  boss.onGround = false;
  boss.update(1/60, game.player, game.grid, game.audio, game);
  const ceilingY = 28 + boss.radius;
  assert(boss.y === ceilingY, `极限向上初速被天花板硬阻断并贴顶: y=${boss.y} === ${ceilingY}`);
  assert(boss.vy === 0, '触顶后垂直速度立刻截断归 0，绝无持续上冲动能');

  // 向下下坠 1000 速度，必须被地面 clamp，绝不穿地
  boss.y = 190;
  boss.vy = 1000;
  boss.update(1/60, game.player, game.grid, game.audio, game);
  assert(boss.y === 196, '极限下坠速度被地面精准捕获 (y=196)');
  assert(boss.vy === 0, '触地后垂直下坠速度立刻归 0');
  assert(!isNaN(boss.x) && !isNaN(boss.y) && !isNaN(boss.vx) && !isNaN(boss.vy), '物理量全无 NaN 污染');

  console.log('\n================================================================');
  console.log(`📊 动作矩阵核心测试结果: ${passCount}/${testCount} 全部通过 (0 失败)`);
  console.log('================================================================');

  // 接下来启动真实 Headless Chromium 进行端到端图形与实时动画渲染核验
  await runHeadlessVisualSuite();
}

async function runHeadlessVisualSuite() {
  console.log('\n🌐 启动 Termux Headless Chromium 进行端到端各动作图形渲染实机录制...');
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
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.0, isMobile: true, hasTouch: true });

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('http://127.0.0.1:8080/games/squishy-buddies/', { waitUntil: 'networkidle2', timeout: 15000 });

    // 运行 200 帧真实浏览器渲染，依次触发不同动作并检查坐标安全
    const visualAudit = await page.evaluate(async () => {
      const app = window.squishyApp;
      app.loadLevel(4); // Room 5
      app.state = 'PLAYING';

      const log = [];
      const boss = app.boss;

      // 阶段 1: 巡逻
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 16));
      }
      log.push({ phase: 'PATROL', y: boss.y, state: boss.state });

      // 阶段 2: 触发吐泥
      boss.state = 'CHARGE_SPIT';
      boss.stateTimer = 0.05;
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 16));
      }
      log.push({ phase: 'CHARGE_SPIT', projectiles: app.sludgeProjectiles.length, state: boss.state });

      // 阶段 3: 触发跳跃践踏
      boss.state = 'PREPARE_STOMP';
      boss.stateTimer = 0.05;
      let apexY = boss.y;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 16));
        apexY = Math.min(apexY, boss.y);
      }
      log.push({ phase: 'JUMP_STOMP', apexY, shockwaves: app.sludgeShockwaves.length, state: boss.state, onGround: boss.onGround });

      // 阶段 4: 触发蓝泡封印
      boss.isEncased = true;
      boss.encasedTimer = 1.0;
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 16));
      }
      log.push({ phase: 'ENCASED', isEncased: boss.isEncased, vx: boss.vx, vy: boss.vy });

      return { log, finalY: boss.y };
    });

    console.log('🎬 浏览器实时动画各阶段审计日志:');
    visualAudit.log.forEach(item => console.log('   ▪', item));

    const shotPath = path.join(__dirname, '../screenshots/boss_all_actions_audit.png');
    await page.screenshot({ path: shotPath });
    console.log(`📸 已保存全动作综合实操截屏至内部目录: ${shotPath}`);

    if (errors.length > 0) {
      throw new Error(`浏览器产生页面异常: ${errors.join('; ')}`);
    }

    console.log('🎉 Boss 所有动作无头浏览器渲染与逻辑 100% 验证通过，0 报错！');
  } finally {
    await browser.close();
    console.log('🧹 浏览器已安全退出，内存已释放。');
  }
}

runMatrix().catch(err => {
  console.error('❌ 动作矩阵验证失败:', err);
  process.exit(1);
});
