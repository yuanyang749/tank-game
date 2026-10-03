/* ==========================================================================
   Antigravity Game Boy Console OS & Hardware Bridging Controller
   Authentic DMG-01 Multi-Cart & Hardware Utility Integration
   ========================================================================== */

class GameBoyConsole {
  constructor() {
    this.powerOn = true;
    this.audioCtx = null;
    this.currentCartridge = 'tank-battle';
    this.paletteMode = 'color'; // 'color', 'dmg', 'bw'
    this.inMenu = true; // Authentic Game Boy starts at the Multi-Cartridge game list!
    this.menuIndex = 0;
    this.games = ['tank-battle', 'space-invaders', 'tutorial'];
    this.pressedKeys = new Set();
    
    // Core Hardware Elements
    this.iframe = document.getElementById('game-screen');
    this.screenFrame = document.getElementById('gb-screen-frame');
    this.batteryLed = document.getElementById('battery-led');
    this.screenOff = document.getElementById('screen-off-overlay');
    this.menuView = document.getElementById('gb-menu-view');
    this.inGameMenuBtn = document.getElementById('in-game-menu-btn');
    this.paletteLabel = document.getElementById('palette-label');
    
    // Utility Buttons
    this.btnPower = document.getElementById('btn-power') || document.getElementById('top-btn-power');
    this.btnPalette = document.getElementById('btn-palette') || document.getElementById('top-btn-palette');
    this.btnFullscreen = document.getElementById('btn-fullscreen') || document.getElementById('top-btn-fullscreen');

    this.activeTouchDir = null;

    this.initAudio();
    this.initHardwareButtons();
    this.initDpadTouchSliding();
    this.initKeyboardBridge();
    this.initMenuView();
    this.initUtilityDock();

    // Boot up with authentic Game Boy chime
    this.playBootChime();
  }

  /* ================= 8-Bit Web Audio Engine ================= */
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

  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.audioCtx = new AudioContext();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Authentic DMG-01 "ba-ding!" Chime
  playBootChime() {
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    
    // Step 1: Fast ascending chromatic slide
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

    // Step 2: High crystalline chime bell
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

  // 8-bit Menu Navigation Blip
  playMenuBlip() {
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(740, now);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  // 8-bit Game Launch Start Sound
  playGameStartSound() {
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1760, now + 0.06);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  vibrate(ms = 8) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  /* ================= Game Boy Menu List Operations ================= */
  initMenuView() {
    const items = document.querySelectorAll('.menu-item');
    items.forEach((item, index) => {
      const selectAndLaunch = (e) => {
        if (e && e.type === 'touchstart') e.preventDefault();
        this.menuIndex = index;
        this.updateMenuSelection();
        this.launchSelectedGame();
      };
      item.addEventListener('touchstart', selectAndLaunch, { passive: false });
      item.addEventListener('click', selectAndLaunch);
    });

    if (this.inGameMenuBtn) {
      const triggerReturn = (e) => {
        if (e && e.type === 'touchstart') e.preventDefault();
        this.returnToMenu();
      };
      this.inGameMenuBtn.addEventListener('touchstart', triggerReturn, { passive: false });
      this.inGameMenuBtn.addEventListener('click', triggerReturn);
    }

    this.updateMenuSelection();
  }

  navigateMenu(delta) {
    if (!this.inMenu || !this.powerOn) return;
    const total = this.games.length;
    this.menuIndex = (this.menuIndex + delta + total) % total;
    this.updateMenuSelection();
    this.playMenuBlip();
    this.vibrate(8);
  }

  updateMenuSelection() {
    const items = document.querySelectorAll('.menu-item');
    items.forEach((item, index) => {
      item.classList.toggle('active', index === this.menuIndex);
    });
    this.currentCartridge = this.games[this.menuIndex];
  }

  launchSelectedGame() {
    if (!this.powerOn) return;
    const gameId = this.games[this.menuIndex] || 'tank-battle';
    this.playGameStartSound();
    this.vibrate(14);
    this.loadCartridge(gameId);
  }

  // Load game into screen
  loadCartridge(gameId) {
    this.currentCartridge = gameId;
    this.inMenu = false;

    // Hide Menu View
    if (this.menuView) {
      this.menuView.classList.remove('active');
      this.menuView.classList.add('hidden');
    }

    // Show In-Game Return Shortcut Badge
    if (this.inGameMenuBtn) {
      this.inGameMenuBtn.classList.remove('hidden');
    }

    let url = '';
    if (gameId === 'tank-battle') {
      url = 'games/tank-battle/index.html?embedded=1';
    } else if (gameId === 'space-invaders') {
      url = 'games/space-invaders/index.html?embedded=1';
    } else if (gameId === 'tutorial') {
      url = 'docs/tutorial.html';
    }

    if (this.iframe) {
      this.iframe.classList.remove('hidden');
      this.iframe.src = url;
    }
  }

  // Soft-reset back to the authentic Game Boy Menu List
  returnToMenu() {
    if (this.inMenu) return;
    this.inMenu = true;
    this.playMenuBlip();
    this.vibrate(12);

    // Stop and hide game iframe
    if (this.iframe) {
      this.iframe.classList.add('hidden');
      this.iframe.src = 'about:blank';
    }

    // Hide In-Game Return Badge
    if (this.inGameMenuBtn) {
      this.inGameMenuBtn.classList.add('hidden');
    }

    // Display LCD Menu View
    if (this.menuView) {
      this.menuView.classList.remove('hidden');
      this.menuView.classList.add('active');
    }

    this.updateMenuSelection();
  }

  /* ================= Input Handling & Console Bridge ================= */
  sendInput(key, pressed) {
    if (!this.powerOn) return;

    if (pressed) {
      this.pressedKeys.add(key);
      this.vibrate(10);
    } else {
      this.pressedKeys.delete(key);
    }

    // Authentic Soft-Reset Combo: SELECT + START simultaneously pressed!
    if (this.pressedKeys.has('SELECT') && this.pressedKeys.has('START')) {
      this.returnToMenu();
      return;
    }

    // When at the Game Boy Menu: Use D-Pad and Buttons to navigate!
    if (this.inMenu) {
      if (pressed) {
        if (key === 'UP') {
          this.navigateMenu(-1);
          return;
        } else if (key === 'DOWN') {
          this.navigateMenu(1);
          return;
        } else if (key === 'A' || key === 'START') {
          this.launchSelectedGame();
          return;
        }
      }
      return;
    }

    // When playing a game: Bridge input to iframe
    if (this.iframe && this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage({
        type: 'GB_INPUT',
        key,
        pressed
      }, '*');
    }

    // Also dispatch synthetic keyboard event on iframe document if accessible
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

  /* ================= Hardware Physical Controls ================= */
  initHardwareButtons() {
    const btnA = document.getElementById('gb-btn-a');
    const btnB = document.getElementById('gb-btn-b');

    const bindButton = (el, key) => {
      if (!el) return;
      let activeTouchId = null;

      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.changedTouches && e.changedTouches.length > 0) {
          activeTouchId = e.changedTouches[0].identifier;
        }
        el.classList.add('active');
        this.sendInput(key, true);
      }, { passive: false });

      const onEnd = (e) => {
        if (activeTouchId !== null && e.changedTouches) {
          let found = false;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
              found = true;
              break;
            }
          }
          if (!found) return; // Ignore touch ends from other fingers!
        }
        e.preventDefault();
        activeTouchId = null;
        el.classList.remove('active');
        this.sendInput(key, false);
      };

      el.addEventListener('touchend', onEnd, { passive: false });
      el.addEventListener('touchcancel', onEnd, { passive: false });

      // Window fallback to ensure release if finger leaves button
      window.addEventListener('touchend', (e) => {
        if (activeTouchId !== null && e.changedTouches) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
              activeTouchId = null;
              el.classList.remove('active');
              this.sendInput(key, false);
              break;
            }
          }
        }
      });
      window.addEventListener('touchcancel', (e) => {
        if (activeTouchId !== null && e.changedTouches) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
              activeTouchId = null;
              el.classList.remove('active');
              this.sendInput(key, false);
              break;
            }
          }
        }
      });

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
  }

  // Multi-Touch Safe Cross D-Pad on the Game Boy chassis
  initDpadTouchSliding() {
    const dpadContainer = document.getElementById('gb-dpad');
    const armUp = document.getElementById('dpad-up');
    const armDown = document.getElementById('dpad-down');
    const armLeft = document.getElementById('dpad-left');
    const armRight = document.getElementById('dpad-right');

    if (!dpadContainer) return;

    let activeTouchId = null;
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

      if (armUp) armUp.classList.toggle('active', dir === 'UP');
      if (armDown) armDown.classList.toggle('active', dir === 'DOWN');
      if (armLeft) armLeft.classList.toggle('active', dir === 'LEFT');
      if (armRight) armRight.classList.toggle('active', dir === 'RIGHT');
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

    const findDpadTouch = (touchList) => {
      if (activeTouchId === null || !touchList) return null;
      for (let i = 0; i < touchList.length; i++) {
        if (touchList[i].identifier === activeTouchId) {
          return touchList[i];
        }
      }
      return null;
    };

    // Touch start on D-Pad: Bind strictly to this specific finger
    dpadContainer.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = dpadContainer.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;

      // Use the touch that triggered this event (changedTouches), NOT e.touches[0]!
      const touch = e.changedTouches ? e.changedTouches[0] : (e.touches ? e.touches[0] : null);
      if (touch) {
        activeTouchId = touch.identifier;
        handleCoords(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    // Touch move: Track ONLY the finger bound to D-Pad (ignore other fingers like B button!)
    window.addEventListener('touchmove', (e) => {
      if (activeTouchId === null) return;
      const touch = findDpadTouch(e.touches);
      if (touch) {
        e.preventDefault();
        handleCoords(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    // Touch end: Release D-Pad ONLY when the D-Pad's specific finger lifts!
    const onTouchEnd = (e) => {
      if (activeTouchId === null) return;
      const touch = findDpadTouch(e.changedTouches);
      if (touch) {
        activeTouchId = null;
        setDir(null);
      }
    };
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    // Direct click/touch support on individual arms for fast discrete tapping
    const bindDirectArm = (armEl, dir) => {
      if (!armEl) return;
      armEl.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const touch = e.changedTouches ? e.changedTouches[0] : null;
        if (touch) activeTouchId = touch.identifier;
        const rect = dpadContainer.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
        setDir(dir);
      }, { passive: false });
    };

    bindDirectArm(armUp, 'UP');
    bindDirectArm(armDown, 'DOWN');
    bindDirectArm(armLeft, 'LEFT');
    bindDirectArm(armRight, 'RIGHT');
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
        case 'Escape':
          this.returnToMenu();
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

  /* ================= 3 SVG Hardware Utility Operations ================= */
  initUtilityDock() {
    // 1. Power Action
    if (this.btnPower) {
      this.btnPower.addEventListener('click', () => this.togglePower());
    }

    // 2. Palette Action
    if (this.btnPalette) {
      this.btnPalette.addEventListener('click', () => this.cyclePalette());
    }

    // 3. Fullscreen Action
    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    }
  }

  togglePower() {
    this.powerOn = !this.powerOn;
    this.vibrate(12);

    if (this.btnPower) {
      this.btnPower.classList.toggle('active', this.powerOn);
    }
    if (this.batteryLed) {
      this.batteryLed.classList.toggle('powered', this.powerOn);
    }
    if (this.screenOff) {
      this.screenOff.classList.toggle('hidden', this.powerOn);
    }

    if (this.powerOn) {
      this.playBootChime();
      if (this.inMenu) {
        if (this.menuView) {
          this.menuView.classList.remove('hidden');
          this.menuView.classList.add('active');
        }
      } else {
        this.loadCartridge(this.currentCartridge);
      }
    } else {
      if (this.iframe) this.iframe.src = 'about:blank';
      if (this.inGameMenuBtn) this.inGameMenuBtn.classList.add('hidden');
    }
  }

  cyclePalette() {
    const palettes = ['color', 'dmg', 'bw'];
    const labels = { 'color': 'COLOR', 'dmg': 'DMG', 'bw': 'B&W' };

    const idx = palettes.indexOf(this.paletteMode);
    this.paletteMode = palettes[(idx + 1) % palettes.length];
    
    if (this.screenFrame) {
      this.screenFrame.classList.remove('palette-dmg', 'palette-bw', 'palette-color');
      this.screenFrame.classList.add(`palette-${this.paletteMode}`);
    }
    if (this.paletteLabel) {
      this.paletteLabel.innerText = labels[this.paletteMode];
    }
    if (this.btnPalette) {
      this.btnPalette.classList.add('active');
      setTimeout(() => this.btnPalette.classList.remove('active'), 200);
    }
    this.vibrate(10);
  }

  toggleFullscreen() {
    this.vibrate(10);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        if (this.btnFullscreen) this.btnFullscreen.classList.add('active');
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        if (this.btnFullscreen) this.btnFullscreen.classList.remove('active');
      }).catch(() => {});
    }
  }
}

window.addEventListener('load', () => {
  window.consoleInstance = new GameBoyConsole();
});
