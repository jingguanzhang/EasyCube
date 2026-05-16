/**
 * Rubik's Cube Rust WASM Solver — Web Worker
 */
import init, { RubiksSolver } from './rubiks_rust.js';

let solver = null;

// ============================================================
// 1. 状态字符串提取逻辑 (Kociemba 字符串 -> 数学坐标)
// ============================================================
const CORNER_FACELETS = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
const CORNER_COLORS = [[0, 1, 2], [0, 2, 4], [0, 4, 5], [0, 5, 1], [3, 2, 1], [3, 4, 2], [3, 5, 4], [3, 1, 5]];
const EDGE_FACELETS = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]];
const EDGE_COLORS = [[0, 1], [0, 2], [0, 4], [0, 5], [3, 1], [3, 2], [3, 4], [3, 5], [2, 1], [2, 4], [5, 4], [5, 1]];

const comboMap = new Map();
let idx = 0;
for (let a=0; a<9; a++) for(let b=a+1; b<10; b++) for(let c=b+1; c<11; c++) for(let d=c+1; d<12; d++) {
    comboMap.set(a*1000 + b*100 + c*10 + d, idx++);
}

function encodeCombo(pos) { return comboMap.get(pos[0]*1000 + pos[1]*100 + pos[2]*10 + pos[3]); }
function encodeCO(co) { let c=0; for(let i=0; i<7; i++) c = c*3 + co[i]; return c; }
function encodeEO(eo) { let c=0; for(let i=0; i<11; i++) c = c*2 + eo[i]; return c; }
function encodeCP(cp) { let c=0; for(let i=0; i<8; i++) { let cnt=0; for(let j=i+1; j<8; j++) if(cp[j]<cp[i]) cnt++; c = c*(8-i)+cnt; } return c; }

function getCoordsFromStateStr(stateStr) {
    const state = new Uint8Array(54);
    const cm = { 'U':0, 'R':1, 'F':2, 'D':3, 'L':4, 'B':5 };
    for (let i = 0; i < 54; i++) state[i] = cm[stateStr[i]];

    const cp = new Uint8Array(8), co = new Uint8Array(8);
    const ep = new Uint8Array(12), eo = new Uint8Array(12);

    for (let i = 0; i < 8; i++) {
        const c = [state[CORNER_FACELETS[i][0]], state[CORNER_FACELETS[i][1]], state[CORNER_FACELETS[i][2]]];
        for (let j = 0; j < 8; j++) {
            const sc = CORNER_COLORS[j];
            if (c[0]===sc[0] && c[1]===sc[1] && c[2]===sc[2]) { cp[i]=j; co[i]=0; break; }
            if (c[0]===sc[2] && c[1]===sc[0] && c[2]===sc[1]) { cp[i]=j; co[i]=1; break; }
            if (c[0]===sc[1] && c[1]===sc[2] && c[2]===sc[0]) { cp[i]=j; co[i]=2; break; }
        }
    }
    for (let i = 0; i < 12; i++) {
        const c = [state[EDGE_FACELETS[i][0]], state[EDGE_FACELETS[i][1]]];
        for (let j = 0; j < 12; j++) {
            const sc = EDGE_COLORS[j];
            if (c[0]===sc[0] && c[1]===sc[1]) { ep[i]=j; eo[i]=0; break; }
            if (c[0]===sc[1] && c[1]===sc[0]) { ep[i]=j; eo[i]=1; break; }
        }
    }
    const pos = []; 
    for (let i = 0; i < 12; i++) if (ep[i] >= 8) pos.push(i);
    pos.sort((a, b) => a - b);
    
    return { co: encodeCO(co), eo: encodeEO(eo), cp: encodeCP(cp), ep, slice: encodeCombo(pos) };
}


// ============================================================
// 2. Worker 消息收发核心
// ============================================================
self.onmessage = async function(e) {
    const msg = e.data;
    
    switch (msg.type) {
        case 'init':
            if (solver) {
                self.postMessage({ type: 'ready' });
                return;
            }
            try {
                self.postMessage({ type: 'progress', phase: 'WASM 引擎就绪', percent: 20 });
                await init(); 

                self.postMessage({ type: 'progress', phase: '正在下载 43MB 剪枝表...', percent: 50 });
                const res = await fetch('tables.bin');
                if (!res.ok) throw new Error("无法加载 tables.bin");
                
                self.postMessage({ type: 'progress', phase: '正在向内存装载数据...', percent: 90 });
                const buffer = await res.arrayBuffer();
                const binData = new Uint8Array(buffer);
                
                // 实例化神级引擎
                solver = new RubiksSolver(binData);
                self.postMessage({ type: 'ready' });
                
            } catch (err) {
                self.postMessage({ type: 'error', message: err.message });
            }
            break;

        case 'solve':
            try {
                if (!solver) throw new Error("WASM Engine Not Ready");

                // 1. 将前台传来的字符串转为数学坐标
                const { co, eo, cp, ep, slice } = getCoordsFromStateStr(msg.state);
                
                // 2. 调用内核爆破运算
                const maxDepth = msg.maxDepth || 22;
                const timeoutMs = msg.timeoutMs || 180000;
                const resultStr = solver.solve(co, eo, cp, ep, slice, maxDepth, timeoutMs);

                // 3. 结果判断与回传
                if (resultStr === "timeout") {
                    self.postMessage({ type: 'timeout' });
                } else if (resultStr === "not found") {
                    self.postMessage({ type: 'error', message: "无解或未找到路径" });
                } else {
                    const namesArray = resultStr === "" ? [] : resultStr.split(' ');
                    self.postMessage({
                        type: 'solution',
                        moves: null, // 前端未用到此字段
                        names: namesArray,
                        length: namesArray.length
                    });
                }
            } catch (err) {
                self.postMessage({ type: 'error', message: err.message });
            }
            break;

        default:
            self.postMessage({ type: 'error', message: 'Unknown message type: ' + msg.type });
    }
};