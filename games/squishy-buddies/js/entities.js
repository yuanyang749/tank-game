/* ==========================================================================
   Squishy Buddies 1991 - Character, Bubble & Monster Entities
   The 5 Color Droplet IP Roster + 5 Elemental Bubble Types
   ========================================================================== */

const BUDDY_TYPES = {
  YELLOW: {
    id: 0,
    name: '黄圆圆 (大黄)',
    role: '坚固重装',
    color: '#ffd454',
    dark: '#d89c20',
    highlight: '#fff3a8',
    blush: '#ff8a9a',
    radius: 13,
    gravity: 660,
    jumpPower: -260,
    speed: 105,
    bubbleType: 'SOLID'
  },
  BLUE: {
    id: 1,
    name: '蓝波波',
    role: '浮水气囊',
    color: '#75c8f8',
    dark: '#3896e8',
    highlight: '#bce4fd',
    blush: '#e88ab8',
    radius: 10.5,
    gravity: 520,
    jumpPower: -275,
    speed: 120,
    bubbleType: 'FLOAT'
  },
  PINK: {
    id: 2,
    name: '粉嘟嘟',
    role: '糖胶粘附',
    color: '#ff8cb8',
    dark: '#d85088',
    highlight: '#ffc4dc',
    blush: '#ff6088',
    radius: 9.5,
    gravity: 460,
    jumpPower: -285,
    speed: 125,
    bubbleType: 'STICKY'
  },
  GREEN: {
    id: 3,
    name: '绿萌萌',
    role: '高弹跳跃',
    color: '#70d8a8',
    dark: '#38a878',
    highlight: '#bcf4dc',
    blush: '#e88ab8',
    radius: 10,
    gravity: 560,
    jumpPower: -320,
    speed: 130,
    bubbleType: 'BOUNCY'
  },
  PURPLE: {
    id: 4,
    name: '紫灵灵',
    role: '星光裂变',
    color: '#b898ec',
    dark: '#8860c8',
    highlight: '#dec8f8',
    blush: '#e88ab8',
    radius: 8.5,
    gravity: 540,
    jumpPower: -280,
    speed: 140,
    bubbleType: 'CHAIN_POP'
  }
};

const BUDDY_KEYS = ['YELLOW', 'BLUE', 'PINK', 'GREEN', 'PURPLE'];

class PlayerBuddy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1; // 1 for right, -1 for left
    this.onGround = false;
    this.isCrouched = false;
    this.onHazard = false;
    
    // Spring Squash & Stretch variables
    this.squashY = 1.0;
    this.squashX = 1.0;
    this.squashVelY = 0;
    this.targetSquashY = 1.0;

    // Active buddy selection (default Yellow)
    this.typeKey = 'YELLOW';
    this.type = BUDDY_TYPES[this.typeKey];
    this.radius = this.type.radius;
    this.gravity = this.type.gravity;

    // Follower buddies trail history for cute mochi parade
    this.trail = [];
    this.maxTrail = 60;

    // Animation & Emotion Timers
    this.blinkTimer = Math.random() * 3 + 2;
    this.isBlinking = false;
    this.walkCycle = 0;
    this.spitCooldown = 0;
  }

  setType(key) {
    this.typeKey = key;
    this.type = BUDDY_TYPES[key];
    this.radius = this.type.radius;
    this.gravity = this.type.gravity;
    // Pop switch spring
    this.squashY = 0.65;
    this.squashVelY = 14;
  }

  nextBuddy() {
    const currIdx = BUDDY_KEYS.indexOf(this.typeKey);
    const nextIdx = (currIdx + 1) % BUDDY_KEYS.length;
    this.setType(BUDDY_KEYS[nextIdx]);
  }

  jump() {
    if (this.onGround && !this.isCrouched) {
      this.vy = this.type.jumpPower;
      this.onGround = false;
      this.squashY = 1.45; // Launch stretch
      this.squashVelY = -8;
      if (window.squishyAudio) window.squishyAudio.playJump();
    }
  }

  spitBubble() {
    if (this.spitCooldown > 0) return null;
    this.spitCooldown = 0.28;

    // Inhale & recoil
    this.squashY = 0.75;
    this.squashVelY = 10;
    this.vx -= this.facing * 35; // Slight physics recoil pushback!

    const bubbleX = this.x + this.facing * (this.radius + 12);
    const bubbleY = this.y - 2;
    const bubble = new BubbleEntity(bubbleX, bubbleY, this.facing, this.type.bubbleType, this.type);
    
    if (window.squishyAudio) window.squishyAudio.playSpit();
    return bubble;
  }

  update(dt, input, grid, audio) {
    // 1. Handle Cooldowns & Blinking
    if (this.spitCooldown > 0) this.spitCooldown -= dt;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.isBlinking = !this.isBlinking;
      this.blinkTimer = this.isBlinking ? 0.12 : (Math.random() * 4 + 2);
    }

    // 2. Handle Inputs
    this.isCrouched = input.down && this.onGround;
    if (this.isCrouched) {
      this.targetSquashY = 0.38; // Pressed flat into a thin pancake
      this.vx *= 0.85; // Slower glide
    } else {
      this.targetSquashY = 1.0;
    }

    if (input.left) {
      this.facing = -1;
      this.vx = -this.type.speed * (this.isCrouched ? 0.5 : 1);
      this.walkCycle += dt * 14;
    } else if (input.right) {
      this.facing = 1;
      this.vx = this.type.speed * (this.isCrouched ? 0.5 : 1);
      this.walkCycle += dt * 14;
    } else {
      this.vx *= 0.7; // Smooth damping
    }

    // Walking rhythmic mini-squash (bouncy roll gait)
    if (this.onGround && Math.abs(this.vx) > 10 && !this.isCrouched) {
      this.targetSquashY = 1.0 + Math.sin(this.walkCycle) * 0.12;
    }

    const wasOnGround = this.onGround;

    // 3. Tile Move & Physics
    Physics.resolveTileMove(this, grid, dt);

    // Landing impact detection
    if (!wasOnGround && this.onGround) {
      this.squashY = 0.55; // Hard landing squash
      this.squashVelY = 12;
      if (audio) audio.playLand();
    }

    // Update spring oscillator
    Physics.updateSquashSpring(this, dt);

    // 4. Save Trail History for Trailing Buddies
    this.trail.unshift({ x: this.x, y: this.y, facing: this.facing });
    if (this.trail.length > this.maxTrail) this.trail.pop();
  }
}

class BubbleEntity {
  constructor(x, y, facing, type, buddyType) {
    this.x = x;
    this.y = y;
    this.vx = facing * 90;
    this.vy = -18; // Slight initial lift
    this.radius = 12;
    this.type = type; // 'SOLID', 'FLOAT', 'STICKY', 'BOUNCY', 'CHAIN_POP'
    this.buddyType = buddyType;
    this.alive = true;
    this.lifetime = 14; // seconds before fading
    this.age = 0;
    this.isStuck = false;
    this.wobble = Math.random() * Math.PI * 2;
  }

  update(dt, grid, bubbles) {
    this.age += dt;
    this.wobble += dt * 5;
    if (this.age > this.lifetime) {
      this.alive = false;
      return;
    }

    if (this.isStuck) return;

    // Behavior per bubble element
    if (this.type === 'FLOAT') {
      this.vy = Math.max(-45, this.vy - 35 * dt); // Floats upward like a balloon
      this.vx *= 0.95;
    } else if (this.type === 'BOUNCY') {
      this.vy += 80 * dt; // Slight gravity
    } else if (this.type === 'STICKY') {
      this.vx *= 0.9;
      this.vy *= 0.9;
    } else {
      this.vx *= 0.92;
      this.vy += 40 * dt;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Collision with solid blocks
    const col = Math.floor(this.x / TILE_SIZE);
    const row = Math.floor(this.y / TILE_SIZE);
    const t = Physics.getTileAt(grid, this.x, this.y);

    if (t === T_SOLID || t === T_GATE) {
      if (this.type === 'STICKY') {
        this.isStuck = true;
        this.vx = 0;
        this.vy = 0;
      } else if (this.type === 'SOLID') {
        this.vx = 0;
        this.vy = 0;
        this.isStuck = true; // Firmly docks as a stepping platform
      } else {
        this.vx = -this.vx * 0.5;
        this.vy = -this.vy * 0.5;
      }
    } else if (t === T_SPIKE) {
      this.alive = false; // Pops on spikes
    }

    // Screen bounds
    if (this.x < this.radius) { this.x = this.radius; this.vx = -this.vx; }
    if (this.x > CANVAS_W - this.radius) { this.x = CANVAS_W - this.radius; this.vx = -this.vx; }
    if (this.y < this.radius + 18) { this.y = this.radius + 18; this.vy = 0; }
    if (this.y > CANVAS_H - this.radius) { this.y = CANVAS_H - this.radius; this.vy = -this.vy * 0.4; }
  }
}

class DewDrop {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 6;
    this.collected = false;
    this.sparkleTimer = Math.random() * Math.PI * 2;
  }

  update(dt, player, audio) {
    if (this.collected) return;
    this.sparkleTimer += dt * 4;

    if (Physics.checkCircle(this.x, this.y, this.radius, player.x, player.y, player.radius)) {
      this.collected = true;
      if (audio) audio.playDew();
    }
  }
}

class SludgeCreep {
  constructor(x, y, range = 60) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.range = range;
    this.vx = 25;
    this.radius = 8;
    this.alive = true;
    this.isEncased = false;
    this.encasedTimer = 0;
  }

  update(dt, grid) {
    if (!this.alive) return;

    if (this.isEncased) {
      this.y -= 25 * dt; // Encased sludge floats upwards harmlessly
      this.encasedTimer -= dt;
      if (this.y < 20 || this.encasedTimer <= 0) {
        this.alive = false;
      }
      return;
    }

    this.x += this.vx * dt;
    if (Math.abs(this.x - this.startX) > this.range) {
      this.vx = -this.vx;
    }
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * 80 + 30;
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd - 20;
    this.color = color;
    this.life = 0.35 + Math.random() * 0.2;
    this.maxLife = this.life;
    this.radius = Math.random() * 2.5 + 1.5;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 120 * dt; // Gravity
    this.life -= dt;
  }
}
