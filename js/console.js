/* ==========================================================================
   Antigravity Game Boy Console OS & Hardware Bridging Controller
   Authentic DMG-01 Multi-Cart & Hardware Utility Integration
   ========================================================================== */

class GameBoyConsole {
  constructor() {
    this.powerOn = true;
    this.audioCtx = null;
    this.currentCartridge = 'squishy-buddies';
    this.paletteMode = 'true'; // 'true' (原彩无扫描线), 'color' (复古扫描线), 'dmg', 'bw'
    this.inMenu = true; // Authentic Game Boy starts at the Multi-Cartridge game list!
    this.menuIndex = 0;
    this.games = ['squishy-buddies', 'tank-battle', 'space-invaders', 'tetris', 'tutorial'];
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

    // Auto-launch cartridge if ?game=<id> is provided in URL
    const reqGame = (typeof URLSearchParams !== 'undefined' && window.location && window.location.search)
      ? new URLSearchParams(window.location.search).get('game')
      : null;
    if (reqGame && this.games.includes(reqGame)) {
      this.menuIndex = this.games.indexOf(reqGame);
      this.updateMenuSelection();
      this.loadCartridge(reqGame);
    }
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
    if (items && items.length > 0) {
      const domGames = Array.from(items)
        .map(item => (item.dataset && item.dataset.game) || (item.getAttribute && item.getAttribute('data-game')))
        .filter(Boolean);
      if (domGames.length > 0) {
        this.games = domGames;
      }
    }
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

    // In-game Bezel Return Button
    if (this.inGameMenuBtn) {
      const triggerReturn = (e) => {
        if (e && e.type === 'touchstart') e.preventDefault();
        this.returnToMenu();
      };
      this.inGameMenuBtn.addEventListener('touchstart', triggerReturn, { passive: false });
      this.inGameMenuBtn.addEventListener('click', triggerReturn);
    }

    // Hardware RESET button on lower deck (Silkscreen button)
    const btnReset = document.getElementById('gb-btn-reset');
    if (btnReset) {
      const triggerReset = (e) => {
        if (e && (e.type === 'touchstart' || e.type === 'pointerdown')) e.preventDefault();
        btnReset.classList.add('active');
        setTimeout(() => btnReset.classList.remove('active'), 180);
        this.returnToMenu();
      };
      btnReset.addEventListener('touchstart', triggerReset, { passive: false });
      btnReset.addEventListener('pointerdown', triggerReset);
      btnReset.addEventListener('click', triggerReset);
    }

    // Listen for postMessage from nested iframes (games / docs)
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'GB_RESET') {
        this.returnToMenu();
      }
    });

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
      const isActive = index === this.menuIndex;
      item.classList.toggle('active', isActive);
      if (isActive) {
        try {
          item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (e) {
          item.scrollIntoView();
        }
      }
    });
    this.currentCartridge = this.games[this.menuIndex];
  }

  launchSelectedGame() {
    if (!this.powerOn) return;
    const gameId = this.games[this.menuIndex] || 'squishy-buddies';
    this.playGameStartSound();
    this.vibrate(14);
    this.loadCartridge(gameId);
  }

  // Load game into screen
  loadCartridge(gameId) {
    this.currentCartridge = gameId;
    this.inMenu = false;
    this.lastSelectTime = 0;
    this.lastStartTime = 0;

    // Ensure no chassis button retains keyboard focus on PC (prevents Space/Enter from clicking Reset)
    if (typeof document !== 'undefined' && document.activeElement && typeof document.activeElement.blur === 'function') {
      try { document.activeElement.blur(); } catch (e) {}
    }

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
    } else if (gameId === 'tetris') {
      url = 'games/tetris/index.html?embedded=1';
    } else if (gameId === 'squishy-buddies') {
      url = 'games/squishy-buddies/index.html?embedded=1';
    } else if (gameId === 'tutorial') {
      url = 'docs/gb-tutorial.html';
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

    const now = Date.now();
    if (pressed) {
      this.pressedKeys.add(key);
      this.vibrate(10);
      if (key === 'SELECT') this.lastSelectTime = now;
      if (key === 'START') this.lastStartTime = now;
    } else {
      this.pressedKeys.delete(key);
    }

    // Authentic Soft-Reset: SELECT + START pressed together, or SELECT -> START sequentially
    // Note: In squishy-buddies, SELECT is used constantly in-game to switch characters, so only simultaneous hold resets there.
    const isComboPressed = this.pressedKeys.has('SELECT') && this.pressedKeys.has('START');
    const isComboSequential = (
      this.currentCartridge !== 'squishy-buddies' &&
      key === 'START' &&
      this.lastSelectTime &&
      (now - this.lastSelectTime) < 800
    );

    if (isComboPressed || (pressed && isComboSequential)) {
      this.lastSelectTime = 0;
      this.lastStartTime = 0;
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

    // When playing a game: Bridge input cleanly to iframe via official GB_INPUT message
    if (this.iframe && this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage({
        type: 'GB_INPUT',
        key,
        pressed
      }, '*');
    }
  }

  /* ================= Hardware Physical Controls ================= */
  initHardwareButtons() {
    const btnA = document.getElementById('gb-btn-a');
    const btnB = document.getElementById('gb-btn-b');

    const bindButton = (el, key) => {
      if (!el) return;
      let activeTouchId = null;
      let isTouching = false;

      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isTouching = true;
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
        setTimeout(() => { isTouching = false; }, 300);
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
              setTimeout(() => { isTouching = false; }, 300);
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
              setTimeout(() => { isTouching = false; }, 300);
              break;
            }
          }
        }
      });

      let isMouseDown = false;
      el.addEventListener('mousedown', () => {
        if (isTouching) return;
        isMouseDown = true;
        el.classList.add('active');
        this.sendInput(key, true);
      });
      window.addEventListener('mouseup', () => {
        if (isTouching || !isMouseDown) return;
        isMouseDown = false;
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

  // Multi-Touch Safe Virtual Joystick on the Game Boy chassis (4-Way Cardinal Lock, Anti-Combo-Key)
  initDpadTouchSliding() {
    const dpadContainer = document.getElementById('gb-dpad');
    const stickEl = document.getElementById('gb-joystick-stick');
    const armUp = document.getElementById('dpad-up');
    const armDown = document.getElementById('dpad-down');
    const armLeft = document.getElementById('dpad-left');
    const armRight = document.getElementById('dpad-right');

    if (!dpadContainer) return;

    let activeTouchId = null;
    let isMouseDragging = false;
    let centerX = 0;
    let centerY = 0;
    let currentCardinal = null;
    const activeDirs = { UP: false, DOWN: false, LEFT: false, RIGHT: false };
    const MAX_STICK_TRAVEL = 34;
    const DEADZONE = 10;

    const updateCenter = () => {
      const rect = dpadContainer.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
    };
    updateCenter();
    window.addEventListener('resize', updateCenter);
    window.addEventListener('scroll', updateCenter);

    const setStickOffset = (sx, sy, dragging) => {
      if (!stickEl || !stickEl.style) return;
      stickEl.classList.toggle('dragging', Boolean(dragging));
      stickEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0px)`;
    };

    const applyDirections = (newDirs) => {
      const dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      let changed = false;
      dirs.forEach(dir => {
        const shouldBeActive = Boolean(newDirs && newDirs[dir]);
        if (activeDirs[dir] !== shouldBeActive) {
          activeDirs[dir] = shouldBeActive;
          this.sendInput(dir, shouldBeActive);
          if (shouldBeActive) changed = true;
        }
      });

      if (changed) this.vibrate(6);

      if (armUp) armUp.classList.toggle('active', activeDirs.UP);
      if (armDown) armDown.classList.toggle('active', activeDirs.DOWN);
      if (armLeft) armLeft.classList.toggle('active', activeDirs.LEFT);
      if (armRight) armRight.classList.toggle('active', activeDirs.RIGHT);

      if (!newDirs) {
        currentCardinal = null;
        setStickOffset(0, 0, false);
      }
    };

    const handleCoords = (clientX, clientY) => {
      if (centerX === 0 && centerY === 0) updateCenter();
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      // Update movable joystick cap position
      const clampedDist = Math.min(dist, MAX_STICK_TRAVEL);
      const rad = Math.atan2(dy, dx);
      const sx = dist > 0 ? Math.cos(rad) * clampedDist : 0;
      const sy = dist > 0 ? Math.sin(rad) * clampedDist : 0;
      setStickOffset(sx, sy, true);

      if (dist < DEADZONE) {
        currentCardinal = null;
        applyDirections(null);
        setStickOffset(sx, sy, true);
        return;
      }

      // 4-Way Single-Direction Cardinal Lock with Angular Hysteresis (prevents accidental 2-key combo triggers)
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      let nextDir = null;

      if (currentCardinal === 'LEFT' || currentCardinal === 'RIGHT') {
        // Stay horizontal unless vertical deflection clearly dominates (> ~51 deg)
        if (absY > absX * 1.25) {
          nextDir = dy >= 0 ? 'DOWN' : 'UP';
        } else {
          nextDir = dx >= 0 ? 'RIGHT' : 'LEFT';
        }
      } else if (currentCardinal === 'UP' || currentCardinal === 'DOWN') {
        // Stay vertical unless horizontal deflection clearly dominates (> ~51 deg)
        if (absX > absY * 1.25) {
          nextDir = dx >= 0 ? 'RIGHT' : 'LEFT';
        } else {
          nextDir = dy >= 0 ? 'DOWN' : 'UP';
        }
      } else {
        nextDir = absX >= absY ? (dx >= 0 ? 'RIGHT' : 'LEFT') : (dy >= 0 ? 'DOWN' : 'UP');
      }

      currentCardinal = nextDir;
      const dirs = { UP: false, DOWN: false, LEFT: false, RIGHT: false };
      dirs[nextDir] = true;
      applyDirections(dirs);
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

    // Touch start on Virtual Joystick: Bind strictly to this specific finger
    dpadContainer.addEventListener('touchstart', (e) => {
      e.preventDefault();
      updateCenter();

      const touch = e.changedTouches ? e.changedTouches[0] : (e.touches ? e.touches[0] : null);
      if (touch) {
        activeTouchId = touch.identifier;
        handleCoords(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    // Touch move: Track ONLY the finger bound to the Virtual Joystick
    window.addEventListener('touchmove', (e) => {
      if (activeTouchId === null) return;
      const touch = findDpadTouch(e.touches);
      if (touch) {
        e.preventDefault();
        handleCoords(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    // Touch end: Release Virtual Joystick and spring back to center
    const onTouchEnd = (e) => {
      if (activeTouchId === null) return;
      const touch = findDpadTouch(e.changedTouches);
      if (touch || !e.touches || e.touches.length === 0) {
        activeTouchId = null;
        applyDirections(null);
      }
    };
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    // Mouse drag support for desktop/browser testing
    dpadContainer.addEventListener('mousedown', (e) => {
      if (activeTouchId !== null) return;
      isMouseDragging = true;
      updateCenter();
      handleCoords(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
      if (!isMouseDragging) return;
      handleCoords(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
      if (isMouseDragging) {
        isMouseDragging = false;
        applyDirections(null);
      }
    });
  }

  initKeyboardBridge() {
    window.addEventListener('keydown', (e) => {
      // Never let Space/Enter activate a focused hardware button on PC
      if (typeof document !== 'undefined' && document.activeElement && document.activeElement.tagName === 'BUTTON') {
        try { document.activeElement.blur(); } catch (err) {}
      }
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          this.sendInput('UP', true);
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          this.sendInput('DOWN', true);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          this.sendInput('LEFT', true);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          this.sendInput('RIGHT', true);
          break;
        case 'KeyJ':
        case 'KeyZ':
        case 'Space':
          e.preventDefault();
          this.sendInput('A', true);
          break;
        case 'KeyK':
        case 'KeyX':
          e.preventDefault();
          this.sendInput('B', true);
          break;
        case 'Enter':
          e.preventDefault();
          this.sendInput('START', true);
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyC':
        case 'Tab':
          e.preventDefault();
          this.sendInput('SELECT', true);
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
        case 'ShiftRight':
        case 'KeyC':
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
    const palettes = ['true', 'color', 'dmg', 'bw'];
    const labels = { 'true': '原彩', 'color': 'COLOR', 'dmg': 'DMG', 'bw': 'B&W' };

    const idx = palettes.indexOf(this.paletteMode);
    this.paletteMode = palettes[(idx + 1) % palettes.length];
    
    if (this.screenFrame) {
      this.screenFrame.classList.remove('palette-true', 'palette-dmg', 'palette-bw', 'palette-color');
      this.screenFrame.classList.add(`palette-${this.paletteMode}`);
    }
    if (this.paletteLabel) {
      this.paletteLabel.innerText = labels[this.paletteMode];
    }
    if (this.btnPalette) {
      this.btnPalette.classList.toggle('true-color-active', this.paletteMode === 'true');
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
