/* ==========================================================================
   Antigravity Game Boy Console OS & Hardware Bridging Controller
   ========================================================================== */

class GameBoyConsole {
  constructor() {
    this.powerOn = true;
    this.audioCtx = null;
    this.currentCartridge = 'tank-battle';
    this.paletteMode = 'color'; // 'color', 'dmg', 'bw'
    
    this.iframe = document.getElementById('game-screen');
    this.screenFrame = document.getElementById('gb-screen-frame');
    this.batteryLed = document.getElementById('battery-led');
    this.screenOff = document.getElementById('screen-off-overlay');
    this.cartridgeModal = document.getElementById('cartridge-modal');

    this.activeTouchDir = null;

    this.initAudio();
    this.initHardwareButtons();
    this.initDpadTouchSliding();
    this.initKeyboardBridge();
    this.initCartridgeModal();
    this.initPaletteSwitcher();

    // Auto-load initial cartridge
    this.loadCartridge('tank-battle');
  }

  initAudio() {
    const unlock = () => {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.audioCtx = new AudioContext();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
    };
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
  }

  playBootChime() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.audioCtx = new AudioContext();
    }
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    const now = this.audioCtx.currentTime;
    
    // Classic DMG-01 "ba-ding!" Chime
    // Note 1: Fast ascending slide
    const osc1 = this.audioCtx.createOscillator();
    const gain1 = this.audioCtx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.linearRampToValueAtTime(1046.50, now + 0.18); // C6
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.linearRampToValueAtTime(0, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(this.audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.19);

    // Note 2: High crystalline chime bell
    const osc2 = this.audioCtx.createOscillator();
    const gain2 = this.audioCtx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(2093, now + 0.20); // C7
    gain2.gain.setValueAtTime(0.22, now + 0.20);
    gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.70);
    osc2.connect(gain2);
    gain2.connect(this.audioCtx.destination);
    osc2.start(now + 0.20);
    osc2.stop(now + 0.72);
  }

  vibrate(ms = 8) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  // Send input signal to loaded game
  sendInput(key, pressed) {
    if (!this.powerOn) return;

    if (pressed) this.vibrate(10);

    // 1. Post message to iframe
    if (this.iframe && this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage({
        type: 'GB_INPUT',
        key,
        pressed
      }, '*');
    }

    // 2. Try dispatching synthetic keyboard event on iframe document if accessible
    try {
      const doc = this.iframe.contentDocument;
      if (doc) {
        const keyMap = {
          'UP': { key: 'ArrowUp', code: 'ArrowUp' },
          'DOWN': { key: 'ArrowDown', code: 'ArrowDown' },
          'LEFT': { key: 'ArrowLeft', code: 'ArrowLeft' },
          'RIGHT': { key: 'ArrowRight', code: 'ArrowRight' },
          'A': { key: 'z', code: 'KeyZ' },
          'B': { key: 'x', code: 'KeyX' },
          'START': { key: 'Enter', code: 'Enter' },
          'SELECT': { key: 'Shift', code: 'ShiftLeft' }
        };
        const mapped = keyMap[key];
        if (mapped) {
          const evt = new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
            key: mapped.key,
            code: mapped.code,
            bubbles: true,
            cancelable: true
          });
          doc.dispatchEvent(evt);
        }
      }
    } catch (e) {}
  }

  initHardwareButtons() {
    // A & B Buttons
    const btnA = document.getElementById('gb-btn-a');
    const btnB = document.getElementById('gb-btn-b');

    const bindButton = (el, key) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        el.classList.add('active');
        this.sendInput(key, true);
      }, { passive: false });

      const onEnd = (e) => {
        e.preventDefault();
        el.classList.remove('active');
        this.sendInput(key, false);
      };
      el.addEventListener('touchend', onEnd, { passive: false });
      el.addEventListener('touchcancel', onEnd, { passive: false });
      el.addEventListener('mousedown', () => {
        el.classList.add('active');
        this.sendInput(key, true);
      });
      window.addEventListener('mouseup', () => {
        el.classList.remove('active');
        this.sendInput(key, false);
      });
    };

    bindButton(btnA, 'A');
    bindButton(btnB, 'B');

    // SELECT & START Buttons
    const btnSelect = document.getElementById('gb-btn-select');
    const btnStart = document.getElementById('gb-btn-start');
    bindButton(btnSelect, 'SELECT');
    bindButton(btnStart, 'START');

    // Top Bar Actions
    const topPower = document.getElementById('top-btn-power');
    if (topPower) {
      topPower.addEventListener('click', () => this.togglePower());
    }

    const topCartridge = document.getElementById('top-btn-cartridge');
    if (topCartridge) {
      topCartridge.addEventListener('click', () => this.openCartridgeModal());
    }

    const topFullscreen = document.getElementById('top-btn-fullscreen');
    if (topFullscreen) {
      topFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }
  }

  // Smooth sliding cross D-Pad on the Game Boy chassis
  initDpadTouchSliding() {
    const dpadContainer = document.getElementById('gb-dpad');
    const armUp = document.getElementById('dpad-up');
    const armDown = document.getElementById('dpad-down');
    const armLeft = document.getElementById('dpad-left');
    const armRight = document.getElementById('dpad-right');

    if (!dpadContainer) return;

    let isTouching = false;
    let centerX = 0;
    let centerY = 0;
    let currentDir = null;

    const setDir = (dir) => {
      if (currentDir === dir) return;
      if (currentDir) {
        this.sendInput(currentDir, false);
      }
      currentDir = dir;
      if (currentDir) {
        this.sendInput(currentDir, true);
      }

      armUp.classList.toggle('active', dir === 'UP');
      armDown.classList.toggle('active', dir === 'DOWN');
      armLeft.classList.toggle('active', dir === 'LEFT');
      armRight.classList.toggle('active', dir === 'RIGHT');
    };

    const handleCoords = (clientX, clientY) => {
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) {
        setDir(null);
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        setDir(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        setDir(dy > 0 ? 'DOWN' : 'UP');
      }
    };

    dpadContainer.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = dpadContainer.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      isTouching = true;
      handleCoords(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!isTouching) return;
      e.preventDefault();
      handleCoords(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    const endTouch = () => {
      if (isTouching) {
        isTouching = false;
        setDir(null);
      }
    };
    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);
  }

  initKeyboardBridge() {
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.sendInput('UP', true);
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.sendInput('DOWN', true);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.sendInput('LEFT', true);
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.sendInput('RIGHT', true);
          break;
        case 'KeyJ':
        case 'KeyZ':
        case 'Space':
          this.sendInput('A', true);
          break;
        case 'KeyK':
        case 'KeyX':
          this.sendInput('B', true);
          break;
        case 'Enter':
          this.sendInput('START', true);
          break;
        case 'ShiftLeft':
        case 'Tab':
          this.sendInput('SELECT', true);
          break;
        case 'KeyC':
          this.openCartridgeModal();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.sendInput('UP', false);
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.sendInput('DOWN', false);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.sendInput('LEFT', false);
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.sendInput('RIGHT', false);
          break;
        case 'KeyJ':
        case 'KeyZ':
        case 'Space':
          this.sendInput('A', false);
          break;
        case 'KeyK':
        case 'KeyX':
          this.sendInput('B', false);
          break;
        case 'Enter':
          this.sendInput('START', false);
          break;
        case 'ShiftLeft':
        case 'Tab':
          this.sendInput('SELECT', false);
          break;
      }
    });
  }

  initPaletteSwitcher() {
    const btnPalette = document.getElementById('top-btn-palette');
    if (!btnPalette) return;

    const palettes = ['color', 'dmg', 'bw'];
    const names = { 'color': '🎨 原彩', 'dmg': '🟢 经典点阵', 'bw': '⚪ Pocket黑白' };

    btnPalette.addEventListener('click', () => {
      const idx = palettes.indexOf(this.paletteMode);
      this.paletteMode = palettes[(idx + 1) % palettes.length];
      
      this.screenFrame.classList.remove('palette-dmg', 'palette-bw', 'palette-color');
      this.screenFrame.classList.add(`palette-${this.paletteMode}`);
      btnPalette.innerText = names[this.paletteMode];
      this.vibrate(10);
    });
  }

  initCartridgeModal() {
    const items = document.querySelectorAll('.cartridge-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const cartId = item.getAttribute('data-cart');
        if (cartId) {
          this.loadCartridge(cartId);
          this.closeCartridgeModal();
        }
      });
    });

    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeCartridgeModal());
    }
  }

  openCartridgeModal() {
    if (this.cartridgeModal) {
      this.cartridgeModal.classList.remove('hidden');
    }
  }

  closeCartridgeModal() {
    if (this.cartridgeModal) {
      this.cartridgeModal.classList.add('hidden');
    }
  }

  loadCartridge(cartId) {
    this.currentCartridge = cartId;
    let url = '';

    if (cartId === 'tank-battle') {
      url = 'games/tank-battle/index.html?embedded=1';
    } else if (cartId === 'space-invaders') {
      url = 'games/space-invaders/index.html?embedded=1';
    } else if (cartId === 'tutorial') {
      url = 'docs/tutorial.html';
    }

    if (this.iframe) {
      this.iframe.src = url;
    }

    // Play boot sound chime on cartridge load
    this.playBootChime();

    // Update active item in modal
    document.querySelectorAll('.cartridge-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-cart') === cartId);
    });
  }

  togglePower() {
    this.powerOn = !this.powerOn;
    const topPower = document.getElementById('top-btn-power');
    if (topPower) {
      topPower.innerText = this.powerOn ? '⚡ 电源: 开' : '💤 电源: 关';
      topPower.classList.toggle('active', this.powerOn);
    }

    if (this.batteryLed) {
      this.batteryLed.classList.toggle('powered', this.powerOn);
    }
    if (this.screenOff) {
      this.screenOff.classList.toggle('hidden', this.powerOn);
    }

    if (this.powerOn) {
      this.loadCartridge(this.currentCartridge);
    } else {
      if (this.iframe) this.iframe.src = 'about:blank';
    }
  }
}

window.addEventListener('load', () => {
  window.consoleInstance = new GameBoyConsole();
});
