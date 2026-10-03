/* ==========================================================================
   Map & Game Constants & Generation
   ========================================================================== */
const TILE_SIZE = 16;
const MAP_COLS = 26;
const MAP_ROWS = 26;
const CANVAS_WIDTH = 416;
const CANVAS_HEIGHT = 416;

const T_EMPTY = 0;
const T_BRICK = 1;
const T_STEEL = 2;
const T_WATER = 3;
const T_TREE  = 4;
const T_BASE  = 5;
const T_BASE_RUIN = 6;

const DIR_UP = 0;
const DIR_RIGHT = 1;
const DIR_DOWN = 2;
const DIR_LEFT = 3;

function generateMap(stage = 1) {
  const map = Array(MAP_ROWS).fill(0).map(() => Array(MAP_COLS).fill(T_EMPTY));
  
  function fillBlock(r1, c1, r2, c2, type) {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) map[r][c] = type;
      }
    }
  }

  // Classic Stage 1 Layout
  fillBlock(2, 2, 8, 3, T_BRICK);
  fillBlock(2, 6, 8, 7, T_BRICK);
  fillBlock(2, 10, 6, 11, T_BRICK);
  fillBlock(2, 14, 6, 15, T_BRICK);
  fillBlock(2, 18, 8, 19, T_BRICK);
  fillBlock(2, 22, 8, 23, T_BRICK);

  fillBlock(8, 12, 9, 13, T_STEEL);

  fillBlock(11, 2, 12, 5, T_BRICK);
  fillBlock(11, 8, 14, 9, T_BRICK);
  fillBlock(11, 16, 14, 17, T_BRICK);
  fillBlock(11, 20, 12, 23, T_BRICK);

  fillBlock(13, 11, 15, 14, T_TREE);

  fillBlock(16, 0, 16, 4, T_WATER);
  fillBlock(16, 21, 16, 25, T_WATER);

  fillBlock(18, 2, 21, 3, T_BRICK);
  fillBlock(18, 6, 21, 7, T_BRICK);
  fillBlock(18, 18, 21, 19, T_BRICK);
  fillBlock(18, 22, 21, 23, T_BRICK);

  fillBlock(18, 10, 19, 11, T_STEEL);
  fillBlock(18, 14, 19, 15, T_STEEL);

  // Base Eagle Shield
  fillBlock(23, 11, 25, 11, T_BRICK);
  fillBlock(23, 14, 25, 14, T_BRICK);
  fillBlock(23, 12, 23, 13, T_BRICK);

  // Eagle Base (2x2)
  map[24][12] = T_BASE;
  map[24][13] = T_BASE;
  map[25][12] = T_BASE;
  map[25][13] = T_BASE;

  // Add variation for higher stages
  if (stage > 1) {
    fillBlock(5, 4, 6, 5, T_STEEL);
    fillBlock(5, 20, 6, 21, T_STEEL);
    if (stage > 2) {
      fillBlock(14, 4, 14, 7, T_WATER);
      fillBlock(14, 18, 14, 21, T_WATER);
    }
  }

  return map;
}
