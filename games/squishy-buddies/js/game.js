/* ==========================================================================
   Squishy Buddies 1991 - Main Game Engine, Canvas Renderer & Controller Bridge
   Chunky Pixel Visuals, Mochi Follower Train & Game Boy Console Bridge
   ========================================================================== */

class SquishyGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.width = CANVAS_W; // 320
    this.height = CANVAS_H; // 240
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.audio = window.squishyAudio;
    this.hapticsEnabled = 'vibrate' in navigator;

    // Game state
    this.state = 'TITLE'; // 'TITLE', 'PLAYING', 'PAUSED', 'ROOM_CLEAR', 'VICTORY'
    this.levelIndex = 0;
    this.currentLevel = null;
    this.grid = null;
    this.player = null;
    this.bubbles = [];
    this.dews = [];
    this.sludges = [];
    this.particles = [];

    this.input = {
      left: false,
      right: false,
      up: false,
      down: false,
      a: false,
      b: false
    };

    this.lastTime = 0;
    this.stateTimer = 0;
    this.roomClearBannerTimer = 0;

    this.initControls();
    this.initGameBoyBridge();
    this.loadLevel(0);

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  vibrate(pattern) {
    if (this.hapticsEnabled) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  loadLevel(index) {
    this.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    this.currentLevel = LEVELS[this.levelIndex];
    // Deep clone the 2D grid
    this.grid = this.currentLevel.grid.map(row => [...row]);

    // Init player
    this.player = new PlayerBuddy(this.currentLevel.playerStart.x, this.currentLevel.playerStart.y);

    // Init dews
    this.dews = this.currentLevel.dews.map(d => new DewDrop(d.x, d.y));

    // Init sludges
    this.sludges = this.currentLevel.sludges.map(s => new SludgeCreep(s.x, s.y, s.range));

    this.bubbles = [];
    this.particles = [];
    this.roomClearBannerTimer = 0;
  }

  startGame() {
    this.audio.init();
    this.audio.startBgm();
    this.loadLevel(0);
    this.state = 'PLAYING';
    this.vibrate(20);
  }

  togglePause() {
    const now = performance.now();
    if (this._lastPauseToggle && now - this._lastPauseToggle < 200) return;
    this._lastPauseToggle = now;

    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.audio.stopBgm();
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.audio.startBgm();
    }
  }

  /* ================= Input Handling & Hardware Bridge ================= */

  initGameBoyBridge() {
    window.addEventListener('message', (event) => {
      if (!event.data || event.data.type !== 'GB_INPUT') return;
      this.audio.init();
      const { key, pressed } = event.data;

      if (this.state === 'TITLE') {
        if (pressed && (key === 'A' || key === 'START')) {
          this.startGame();
        }
        return;
      }

      if (this.state === 'VICTORY') {
        if (pressed && (key === 'A' || key === 'START')) {
          this.startGame();
        }
        return;
      }

      switch (key) {
        case 'LEFT':
          this.input.left = pressed;
          break;
        case 'RIGHT':
          this.input.right = pressed;
          break;
        case 'UP':
          this.input.up = pressed;
          break;
        case 'DOWN':
          this.input.down = pressed;
          break;
        case 'A':
          this.input.a = pressed;
          if (pressed && this.state === 'PLAYING') {
            this.player.jump();
            this.vibrate(10);
          }
          break;
        case 'B':
          this.input.b = pressed;
          if (pressed && this.state === 'PLAYING') {
            const b = this.player.spitBubble();
            if (b) {
              this.bubbles.push(b);
              this.vibrate(8);
            }
          }
          break;
        case 'SELECT':
          if (pressed && this.state === 'PLAYING') {
            this.player.nextBuddy();
            this.audio.playSwitch();
            this.vibrate([10, 20, 10]);
            this.spawnSwitchSparkles();
          }
          break;
        case 'START':
          if (pressed) this.togglePause();
          break;
      }
    });
  }

  initControls() {
    // Keyboard support for standalone mode
    window.addEventListener('keydown', (e) => {
      this.audio.init();
      if (this.state === 'TITLE' && (e.code === 'KeyZ' || e.code === 'Space' || e.code === 'Enter')) {
        this.startGame();
        return;
      }
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.input.left = true; break;
        case 'ArrowRight': case 'KeyD': this.input.right = true; break;
        case 'ArrowDown': case 'KeyS': this.input.down = true; break;
        case 'ArrowUp': case 'KeyW': this.input.up = true; break;
        case 'KeyZ': case 'Space':
          this.input.a = true;
          if (this.state === 'PLAYING') this.player.jump();
          break;
        case 'KeyX': case 'KeyJ':
          this.input.b = true;
          if (this.state === 'PLAYING') {
            const b = this.player.spitBubble();
            if (b) this.bubbles.push(b);
          }
          break;
        case 'ShiftLeft': case 'KeyC':
          if (this.state === 'PLAYING') {
            this.player.nextBuddy();
            this.audio.playSwitch();
            this.spawnSwitchSparkles();
          }
          break;
        case 'Enter':
          this.togglePause();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.input.left = false; break;
        case 'ArrowRight': case 'KeyD': this.input.right = false; break;
        case 'ArrowDown': case 'KeyS': this.input.down = false; break;
        case 'ArrowUp': case 'KeyW': this.input.up = false; break;
        case 'KeyZ': case 'Space': this.input.a = false; break;
        case 'KeyX': case 'KeyJ': this.input.b = false; break;
      }
    });

    // Touch controls for standalone deck
    const bindBtn = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this.audio.init(); onDown(); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); }, { passive: false });
      el.addEventListener('mousedown', (e) => { this.audio.init(); onDown(); });
      el.addEventListener('mouseup', (e) => { onUp(); });
    };

    bindBtn('btn-left', () => this.input.left = true, () => this.input.left = false);
    bindBtn('btn-right', () => this.input.right = true, () => this.input.right = false);
    bindBtn('btn-down', () => this.input.down = true, () => this.input.down = false);
    bindBtn('btn-up', () => this.input.up = true, () => this.input.up = false);
    bindBtn('btn-jump', () => {
      if (this.state === 'PLAYING') this.player.jump();
      this.input.a = true;
    }, () => this.input.a = false);
    bindBtn('btn-spit', () => {
      if (this.state === 'PLAYING') {
        const b = this.player.spitBubble();
        if (b) this.bubbles.push(b);
      }
      this.input.b = true;
    }, () => this.input.b = false);
    bindBtn('btn-switch', () => {
      if (this.state === 'PLAYING') {
        this.player.nextBuddy();
        this.audio.playSwitch();
        this.spawnSwitchSparkles();
      }
    }, () => {});
    bindBtn('btn-pause', () => this.togglePause(), () => {});
    bindBtn('btn-sound', () => {
      const en = this.audio.toggleSound();
      const el = document.getElementById('btn-sound');
      if (el) el.textContent = `🔊 声音: ${en ? '开' : '关'}`;
    }, () => {});
  }

  spawnSwitchSparkles() {
    for (let i = 0; i < 8; i++) {
      this.particles.push(new Particle(this.player.x, this.player.y, this.player.type.color));
    }
  }

  spawnPopParticles(x, y, color) {
    for (let i = 0; i < 6; i++) {
      this.particles.push(new Particle(x, y, color));
    }
  }

  /* ================= Update Logic ================= */

  update(dt) {
    if (this.state !== 'PLAYING') return;

    // 1. Update Player
    this.player.update(dt, this.input, this.grid, this.audio);

    // Hazard respawn check
    if (this.player.onHazard || this.player.y > CANVAS_H - 8) {
      this.vibrate([40, 30, 40]);
      this.audio.playPop();
      this.spawnPopParticles(this.player.x, this.player.y, this.player.type.color);
      this.player.x = this.currentLevel.playerStart.x;
      this.player.y = this.currentLevel.playerStart.y;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.onHazard = false;
    }

    // 2. Update Bubbles
    for (let b of this.bubbles) {
      b.update(dt, this.grid, this.bubbles);

      // Player jump interaction on bubble
      if (b.alive) {
        const dist = Math.hypot(this.player.x - b.x, (this.player.y + this.player.radius * 0.7) - b.y);
        if (dist < this.player.radius + b.radius) {
          if (b.type === 'BOUNCY') {
            // Super Trampoline Bounce!
            this.player.vy = -380;
            this.player.squashY = 1.6;
            this.audio.playJump();
            this.vibrate(18);
            this.spawnPopParticles(b.x, b.y, b.buddyType.color);
          } else if (b.type === 'SOLID') {
            // Firm solid ledge
            if (this.player.vy > 0 && this.player.y < b.y) {
              this.player.y = b.y - b.radius - this.player.radius * 0.7;
              this.player.vy = 0;
              this.player.onGround = true;
            }
          } else if (b.type === 'FLOAT') {
            // Ride float bubble upward
            if (this.player.vy > 0 && this.player.y < b.y) {
              this.player.y = b.y - b.radius - this.player.radius * 0.5;
              this.player.vy = b.vy;
              this.player.onGround = true;
            }
          } else if (b.type === 'STICKY') {
            // Sticky climb peg
            if (this.player.y < b.y) {
              this.player.y = b.y - b.radius - this.player.radius * 0.6;
              this.player.vy = 0;
              this.player.onGround = true;
            }
          } else if (b.type === 'CHAIN_POP') {
            // Detonate!
            b.alive = false;
            this.audio.playPop();
            this.spawnPopParticles(b.x, b.y, b.buddyType.color);
            this.triggerChainPop(b.x, b.y);
          }
        }
      }
    }
    this.bubbles = this.bubbles.filter(b => b.alive);

    // 3. Update Dews
    for (let d of this.dews) {
      d.update(dt, this.player, this.audio);
    }

    // Check if all dews collected to unlock gate
    const remainingDews = this.dews.filter(d => !d.collected).length;
    if (remainingDews === 0) {
      // Open Gate (turn T_GATE into T_AIR)
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (this.grid[r][c] === T_GATE) {
            this.grid[r][c] = T_AIR;
            this.spawnPopParticles(c * TILE_SIZE + 10, r * TILE_SIZE + 10, '#ffd700');
          }
        }
      }
    }

    // 4. Update Sludge Creeps
    for (let s of this.sludges) {
      s.update(dt, this.grid);
      if (s.alive && !s.isEncased) {
        // Check collision with player
        if (Physics.checkCircle(this.player.x, this.player.y, this.player.radius, s.x, s.y, s.radius)) {
          this.vibrate(30);
          this.player.vx = (this.player.x > s.x ? 1 : -1) * 120;
          this.player.vy = -120;
          this.audio.playPop();
        }

        // Check collision with Blue Float bubbles (Encase enemy!)
        for (let b of this.bubbles) {
          if (b.alive && b.type === 'FLOAT') {
            if (Physics.checkCircle(b.x, b.y, b.radius, s.x, s.y, s.radius)) {
              s.isEncased = true;
              s.encasedTimer = 6.0;
              b.alive = false;
              this.audio.playPop();
              this.spawnPopParticles(s.x, s.y, '#75c8f8');
            }
          }
        }
      }
    }

    // 5. Update Particles
    for (let p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.life > 0);

    // 6. Check Goal Reached
    const pCol = Math.floor(this.player.x / TILE_SIZE);
    const pRow = Math.floor(this.player.y / TILE_SIZE);
    if (this.grid[pRow] && this.grid[pRow][pCol] === T_GOAL) {
      this.audio.playRoomClear();
      this.vibrate([30, 40, 50]);
      if (this.levelIndex < LEVELS.length - 1) {
        this.loadLevel(this.levelIndex + 1);
        this.roomClearBannerTimer = 2.0;
      } else {
        this.state = 'VICTORY';
      }
    }

    if (this.roomClearBannerTimer > 0) this.roomClearBannerTimer -= dt;
  }

  triggerChainPop(cx, cy) {
    for (let b of this.bubbles) {
      if (b.alive && Math.hypot(b.x - cx, b.y - cy) < 45) {
        b.alive = false;
        this.audio.playPop();
        this.spawnPopParticles(b.x, b.y, b.buddyType.color);
      }
    }

    // Check adjacent cracked blocks
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c] === T_CRACKED) {
          const bx = c * TILE_SIZE + 10;
          const by = r * TILE_SIZE + 10;
          if (Math.hypot(bx - cx, by - cy) < 40) {
            this.grid[r][c] = T_AIR;
            this.spawnPopParticles(bx, by, '#c8b090');
          }
        }
      }
    }
  }

  /* ================= Canvas Graphics & Rendering ================= */

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Soft Pastel Sky Background (Retro Daybreak)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, this.height);
    bgGradient.addColorStop(0, '#1c2035');
    bgGradient.addColorStop(1, '#2a3148');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle LCD Grid Scanline
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let y = 0; y < this.height; y += 3) {
      ctx.fillRect(0, y, this.width, 1);
    }

    // 2. Render Tilemap
    this.renderTiles(ctx);

    // 3. Render Bubbles
    for (let b of this.bubbles) {
      this.drawBubble(ctx, b);
    }

    // 4. Render Dew Drops
    for (let d of this.dews) {
      if (!d.collected) this.drawDewDrop(ctx, d);
    }

    // 5. Render Sludge Creeps
    for (let s of this.sludges) {
      if (s.alive) this.drawSludge(ctx, s);
    }

    // 6. Render Trailing Mochi Parade (Followers)
    this.renderFollowers(ctx);

    // 7. Render Active Player Buddy
    this.drawDropletBuddy(ctx, this.player.x, this.player.y, this.player.type, this.player.squashX, this.player.squashY, this.player.facing, this.player.isBlinking);

    // 8. Render Particles
    for (let p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. Floating Micro HUD
    this.renderMicroHud(ctx);

    // 10. Overlays
    if (this.state === 'TITLE') this.renderTitleOverlay(ctx);
    else if (this.state === 'PAUSED') this.renderPauseOverlay(ctx);
    else if (this.state === 'VICTORY') this.renderVictoryOverlay(ctx);

    // Room clear toast
    if (this.state === 'PLAYING' && this.roomClearBannerTimer > 0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(20, 100, this.width - 40, 36);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(20, 100, this.width - 40, 36);

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★ 泉眼净化成功！进入下一关 ★', this.width / 2, 122);
      ctx.textAlign = 'left';
    }
  }

  renderTiles(ctx) {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const t = this.grid[r][c];
        const tx = c * TILE_SIZE;
        const ty = r * TILE_SIZE;

        if (t === T_SOLID) {
          // Solid Block: Deep indigo body with 1px bright top line
          ctx.fillStyle = '#22283a';
          ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#485478';
          ctx.fillRect(tx, ty, TILE_SIZE, 2);
          ctx.fillStyle = '#141824';
          ctx.fillRect(tx, ty + TILE_SIZE - 2, TILE_SIZE, 2);
        } else if (t === T_SPIKE) {
          // Hazards: High-contrast triangular red spikes
          ctx.fillStyle = '#ff3355';
          ctx.beginPath();
          ctx.moveTo(tx + 2, ty + TILE_SIZE);
          ctx.lineTo(tx + 6, ty + 6);
          ctx.lineTo(tx + 10, ty + TILE_SIZE);
          ctx.moveTo(tx + 10, ty + TILE_SIZE);
          ctx.lineTo(tx + 14, ty + 6);
          ctx.lineTo(tx + 18, ty + TILE_SIZE);
          ctx.fill();
        } else if (t === T_CRAWLWAY) {
          // Crawlway: striped warning ceiling
          ctx.fillStyle = '#3a3220';
          ctx.fillRect(tx, ty, TILE_SIZE, 8);
          ctx.fillStyle = '#f0c040';
          ctx.fillRect(tx + 4, ty + 2, 4, 4);
          ctx.fillRect(tx + 12, ty + 2, 4, 4);
        } else if (t === T_GATE) {
          // Locked Gate
          ctx.fillStyle = '#553020';
          ctx.fillRect(tx + 2, ty, TILE_SIZE - 4, TILE_SIZE);
          ctx.fillStyle = '#e8a020';
          ctx.fillRect(tx + 8, ty + 6, 4, 8);
        } else if (t === T_CRACKED) {
          // Breakable cracked stone
          ctx.fillStyle = '#504838';
          ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#c0a060';
          ctx.fillRect(tx + 4, ty + 4, 4, 2);
          ctx.fillRect(tx + 10, ty + 10, 6, 2);
        } else if (t === T_GOAL) {
          // Rainbow Spring Fountain
          ctx.fillStyle = '#ffd700';
          ctx.fillRect(tx + 3, ty + 8, 14, 12);
          ctx.fillStyle = '#00ffff';
          ctx.beginPath();
          ctx.arc(tx + 10, ty + 7, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Draw the iconic water-droplet / mochi shape from 软乎乎IP.png
  drawDropletBuddy(ctx, x, y, type, sx = 1.0, sy = 1.0, facing = 1, isBlinking = false, alpha = 1.0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(sx, sy);

    const r = type.radius;

    // 1. Water Droplet Silhouette with pointed top
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.35); // Pointed curved tip
    ctx.bezierCurveTo(r * 0.75, -r * 0.55, r * 1.25, r * 0.4, r * 0.95, r * 0.85);
    ctx.bezierCurveTo(r * 0.65, r * 1.15, -r * 0.65, r * 1.15, -r * 0.95, r * 0.85);
    ctx.bezierCurveTo(-r * 1.25, r * 0.4, -r * 0.75, -r * 0.55, 0, -r * 1.35);
    ctx.closePath();

    ctx.fillStyle = type.color;
    ctx.fill();

    // 2. Base Darker Rim Outline
    ctx.strokeStyle = type.dark;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 3. Top-Left Glossy Crescent Highlight
    ctx.fillStyle = type.highlight;
    ctx.beginPath();
    ctx.ellipse(-r * 0.45, -r * 0.25, r * 0.28, r * 0.45, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // 4. Facial Features (Follow facing direction)
    const eyeOffsetX = facing * 3.5;
    const eyeY = r * 0.15;

    // Pink Blush Cheeks
    ctx.fillStyle = type.blush;
    ctx.beginPath();
    ctx.ellipse(eyeOffsetX - 6.5, eyeY + 4, 2.5, 1.8, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeOffsetX + 6.5, eyeY + 4, 2.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes: Black Glossy Pearls with White Catchlight Dots
    ctx.fillStyle = '#201614';
    if (isBlinking) {
      // Cute blinking curved arcs
      ctx.strokeStyle = '#201614';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(eyeOffsetX - 4.5, eyeY + 1, 2.5, 0, Math.PI);
      ctx.arc(eyeOffsetX + 4.5, eyeY + 1, 2.5, 0, Math.PI);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(eyeOffsetX - 4.5, eyeY, 2.2, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + 4.5, eyeY, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // White sparkle reflections
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeOffsetX - 5.2, eyeY - 0.7, 0.9, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + 3.8, eyeY - 0.7, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tiny Smiling Mouth
    ctx.strokeStyle = '#201614';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(eyeOffsetX, eyeY + 3.5, 2.2, 0.1, Math.PI - 0.1);
    ctx.stroke();

    ctx.restore();
  }

  // Trailing Mochi Parade (The other 4 color buddies follow behind in a cute line!)
  renderFollowers(ctx) {
    const trailingKeys = BUDDY_KEYS.filter(k => k !== this.player.typeKey);
    const delayStep = 10;

    trailingKeys.forEach((key, idx) => {
      const trailIndex = (idx + 1) * delayStep;
      if (this.player.trail[trailIndex]) {
        const t = this.player.trail[trailIndex];
        const buddy = BUDDY_TYPES[key];
        const bob = Math.sin(performance.now() * 0.006 + idx) * 0.08;
        this.drawDropletBuddy(ctx, t.x, t.y, buddy, 0.82, 0.82 + bob, t.facing, false, 0.68);
      }
    });
  }

  drawBubble(ctx, b) {
    ctx.save();
    ctx.translate(b.x, b.y);

    const r = b.radius + Math.sin(b.wobble) * 0.8;

    // Translucent sphere
    ctx.fillStyle = b.buddyType.highlight + '66';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Bubble rim outline
    ctx.strokeStyle = b.buddyType.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Interior visual icon depending on type
    if (b.type === 'SOLID') {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-4, -4, 8, 8);
    } else if (b.type === 'BOUNCY') {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI);
      ctx.stroke();
    } else if (b.type === 'STICKY') {
      ctx.fillStyle = '#ff4080';
      ctx.beginPath();
      ctx.arc(0, -2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Specular highlight crescent
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.22, r * 0.4, -0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawDewDrop(ctx, d) {
    ctx.save();
    ctx.translate(d.x, d.y + Math.sin(d.sparkleTimer) * 2.5);

    // Glowing teardrop
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(0, 2, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-1.5, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawSludge(ctx, s) {
    ctx.save();
    ctx.translate(s.x, s.y);

    if (s.isEncased) {
      // Encased in transparent blue bubble
      ctx.fillStyle = 'rgba(117, 200, 248, 0.45)';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#75c8f8';
      ctx.stroke();
    }

    // Sludge monster blob
    ctx.fillStyle = '#4a4458';
    ctx.beginPath();
    ctx.ellipse(0, 0, s.radius * 1.1, s.radius * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Angry eyes
    ctx.fillStyle = '#ff2040';
    ctx.fillRect(-4, -3, 3, 3);
    ctx.fillRect(2, -3, 3, 3);

    ctx.restore();
  }

  renderMicroHud(ctx) {
    // 1. Left Avatar & Dew Counter
    ctx.fillStyle = 'rgba(15, 20, 32, 0.82)';
    ctx.fillRect(6, 6, 105, 22);
    ctx.strokeStyle = '#3e4868';
    ctx.lineWidth = 1;
    ctx.strokeRect(6, 6, 105, 22);

    // Current buddy mini circle
    ctx.fillStyle = this.player.type.color;
    ctx.beginPath();
    ctx.arc(18, 17, 7, 0, Math.PI * 2);
    ctx.fill();

    const dewsLeft = this.dews.filter(d => !d.collected).length;
    const dewsTotal = this.dews.length;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`${this.player.type.name.split(' ')[0]}`, 28, 20);

    ctx.fillStyle = '#00f0ff';
    ctx.fillText(`💧${dewsTotal - dewsLeft}/${dewsTotal}`, 72, 20);

    // 2. Right Room Badge
    ctx.fillStyle = 'rgba(15, 20, 32, 0.82)';
    ctx.fillRect(this.width - 105, 6, 99, 22);
    ctx.strokeStyle = '#3e4868';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.width - 105, 6, 99, 22);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`${this.currentLevel.title}`, this.width - 98, 20);
  }

  renderTitleOverlay(ctx) {
    ctx.fillStyle = 'rgba(15, 20, 32, 0.9)';
    ctx.fillRect(20, 35, this.width - 40, 170);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 35, this.width - 40, 170);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('软乎乎大冒险 1991', this.width / 2, 70);

    ctx.fillStyle = '#a0b0d8';
    ctx.font = '10px monospace';
    ctx.fillText('SQUISHY BUDDIES · 5 COLOR POP', this.width / 2, 90);

    // Draw all 5 buddies previewing in a row
    const startX = this.width / 2 - 55;
    BUDDY_KEYS.forEach((k, i) => {
      this.drawDropletBuddy(ctx, startX + i * 28, 120, BUDDY_TYPES[k], 0.9, 0.9, 1, false);
    });

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('👉 按 A 或 点击屏幕开始 👈', this.width / 2, 160);

    ctx.fillStyle = '#8f9cb8';
    ctx.font = '9px monospace';
    ctx.fillText('十字键:滚动  A:跳跃  B:吐泡泡  SEL:切人', this.width / 2, 185);
    ctx.textAlign = 'left';
  }

  renderPauseOverlay(ctx) {
    ctx.fillStyle = 'rgba(15, 20, 32, 0.85)';
    ctx.fillRect(60, 80, this.width - 120, 80);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(60, 80, this.width - 120, 80);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ 游戏已暂停', this.width / 2, 115);
    ctx.font = '10px monospace';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('按 START 或 点击继续', this.width / 2, 138);
    ctx.textAlign = 'left';
  }

  renderVictoryOverlay(ctx) {
    ctx.fillStyle = 'rgba(15, 20, 32, 0.92)';
    ctx.fillRect(20, 40, this.width - 40, 160);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 40, this.width - 40, 160);

    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 全员通关·彩虹泉复苏！', this.width / 2, 80);

    ctx.fillStyle = '#ffd700';
    ctx.font = '11px monospace';
    ctx.fillText('恭喜软乎乎五兄弟找回全部色彩', this.width / 2, 115);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('👉 按 A 或 点击重玩 👈', this.width / 2, 155);
    ctx.textAlign = 'left';
  }

  animate(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.animate);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.squishyApp = new SquishyGame();
});
