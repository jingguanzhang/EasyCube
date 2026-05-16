/**
 * ============================================================
 *  Rubik's Cube IDA* Solver — 终极扩展满血版 (含四核剪枝表)
 *  增加了 EP8(非中层8棱排列) 追踪，突破 15 步性能瓶颈
 *  内存占用预估：约 45 MB
 * ============================================================
 */

;(function (global) {
  'use strict';

  // 状态常数
  const N_CO = 2187, N_EO = 2048, N_CP = 40320, N_SLICE = 495;

  const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];
  const FACE_COLORS = ['W', 'R', 'G', 'Y', 'O', 'B'];
  
  const MOVE_NAMES_FTM = [];
  for (let f = 0; f < 6; f++) {
    MOVE_NAMES_FTM.push(FACE_NAMES[f], FACE_NAMES[f] + "'", FACE_NAMES[f] + '2');
  }
  const OPPOSITE = [3, 4, 5, 0, 1, 2];

  const CORNER_FACELETS = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
  const CORNER_COLORS = [[0, 1, 2], [0, 2, 4], [0, 4, 5], [0, 5, 1], [3, 2, 1], [3, 4, 2], [3, 5, 4], [3, 1, 5]];
  const EDGE_FACELETS = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]];
  const EDGE_COLORS = [[0, 1], [0, 2], [0, 4], [0, 5], [3, 1], [3, 2], [3, 4], [3, 5], [2, 1], [2, 4], [5, 4], [5, 1]];

  const CP_MOVE = [
    [3, 0, 1, 2, 4, 5, 6, 7], 
    [4, 1, 2, 0, 7, 5, 6, 3], 
    [1, 5, 2, 3, 0, 4, 6, 7], 
    [0, 1, 2, 3, 5, 6, 7, 4], 
    [0, 2, 6, 3, 4, 1, 5, 7], 
    [0, 1, 3, 7, 4, 5, 2, 6] 
  ];
  
  const CO_DELTA = [
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [2, 0, 0, 1, 1, 0, 0, 2], 
    [1, 2, 0, 0, 2, 1, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 1, 2, 0, 0, 2, 1, 0], 
    [0, 0, 1, 2, 0, 0, 2, 1]
  ];

  const EP_MOVE = [
    [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], 
    [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], 
    [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], 
    [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], 
    [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], 
    [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7]  
  ];

  const EO_DELTA = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1]
  ];

  const EP_MOVE_P1 = new Uint8Array(72), EP_MOVE_P2 = new Uint8Array(72), EP_MOVE_P3 = new Uint8Array(72);
  for (let m = 0; m < 6; m++) {
    for (let i = 0; i < 12; i++) {
      EP_MOVE_P1[m * 12 + i] = EP_MOVE[m][i];
      EP_MOVE_P2[m * 12 + i] = EP_MOVE[m][EP_MOVE[m][i]];
      EP_MOVE_P3[m * 12 + i] = EP_MOVE[m][EP_MOVE[m][EP_MOVE[m][i]]];
    }
  }

  const COMBO_TABLE = new Uint16Array(495 * 4);
  const comboMap = new Map();
  (function () {
    let idx = 0;
    for (let a = 0; a < 9; a++)
      for (let b = a + 1; b < 10; b++)
        for (let c = b + 1; c < 11; c++)
          for (let d = c + 1; d < 12; d++) {
            COMBO_TABLE[idx * 4 + 0] = a; COMBO_TABLE[idx * 4 + 1] = b;
            COMBO_TABLE[idx * 4 + 2] = c; COMBO_TABLE[idx * 4 + 3] = d;
            comboMap.set(a * 1000 + b * 100 + c * 10 + d, idx);
            idx++;
          }
  })();

  function encodeCombo(positions) { return comboMap.get(positions[0] * 1000 + positions[1] * 100 + positions[2] * 10 + positions[3]); }
  function decodeCombo(rank) { return [COMBO_TABLE[rank * 4 + 0], COMBO_TABLE[rank * 4 + 1], COMBO_TABLE[rank * 4 + 2], COMBO_TABLE[rank * 4 + 3]]; }

  function encodeSlicePos(ep) {
    const positions = [];
    for (let i = 0; i < 12; i++) if (ep[i] >= 8) positions.push(i);
    positions.sort((a, b) => a - b);
    return encodeCombo(positions);
  }

  function encodeCO(co) { let c = 0; for (let i = 0; i < 7; i++) c = c * 3 + co[i]; return c; }
  function decodeCO(c) {
    const co = new Uint8Array(8); let s = 0;
    for (let i = 6; i >= 0; i--) { co[i] = c % 3; c = (c / 3) | 0; s += co[i]; }
    co[7] = (3 - s % 3) % 3; return co;
  }
  function encodeEO(eo) { let c = 0; for (let i = 0; i < 11; i++) c = c * 2 + eo[i]; return c; }
  function decodeEO(c) {
    const eo = new Uint8Array(12); let s = 0;
    for (let i = 10; i >= 0; i--) { eo[i] = c % 2; c = (c / 2) | 0; s += eo[i]; }
    eo[11] = s % 2; return eo;
  }
  function encodeCP(cp) {
    let c = 0;
    for (let i = 0; i < 8; i++) {
      let cnt = 0;
      for (let j = i + 1; j < 8; j++) if (cp[j] < cp[i]) cnt++;
      c = c * (8 - i) + cnt;
    }
    return c;
  }
  function decodeCP(c) {
    const cp = new Uint8Array(8); const av = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let i = 0; i < 8; i++) {
      let f = 1; for (let k = 2; k <= 7 - i; k++) f *= k;
      const idx = (c / f) | 0; c = c % f;
      cp[i] = av[idx]; av.splice(idx, 1);
    }
    return cp;
  }

  // ==== 🌟新增：提取除 Slice(8-11) 之外的 8 个棱块的排列 ====
  function encodeEP8(epPool, offset = 0) {
    const ep8 = new Uint8Array(8);
    let idx = 0;
    for (let i = 0; i < 12; i++) {
      const val = epPool[offset + i];
      if (val < 8) ep8[idx++] = val;
    }
    let c = 0;
    for (let i = 0; i < 8; i++) {
      let cnt = 0;
      for (let j = i + 1; j < 8; j++) if (ep8[j] < ep8[i]) cnt++;
      c = c * (8 - i) + cnt;
    }
    return c;
  }

  function faceletsToCoords(state) {
    if (typeof state === 'string') state = stringToState(state);
    const cp = new Uint8Array(8), co = new Uint8Array(8);
    const ep = new Uint8Array(12), eo = new Uint8Array(12);
    const cUsed = new Uint8Array(8), eUsed = new Uint8Array(12);
    let cornerCount = 0, edgeCount = 0;

    for (let i = 0; i < 8; i++) {
      const c = [state[CORNER_FACELETS[i][0]], state[CORNER_FACELETS[i][1]], state[CORNER_FACELETS[i][2]]];
      for (let j = 0; j < 8; j++) {
        if (cUsed[j]) continue;
        const sc = CORNER_COLORS[j];
        if (c[0] === sc[0] && c[1] === sc[1] && c[2] === sc[2]) { cp[i] = j; co[i] = 0; cUsed[j] = 1; cornerCount++; break; }
        if (c[0] === sc[2] && c[1] === sc[0] && c[2] === sc[1]) { cp[i] = j; co[i] = 1; cUsed[j] = 1; cornerCount++; break; }
        if (c[0] === sc[1] && c[1] === sc[2] && c[2] === sc[0]) { cp[i] = j; co[i] = 2; cUsed[j] = 1; cornerCount++; break; }
      }
    }
    for (let i = 0; i < 12; i++) {
      const c = [state[EDGE_FACELETS[i][0]], state[EDGE_FACELETS[i][1]]];
      for (let j = 0; j < 12; j++) {
        if (eUsed[j]) continue;
        const sc = EDGE_COLORS[j];
        if (c[0] === sc[0] && c[1] === sc[1]) { ep[i] = j; eo[i] = 0; eUsed[j] = 1; edgeCount++; break; }
        if (c[0] === sc[1] && c[1] === sc[0]) { ep[i] = j; eo[i] = 1; eUsed[j] = 1; edgeCount++; break; }
      }
    }

    if (cornerCount !== 8 || edgeCount !== 12) throw new Error("Invalid state: 色块配置错误。");
    let coSum = 0; for(let i=0; i<8; i++) coSum += co[i];
    if (coSum % 3 !== 0) throw new Error("Invalid state: 存在单角翻转。");
    let eoSum = 0; for(let i=0; i<12; i++) eoSum += eo[i];
    if (eoSum % 2 !== 0) throw new Error("Invalid state: 存在单棱翻转。");
    let invC = 0, invE = 0;
    for (let i = 0; i < 7; i++) for (let j = i + 1; j < 8; j++) if (cp[i] > cp[j]) invC++;
    for (let i = 0; i < 11; i++) for (let j = i + 1; j < 12; j++) if (ep[i] > ep[j]) invE++;
    if ((invC % 2) !== (invE % 2)) throw new Error("Invalid state: 存在两块互换。");

    return { co: encodeCO(co), eo: encodeEO(eo), cp: encodeCP(cp), ep, slice: encodeSlicePos(ep) };
  }

  function applyMoveFTM(facelets, moveIdx) {
    const face = (moveIdx / 3) | 0, power = [1, 3, 2][moveIdx % 3];
    const { co, eo, cp, ep } = faceletsToCoords(facelets);
    let nco = co, neo = eo, ncp = cp, nep = new Uint8Array(ep);
    for (let p = 0; p < power; p++) {
      const dco = decodeCO(nco), deo = decodeEO(neo), dcp = decodeCP(ncp);
      const ndco = new Uint8Array(8), ndeo = new Uint8Array(12), ndcp = new Uint8Array(8), nnep = new Uint8Array(12);
      for (let i = 0; i < 8; i++) { ndcp[i] = dcp[CP_MOVE[face][i]]; ndco[i] = (dco[CP_MOVE[face][i]] + CO_DELTA[face][i]) % 3; }
      for (let i = 0; i < 12; i++) { nnep[i] = nep[EP_MOVE[face][i]]; ndeo[i] = (deo[EP_MOVE[face][i]] + EO_DELTA[face][i]) % 2; }
      nco = encodeCO(ndco); neo = encodeEO(ndeo); ncp = encodeCP(ndcp); nep = nnep;
    }
    const f = new Uint8Array(54);
    const dcp = decodeCP(ncp), dco = decodeCO(nco), deo = decodeEO(neo);
    const oriMap = [[0, 1, 2], [2, 0, 1], [1, 2, 0]];
    for (let i = 0; i < 8; i++) {
      const sc = CORNER_COLORS[dcp[i]], om = oriMap[dco[i]];
      f[CORNER_FACELETS[i][0]] = sc[om[0]]; f[CORNER_FACELETS[i][1]] = sc[om[1]]; f[CORNER_FACELETS[i][2]] = sc[om[2]];
    }
    for (let i = 0; i < 12; i++) {
      const sc = EDGE_COLORS[nep[i]];
      f[EDGE_FACELETS[i][0]] = sc[deo[i]]; f[EDGE_FACELETS[i][1]] = sc[1 - deo[i]];
    }
    for (let i = 0; i < 6; i++) f[i * 9 + 4] = i;
    return f;
  }

  function solvedState() {
    const f = new Uint8Array(54);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 9; j++) f[i * 9 + j] = i;
    return f;
  }
  function stateToString(f) { return Array.from(f).map(c => FACE_NAMES[c]).join(''); }
  function stringToState(s) {
    const f = new Uint8Array(54), cm = {}; FACE_COLORS.forEach((c, i) => cm[c] = i); FACE_NAMES.forEach((n, i) => cm[n] = i); 
    for (let i = 0; i < 54; i++) { const ch = s[i].toUpperCase(); f[i] = cm[ch] !== undefined ? cm[ch] : parseInt(ch) || 0; }
    return f;
  }

  function randomScramble(numMoves = 20) {
    let state = new Uint8Array(solvedState());
    const moves = []; let lastFace = -1;
    for (let i = 0; i < numMoves; i++) {
      let face; do { face = (Math.random() * 6) | 0; } while (face === lastFace);
      const mi = face * 3 + ((Math.random() * 3) | 0);
      state = applyMoveFTM(state, mi); moves.push(MOVE_NAMES_FTM[mi]); lastFace = face;
    }
    return { state, scramble: moves };
  }

  // ====================== 建立内存表 ======================

  function buildMoveTable6(size, decodeFn, encodeFn, permMove, deltaArr, modVal) {
    const table = new Uint16Array(size * 6);
    for (let c = 0; c < size; c++) {
      const arr = decodeFn(c), len = arr.length;
      for (let m = 0; m < 6; m++) {
        const n = new Uint8Array(len);
        for (let i = 0; i < len; i++) n[i] = (arr[permMove[m][i]] + (deltaArr ? deltaArr[m][i] : 0)) % modVal;
        table[c * 6 + m] = encodeFn(n);
      }
    }
    return table;
  }

  function buildSliceMoveTable() {
    const table = new Uint16Array(N_SLICE * 6);
    for (let combo = 0; combo < N_SLICE; combo++) {
      const positions = decodeCombo(combo), isSlice = new Uint8Array(12);
      for (const p of positions) isSlice[p] = 1;
      for (let m = 0; m < 6; m++) {
        const newPositions = [];
        for (let i = 0; i < 12; i++) if (isSlice[EP_MOVE[m][i]]) newPositions.push(i);
        newPositions.sort((a, b) => a - b);
        table[combo * 6 + m] = encodeCombo(newPositions);
      }
    }
    return table;
  }

  function expandToFTM(table6, size) {
    const table18 = new Uint16Array(size * 18);
    for (let c = 0; c < size; c++) {
      for (let f = 0; f < 6; f++) {
        const r1 = table6[c * 6 + f], r2 = table6[r1 * 6 + f], r3 = table6[r2 * 6 + f];
        table18[c * 18 + f * 3 + 0] = r1; table18[c * 18 + f * 3 + 1] = r3; table18[c * 18 + f * 3 + 2] = r2; 
      }
    }
    return table18;
  }

  function buildCombinedPruneTable(moveTable1, size1, moveTable2, size2, moveCount, start1, start2) {
    const size = size1 * size2, prune = new Int8Array(size).fill(-1);
    const startCoord = (start1 || 0) * size2 + (start2 || 0); prune[startCoord] = 0;
    let count = 1, depth = 0;
    let currentQueue = new Int32Array(size), nextQueue = new Int32Array(size), qHead = 0, qTail = 0;
    currentQueue[qTail++] = startCoord;

    while (count < size && qHead < qTail) {
      let nextTail = 0;
      for (let i = qHead; i < qTail; i++) {
        const coord = currentQueue[i], c1 = (coord / size2) | 0, c2 = coord % size2;
        for (let m = 0; m < moveCount; m++) {
          const nextCoord = moveTable1[c1 * moveCount + m] * size2 + moveTable2[c2 * moveCount + m];
          if (prune[nextCoord] === -1) { prune[nextCoord] = depth + 1; nextQueue[nextTail++] = nextCoord; count++; }
        }
      }
      depth++; qHead = 0; qTail = nextTail;
      const temp = currentQueue; currentQueue = nextQueue; nextQueue = temp;
    }
    return prune;
  }

  // ==== 🌟生成 EP8-Slice 联合专属剪枝表 ====
  // 必须使用独立的 BFS 算法，因为 EP8 和 Slice 的转动并非完全解耦
  function buildEp8SlicePruneTable(sliceMove, onProgress) {
    const size = N_CP * N_SLICE; // 40320 * 495 = 19,958,400
    const prune = new Int8Array(size).fill(-1);
    
    const solvedSlice = encodeCombo([8, 9, 10, 11]);
    const startCoord = 0 * N_SLICE + solvedSlice;
    prune[startCoord] = 0;
    
    let currentQueue = new Int32Array(size);
    let nextQueue = new Int32Array(size);
    let qHead = 0, qTail = 0;
    currentQueue[qTail++] = startCoord;
    
    let count = 1, depth = 0;
    const ep = new Uint8Array(12);
    const nextEp = new Uint8Array(12);
    
    while (count < size && qHead < qTail) {
      if (onProgress) onProgress('build_prune_tables (EP8 Super Table)', 70 + (count / size) * 30);
      let nextTail = 0;
      
      for (let i = qHead; i < qTail; i++) {
        const coord = currentQueue[i];
        const ep8_code = (coord / N_SLICE) | 0;
        const slice_code = coord % N_SLICE;
        
        // 极速还原 12棱 排列
        const slicePos = decodeCombo(slice_code);
        ep.fill(255);
        ep[slicePos[0]] = 8; ep[slicePos[1]] = 9; ep[slicePos[2]] = 10; ep[slicePos[3]] = 11;
        const ep8 = decodeCP(ep8_code); // ep8复用 decodeCP
        let idx = 0;
        for (let k = 0; k < 12; k++) {
          if (ep[k] === 255) ep[k] = ep8[idx++];
        }
        
        for (let m = 0; m < 18; m++) {
          const face = (m / 3) | 0, power = m % 3;
          const moveTable = power === 0 ? EP_MOVE_P1 : (power === 1 ? EP_MOVE_P3 : EP_MOVE_P2);
          for (let k = 0; k < 12; k++) nextEp[k] = ep[moveTable[face * 12 + k]];
          
          const nextSlice = sliceMove[slice_code * 18 + m];
          const nextEp8 = encodeEP8(nextEp, 0);
          const nextCoord = nextEp8 * N_SLICE + nextSlice;
          
          if (prune[nextCoord] === -1) {
            prune[nextCoord] = depth + 1;
            nextQueue[nextTail++] = nextCoord;
            count++;
          }
        }
      }
      depth++; qHead = 0; qTail = nextTail;
      const temp = currentQueue; currentQueue = nextQueue; nextQueue = temp;
    }
    return prune;
  }

  function isEpSolved(epPool, offset) {
    for (let i = 0; i < 12; i++) if (epPool[offset + i] !== i) return false;
    return true;
  }

  // ====================== IDA* 搜索核心 ======================

  function idaStar(co, eo, cp, ep, slice, tables, maxDepth, timeoutMs) {
    maxDepth = maxDepth || 22; timeoutMs = timeoutMs || 180000;
    
    const { coSlicePrune, eoSlicePrune, cpSlicePrune, ep8SlicePrune } = tables;
    const startEp8 = encodeEP8(ep, 0);
    
    // 🌟四核并发拦截计算
    let bound = Math.max(
      coSlicePrune[co * N_SLICE + slice], 
      eoSlicePrune[eo * N_SLICE + slice],
      cpSlicePrune[cp * N_SLICE + slice],
      ep8SlicePrune[startEp8 * N_SLICE + slice]
    );

    const path = [], epPool = new Uint8Array(30 * 12);
    for (let i = 0; i < 12; i++) epPool[i] = ep[i];

    const startTime = Date.now(), nodeCount = { count: 0 };
    while (bound <= maxDepth) {
      const t = _search(co, eo, cp, 0, slice, 0, bound, -1, path, tables, epPool, startTime, timeoutMs, nodeCount);
      if (t === -2) return { timeout: true };
      if (t === -1) return path.slice();
      if (t === 200) return null; 
      bound = t;
    }
    return null;
  }

  function _search(co, eo, cp, epOffset, slice, g, bound, lastFace, path, tables, epPool, startTime, timeoutMs, nodeCount) {
    const { coMove, eoMove, cpMove, sliceMove, coSlicePrune, eoSlicePrune, cpSlicePrune, ep8SlicePrune } = tables;
    
    if ((++nodeCount.count & 0xFFF) === 0 && (Date.now() - startTime > timeoutMs)) return -2;

    const currentEp8 = encodeEP8(epPool, epOffset);
    const h = Math.max(
      coSlicePrune[co * N_SLICE + slice],
      eoSlicePrune[eo * N_SLICE + slice],
      cpSlicePrune[cp * N_SLICE + slice],
      ep8SlicePrune[currentEp8 * N_SLICE + slice] // 🌟核弹级剪枝表发挥作用
    );

    const f = g + h; if (f > bound) return f;
    
    if (h === 0 && co === 0 && eo === 0 && cp === 0 && isEpSolved(epPool, epOffset)) return -1;

    let min = 200; const nextEpOffset = epOffset + 12;

    for (let face = 0; face < 6; face++) {
      if (face === lastFace || (lastFace !== -1 && face === OPPOSITE[lastFace] && face > lastFace)) continue;
      
      for (let power = 0; power < 3; power++) {
        const mi = face * 3 + power;
        const nco = coMove[co * 18 + mi], neo = eoMove[eo * 18 + mi], ncp = cpMove[cp * 18 + mi], nSlice = sliceMove[slice * 18 + mi];
        
        // 🌟极速预检 (Lazy Evaluation)：如果前三个表都不通过，直接砍断，千万不要去复制数组！
        const partialH = Math.max(
          coSlicePrune[nco * N_SLICE + nSlice],
          eoSlicePrune[neo * N_SLICE + nSlice],
          cpSlicePrune[ncp * N_SLICE + nSlice]
        );
        if (g + 1 + partialH > bound) {
          if (g + 1 + partialH < min) min = g + 1 + partialH; 
          continue; 
        }

        // 前三关通过，再计算稍昂贵的数组复制和第 4 个表
        const moveTable = power === 0 ? EP_MOVE_P1 : (power === 1 ? EP_MOVE_P3 : EP_MOVE_P2);
        for (let i = 0; i < 12; i++) epPool[nextEpOffset + i] = epPool[epOffset + moveTable[face * 12 + i]];

        const nextEp8 = encodeEP8(epPool, nextEpOffset);
        const nextH = Math.max(partialH, ep8SlicePrune[nextEp8 * N_SLICE + nSlice]);
        
        if (g + 1 + nextH > bound) { 
          if (g + 1 + nextH < min) min = g + 1 + nextH; 
          continue; 
        }

        path.push(mi);
        const t = _search(nco, neo, ncp, nextEpOffset, nSlice, g + 1, bound, face, path, tables, epPool, startTime, timeoutMs, nodeCount);
        if (t === -2 || t === -1) return t;
        if (t < min) min = t;
        path.pop();
      }
    }
    return min;
  }

  class RubiksSolver {
    constructor() { this._ready = false; }
    
    async init(onProgress) {
      if (this._ready) return;
      const p = onProgress || (() => {});
      
      p('build_tables', 0);
      const coMove6 = buildMoveTable6(N_CO, decodeCO, encodeCO, CP_MOVE, CO_DELTA, 3);
      const eoMove6 = buildMoveTable6(N_EO, decodeEO, encodeEO, EP_MOVE, EO_DELTA, 2);
      const cpMove6 = buildMoveTable6(N_CP, decodeCP, encodeCP, CP_MOVE, null, 8);
      const sliceMove6 = buildSliceMoveTable();
      
      p('expand_ftm', 20);
      const coMove = expandToFTM(coMove6, N_CO), eoMove = expandToFTM(eoMove6, N_EO);
      const cpMove = expandToFTM(cpMove6, N_CP), sliceMove = expandToFTM(sliceMove6, N_SLICE);
      
      p('build_prune_tables (Phase 1/4)', 30);
      const solvedSlice = encodeCombo([8, 9, 10, 11]);
      const coSlicePrune = buildCombinedPruneTable(coMove, N_CO, sliceMove, N_SLICE, 18, 0, solvedSlice);
      
      p('build_prune_tables (Phase 2/4)', 40);
      const eoSlicePrune = buildCombinedPruneTable(eoMove, N_EO, sliceMove, N_SLICE, 18, 0, solvedSlice);
      
      p('build_prune_tables (Phase 3/4)', 50);
      const cpSlicePrune = buildCombinedPruneTable(cpMove, N_CP, sliceMove, N_SLICE, 18, 0, solvedSlice);
      
      p('build_prune_tables (Phase 4/4) - Building Massive Table...', 70);
      // 🌟生成核弹级 EP8 剪枝表 (20MB, 耗时可能在 2~10 秒，在 Worker 内运行完美)
      const ep8SlicePrune = buildEp8SlicePruneTable(sliceMove, p);
      
      p('ready', 100);
      this._tables = { coMove, eoMove, cpMove, sliceMove, coSlicePrune, eoSlicePrune, cpSlicePrune, ep8SlicePrune };
      this._ready = true;
    }
    
    solve(state, maxDepth = 22, timeoutMs = 60000) { // 默认上限给足 60 秒供突破极限
      if (!this._ready) throw new Error('Solver not initialized');
      const { co, eo, cp, ep, slice } = faceletsToCoords(state);
      const moves = idaStar(co, eo, cp, ep, slice, this._tables, maxDepth, timeoutMs);
      if (!moves) return null;
      if (moves.timeout) return { timeout: true };
      const names = moves.map(m => MOVE_NAMES_FTM[m]);
      return { moves, names, length: moves.length, solution: names.join(' ') };
    }
    
    solveToString(stateStr, maxDepth = 22, timeoutMs = 60000) {
      try {
        const res = this.solve(stateStr, maxDepth, timeoutMs);
        if (res && res.timeout) return "error: timeout";
        if (res && res.solution) return res.solution;
        return ""; 
      } catch (e) {
        return "error: " + e.message; 
      }
    }
    get ready() { return this._ready; }
  }

  // 暴露公共接口
  RubiksSolver.MOVE_NAMES = MOVE_NAMES_FTM; RubiksSolver.FACE_COLORS = FACE_COLORS; RubiksSolver.FACE_NAMES = FACE_NAMES;
  RubiksSolver.CORNER_FACELETS = CORNER_FACELETS; RubiksSolver.EDGE_FACELETS = EDGE_FACELETS; RubiksSolver.OPPOSITE = OPPOSITE;
  RubiksSolver.faceletsToCoords = faceletsToCoords; RubiksSolver.applyMoveFTM = applyMoveFTM; RubiksSolver.solvedState = solvedState;
  RubiksSolver.stateToString = stateToString; RubiksSolver.randomScramble = randomScramble; RubiksSolver.stringToState = stringToState;

  if (typeof module !== 'undefined' && module.exports) module.exports = RubiksSolver;
  else global.RubiksSolver = RubiksSolver;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : global);