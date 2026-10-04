/* ==========================================================================
   Squishy Buddies 1991 - Elastic Physics & Grid Collision System
   Squash & Stretch Damped Spring Oscillator + Mobile-First Tile Collision
   ========================================================================== */

const TILE_SIZE = 20;
const GRID_COLS = 16;
const GRID_ROWS = 12;
const CANVAS_W = 320;
const CANVAS_H = 240;

// Tile definitions
const T_AIR = 0;
const T_SOLID = 1;       // Solid terrain with 1px top highlight
const T_SPIKE = 2;       // Hazard: pops bubbles, hurts squishy
const T_CRAWLWAY = 3;    // 1-tile narrow ceiling gap (must squish to pass)
const T_WATER = 4;       // Water pool (blue floats, others sink or slow down)
const T_GOAL = 5;        // Rainbow Spring Fountain (Level exit)
const T_GATE = 6;        // Locked gate (opens when all dews are collected)
const T_CRACKED = 7;     // Breakable block (broken by purple explosion or heavy stomp)

const Physics = {
  // Update squash & stretch spring oscillation toward targetSquashY
  updateSquashSpring(entity, dt) {
    const k = 220; // spring stiffness
    const d = 16;  // damping coefficient
    const diff = entity.targetSquashY - entity.squashY;
    entity.squashVelY += (diff * k - entity.squashVelY * d) * dt;
    entity.squashY += entity.squashVelY * dt;
    
    // Prevent invert or singularity
    entity.squashY = Math.max(0.25, Math.min(2.2, entity.squashY));

    // Volume Conservation: Sx * Sy = 1 -> Sx = 1 / sqrt(Sy)
    entity.squashX = 1 / Math.sqrt(entity.squashY);
  },

  // Check 2D AABB overlap
  checkAABB(x1, y1, w1, h1, x2, y2, w2, h2) {
    return (
      x1 < x2 + w2 &&
      x1 + w1 > x2 &&
      y1 < y2 + h2 &&
      y1 + h1 > y2
    );
  },

  // Check circle vs circle collision
  checkCircle(x1, y1, r1, x2, y2, r2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return (dx * dx + dy * dy) <= ((r1 + r2) * (r1 + r2));
  },

  // Get tile at pixel coordinates
  getTileAt(grid, px, py) {
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) {
      return T_SOLID; // boundary is solid
    }
    return grid[row][col];
  },

  // Resolve tile collisions for a moving entity with width, height, vx, vy
  resolveTileMove(entity, grid, dt) {
    const halfW = (entity.radius || 10) * (entity.isCrouched ? 1.3 : 0.85);
    const halfH = (entity.radius || 10) * (entity.isCrouched ? 0.4 : 0.85);

    const oldX = entity.x;
    const oldY = entity.y;

    // 1. Horizontal movement & collision
    entity.x += entity.vx * dt;

    // Screen horizontal bounds
    if (entity.x - halfW < 0) {
      entity.x = halfW;
      entity.vx = 0;
    } else if (entity.x + halfW > CANVAS_W) {
      entity.x = CANVAS_W - halfW;
      entity.vx = 0;
    }

    // Horizontal tile collision:
    // Strictly check body height, insetting by 2px from top and 3px from bottom
    // so the floor tile beneath the player is NEVER treated as a horizontal wall!
    const hMinCol = Math.floor((entity.x - halfW) / TILE_SIZE);
    const hMaxCol = Math.floor((entity.x + halfW) / TILE_SIZE);
    const hMinRow = Math.floor((entity.y - halfH + 2) / TILE_SIZE);
    const hMaxRow = Math.floor((entity.y + halfH - 3) / TILE_SIZE);

    for (let r = Math.max(0, hMinRow); r <= Math.min(GRID_ROWS - 1, hMaxRow); r++) {
      for (let c = Math.max(0, hMinCol); c <= Math.min(GRID_COLS - 1, hMaxCol); c++) {
        const t = grid[r][c];
        if (t === T_SOLID || t === T_GATE || t === T_CRACKED || (t === T_CRAWLWAY && !entity.isCrouched)) {
          if (entity.vx > 0) {
            entity.x = c * TILE_SIZE - halfW - 0.01;
            entity.vx = 0;
          } else if (entity.vx < 0) {
            entity.x = (c + 1) * TILE_SIZE + halfW + 0.01;
            entity.vx = 0;
          }
        }
      }
    }

    // 2. Vertical movement & gravity
    entity.vy += (entity.gravity || 580) * dt;
    entity.y += entity.vy * dt;

    // Vertical tile collision:
    // Inset horizontally by 3px so vertical side walls are not treated as floors or ceilings!
    entity.onGround = false;
    const vMinCol = Math.floor((entity.x - halfW + 3) / TILE_SIZE);
    const vMaxCol = Math.floor((entity.x + halfW - 3) / TILE_SIZE);
    const vMinRow = Math.floor((entity.y - halfH) / TILE_SIZE);
    const vMaxRow = Math.floor((entity.y + halfH) / TILE_SIZE);

    for (let r = Math.max(0, vMinRow); r <= Math.min(GRID_ROWS - 1, vMaxRow); r++) {
      for (let c = Math.max(0, vMinCol); c <= Math.min(GRID_COLS - 1, vMaxCol); c++) {
        const t = grid[r][c];
        if (t === T_SOLID || t === T_GATE || t === T_CRACKED || (t === T_CRAWLWAY && !entity.isCrouched)) {
          if (entity.vy > 0 && oldY + halfH <= r * TILE_SIZE + 8) {
            // Landing on top of tile (feet were above tile top)
            entity.y = r * TILE_SIZE - halfH;
            entity.vy = 0;
            entity.onGround = true;
          } else if (entity.vy < 0 && oldY - halfH >= (r + 1) * TILE_SIZE - 8) {
            // Hitting ceiling (head was below tile bottom)
            entity.y = (r + 1) * TILE_SIZE + halfH;
            entity.vy = 0;
          }
        } else if (t === T_SPIKE) {
          // Hazard detection
          if (Physics.checkAABB(
            entity.x - halfW + 2, entity.y - halfH + 2, (halfW - 2) * 2, (halfH - 2) * 2,
            c * TILE_SIZE + 2, r * TILE_SIZE + 6, TILE_SIZE - 4, TILE_SIZE - 6
          )) {
            entity.onHazard = true;
          }
        }
      }
    }

    // Floor boundary
    if (entity.y + halfH >= CANVAS_H - 4) {
      entity.y = CANVAS_H - 4 - halfH;
      entity.vy = 0;
      entity.onGround = true;
    }
  }
};
