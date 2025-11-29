/**
 * Pre-built Visualization Templates
 * 
 * This library provides ready-to-use visualization templates for common
 * educational patterns: sorting algorithms, data structures, graphs, trees, etc.
 * 
 * AI models can reference these templates to generate more reliable visualizations.
 */

// =============================================================================
// THEME CONSTANTS
// =============================================================================

export const THEME = {
  // Backgrounds
  bgDark: '#030711',      // hsl(224, 71%, 4%)
  bgSurface: '#0f172a',   // hsl(222, 47%, 11%)
  bgBorder: '#1e293b',    // hsl(217, 33%, 17%)
  bgLight: '#f1f5f9',     // Light background for cards
  
  // Text
  textPrimary: '#e2e8f0', // hsl(213, 31%, 91%)
  textMuted: '#94a3b8',   // hsl(215, 20%, 65%)
  textDark: '#0f172a',    // Dark text for light backgrounds
  
  // Accent Colors
  primary: '#3b82f6',     // Blue
  success: '#22c55e',     // Green
  warning: '#f59e0b',     // Amber
  error: '#ef4444',       // Red
  
  // Visualization States
  comparing: '#fbbf24',   // Yellow - comparing elements
  swapping: '#ef4444',    // Red - swapping/moving
  sorted: '#22c55e',      // Green - completed/sorted
  active: '#3b82f6',      // Blue - active/selected
  visited: '#8b5cf6',     // Purple - visited nodes
};

// =============================================================================
// BASE CSS STYLES
// =============================================================================

export const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: system-ui, -apple-system, sans-serif;
    background: ${THEME.bgDark};
    color: ${THEME.textPrimary};
    padding: 12px;
    min-height: 100%;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
    padding: 10px 12px;
    background: ${THEME.bgSurface};
    border-radius: 8px;
    border: 1px solid ${THEME.bgBorder};
  }
  button {
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    background: ${THEME.primary};
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  }
  button:hover { opacity: 0.9; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button.secondary { background: ${THEME.bgBorder}; }
  button.success { background: ${THEME.success}; }
  button.danger { background: ${THEME.error}; }
  input[type="range"] {
    width: 120px;
    accent-color: ${THEME.primary};
  }
  label {
    color: ${THEME.textMuted};
    font-size: 14px;
    margin-right: 8px;
  }
  select {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid ${THEME.bgBorder};
    background: ${THEME.bgSurface};
    color: ${THEME.textPrimary};
    font-size: 14px;
  }
  .info-box {
    padding: 12px;
    background: ${THEME.bgSurface};
    border-radius: 8px;
    border: 1px solid ${THEME.bgBorder};
    margin-top: 12px;
    font-size: 14px;
    color: ${THEME.textMuted};
  }
  canvas {
    border-radius: 8px;
    display: block;
    background: ${THEME.bgSurface};
  }
  .node {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: ${THEME.bgLight};
    color: ${THEME.textDark};
    font-weight: 600;
    font-size: 16px;
    border: 3px solid ${THEME.bgBorder};
    transition: all 0.3s;
  }
  .node.active { border-color: ${THEME.active}; background: ${THEME.primary}; color: white; }
  .node.visited { border-color: ${THEME.visited}; background: ${THEME.visited}; color: white; }
  .node.comparing { border-color: ${THEME.comparing}; background: ${THEME.comparing}; color: ${THEME.textDark}; }
  .node.sorted { border-color: ${THEME.success}; background: ${THEME.success}; color: white; }
`;

// =============================================================================
// SORTING ALGORITHM VISUALIZATION
// =============================================================================

export const SORTING_VIZ_TEMPLATE = {
  name: 'Sorting Algorithm Visualization',
  description: 'Visualize sorting algorithms with animated bar chart',
  html: '<div id="viz-container"></div>',
  css: BASE_CSS + `
    .bar-container {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 4px;
      height: 250px;
      padding: 20px;
      background: ${THEME.bgSurface};
      border-radius: 8px;
    }
    .bar {
      width: 40px;
      background: ${THEME.primary};
      border-radius: 4px 4px 0 0;
      transition: all 0.3s;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 4px;
      color: white;
      font-size: 12px;
      font-weight: 600;
    }
    .bar.comparing { background: ${THEME.comparing}; color: ${THEME.textDark}; }
    .bar.swapping { background: ${THEME.error}; }
    .bar.sorted { background: ${THEME.success}; }
  `,
  javascript: `
const container = document.getElementById('viz-container');
container.innerHTML = '';

// State
let data = [64, 34, 25, 12, 22, 11, 90, 45];
let animating = false;
let speed = 500;
let algorithm = 'bubble';

// Controls
const controls = document.createElement('div');
controls.className = 'controls';

const algoSelect = document.createElement('select');
['bubble', 'selection', 'insertion', 'quick'].forEach(algo => {
  const opt = document.createElement('option');
  opt.value = algo;
  opt.textContent = algo.charAt(0).toUpperCase() + algo.slice(1) + ' Sort';
  algoSelect.appendChild(opt);
});
algoSelect.onchange = () => { algorithm = algoSelect.value; reset(); };

const startBtn = document.createElement('button');
startBtn.textContent = '▶ Start';
startBtn.onclick = () => runSort();

const resetBtn = document.createElement('button');
resetBtn.className = 'secondary';
resetBtn.textContent = '↺ Reset';
resetBtn.onclick = () => reset();

const randomBtn = document.createElement('button');
randomBtn.className = 'secondary';
randomBtn.textContent = '🎲 Random';
randomBtn.onclick = () => { data = Array.from({length: 8}, () => Math.floor(Math.random() * 80) + 10); draw(); };

const speedLabel = document.createElement('label');
speedLabel.textContent = 'Speed:';
const speedSlider = document.createElement('input');
speedSlider.type = 'range';
speedSlider.min = '100';
speedSlider.max = '1000';
speedSlider.value = '500';
speedSlider.onchange = () => speed = 1100 - parseInt(speedSlider.value);

controls.append(algoSelect, startBtn, resetBtn, randomBtn, speedLabel, speedSlider);
container.appendChild(controls);

// Bar container
const barContainer = document.createElement('div');
barContainer.className = 'bar-container';
container.appendChild(barContainer);

// Info box
const info = document.createElement('div');
info.className = 'info-box';
info.innerHTML = '<strong>How it works:</strong> Select an algorithm and click Start to see it sort the array step by step.';
container.appendChild(info);

function draw(comparing = [], swapping = [], sorted = []) {
  barContainer.innerHTML = '';
  const max = Math.max(...data);
  data.forEach((val, i) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    if (sorted.includes(i)) bar.classList.add('sorted');
    else if (swapping.includes(i)) bar.classList.add('swapping');
    else if (comparing.includes(i)) bar.classList.add('comparing');
    bar.style.height = (val / max * 200) + 'px';
    bar.textContent = val;
    barContainer.appendChild(bar);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function bubbleSort() {
  const n = data.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      if (!animating) return;
      draw([j, j + 1], [], Array.from({length: i}, (_, k) => n - 1 - k));
      await sleep(speed);
      if (data[j] > data[j + 1]) {
        draw([], [j, j + 1], Array.from({length: i}, (_, k) => n - 1 - k));
        [data[j], data[j + 1]] = [data[j + 1], data[j]];
        await sleep(speed);
      }
    }
  }
  draw([], [], data.map((_, i) => i));
}

async function selectionSort() {
  const n = data.length;
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++) {
      if (!animating) return;
      draw([minIdx, j], [], Array.from({length: i}, (_, k) => k));
      await sleep(speed);
      if (data[j] < data[minIdx]) minIdx = j;
    }
    if (minIdx !== i) {
      draw([], [i, minIdx], Array.from({length: i}, (_, k) => k));
      [data[i], data[minIdx]] = [data[minIdx], data[i]];
      await sleep(speed);
    }
  }
  draw([], [], data.map((_, i) => i));
}

async function insertionSort() {
  const n = data.length;
  for (let i = 1; i < n; i++) {
    const key = data[i];
    let j = i - 1;
    draw([i], [], Array.from({length: 0}, (_, k) => k));
    await sleep(speed);
    while (j >= 0 && data[j] > key) {
      if (!animating) return;
      draw([j], [j + 1], []);
      data[j + 1] = data[j];
      await sleep(speed);
      j--;
    }
    data[j + 1] = key;
  }
  draw([], [], data.map((_, i) => i));
}

async function runSort() {
  if (animating) return;
  animating = true;
  startBtn.disabled = true;
  
  switch (algorithm) {
    case 'bubble': await bubbleSort(); break;
    case 'selection': await selectionSort(); break;
    case 'insertion': await insertionSort(); break;
    case 'quick': await bubbleSort(); break; // Simplified
  }
  
  animating = false;
  startBtn.disabled = false;
  info.innerHTML = '<strong>✓ Sorted!</strong> The array is now in ascending order.';
}

function reset() {
  animating = false;
  startBtn.disabled = false;
  data = [64, 34, 25, 12, 22, 11, 90, 45];
  draw();
  info.innerHTML = '<strong>How it works:</strong> Select an algorithm and click Start to see it sort the array step by step.';
}

draw();
`
};

// =============================================================================
// STACK DATA STRUCTURE VISUALIZATION
// =============================================================================

export const STACK_VIZ_TEMPLATE = {
  name: 'Stack Data Structure',
  description: 'Visualize stack operations (LIFO - Last In First Out)',
  html: '<div id="viz-container"></div>',
  css: BASE_CSS + `
    .stack-container {
      display: flex;
      gap: 24px;
      align-items: flex-start;
    }
    .stack-visual {
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      min-height: 280px;
      padding: 16px;
      background: ${THEME.bgSurface};
      border-radius: 8px;
      border: 2px dashed ${THEME.bgBorder};
      width: 120px;
    }
    .stack-item {
      width: 100px;
      padding: 12px;
      background: ${THEME.primary};
      color: white;
      text-align: center;
      border-radius: 6px;
      margin: 4px 0;
      font-weight: 600;
      animation: slideIn 0.3s ease;
    }
    .stack-item.removing { animation: slideOut 0.3s ease; }
    .stack-item.top { background: ${THEME.success}; }
    @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } }
    @keyframes slideOut { to { transform: translateY(-20px); opacity: 0; } }
    .stack-label {
      color: ${THEME.textMuted};
      font-size: 12px;
      margin-top: 8px;
    }
    .operation-log {
      flex: 1;
      padding: 16px;
      background: ${THEME.bgSurface};
      border-radius: 8px;
      max-height: 280px;
      overflow-y: auto;
    }
    .log-entry {
      padding: 8px;
      border-bottom: 1px solid ${THEME.bgBorder};
      font-size: 14px;
    }
    .log-entry.push { color: ${THEME.success}; }
    .log-entry.pop { color: ${THEME.error}; }
  `,
  javascript: `
const container = document.getElementById('viz-container');
container.innerHTML = '';

let stack = [];
let log = [];

// Controls
const controls = document.createElement('div');
controls.className = 'controls';

const input = document.createElement('input');
input.type = 'text';
input.placeholder = 'Value to push';
input.style.cssText = 'padding:8px;border-radius:6px;border:1px solid ${THEME.bgBorder};background:${THEME.bgSurface};color:${THEME.textPrimary};width:120px;';

const pushBtn = document.createElement('button');
pushBtn.className = 'success';
pushBtn.textContent = '↓ Push';
pushBtn.onclick = () => push(input.value);

const popBtn = document.createElement('button');
popBtn.className = 'danger';
popBtn.textContent = '↑ Pop';
popBtn.onclick = () => pop();

const peekBtn = document.createElement('button');
peekBtn.className = 'secondary';
peekBtn.textContent = '👁 Peek';
peekBtn.onclick = () => peek();

const clearBtn = document.createElement('button');
clearBtn.className = 'secondary';
clearBtn.textContent = '🗑 Clear';
clearBtn.onclick = () => { stack = []; log = []; render(); };

controls.append(input, pushBtn, popBtn, peekBtn, clearBtn);
container.appendChild(controls);

// Main content
const content = document.createElement('div');
content.className = 'stack-container';

const stackVisual = document.createElement('div');
stackVisual.className = 'stack-visual';

const logPanel = document.createElement('div');
logPanel.className = 'operation-log';
logPanel.innerHTML = '<strong style="color:${THEME.textPrimary}">Operations Log</strong>';

content.append(stackVisual, logPanel);
container.appendChild(content);

// Info
const info = document.createElement('div');
info.className = 'info-box';
info.innerHTML = '<strong>Stack (LIFO):</strong> Last In, First Out. Push adds to top, Pop removes from top.';
container.appendChild(info);

function addLog(message, type) {
  log.unshift({ message, type, time: new Date().toLocaleTimeString() });
  if (log.length > 10) log.pop();
}

function push(value) {
  if (!value.trim()) return;
  stack.push(value.trim());
  addLog('PUSH: ' + value.trim(), 'push');
  input.value = '';
  render();
}

function pop() {
  if (stack.length === 0) {
    addLog('POP failed: Stack is empty!', 'pop');
    render();
    return;
  }
  const val = stack.pop();
  addLog('POP: ' + val, 'pop');
  render();
}

function peek() {
  if (stack.length === 0) {
    addLog('PEEK: Stack is empty!', 'pop');
  } else {
    addLog('PEEK: ' + stack[stack.length - 1], 'push');
  }
  render();
}

function render() {
  stackVisual.innerHTML = '';
  if (stack.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'stack-label';
    empty.textContent = 'Empty Stack';
    stackVisual.appendChild(empty);
  } else {
    stack.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'stack-item' + (i === stack.length - 1 ? ' top' : '');
      el.textContent = item;
      stackVisual.appendChild(el);
    });
  }
  
  logPanel.innerHTML = '<strong style="color:#e2e8f0">Operations Log</strong>';
  log.forEach(entry => {
    const el = document.createElement('div');
    el.className = 'log-entry ' + entry.type;
    el.textContent = entry.time + ' - ' + entry.message;
    logPanel.appendChild(el);
  });
}

// Initialize with sample data
['A', 'B', 'C'].forEach(v => { stack.push(v); addLog('PUSH: ' + v, 'push'); });
render();
`
};

// =============================================================================
// QUEUE DATA STRUCTURE VISUALIZATION
// =============================================================================

export const QUEUE_VIZ_TEMPLATE = {
  name: 'Queue Data Structure',
  description: 'Visualize queue operations (FIFO - First In First Out)',
  html: '<div id="viz-container"></div>',
  css: BASE_CSS + `
    .queue-visual {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 24px;
      background: ${THEME.bgSurface};
      border-radius: 8px;
      min-height: 100px;
      overflow-x: auto;
    }
    .queue-item {
      min-width: 60px;
      padding: 16px 12px;
      background: ${THEME.primary};
      color: white;
      text-align: center;
      border-radius: 6px;
      font-weight: 600;
      animation: slideRight 0.3s ease;
    }
    .queue-item.front { background: ${THEME.success}; }
    .queue-item.rear { background: ${THEME.warning}; color: ${THEME.textDark}; }
    @keyframes slideRight { from { transform: translateX(-20px); opacity: 0; } }
    .pointer {
      text-align: center;
      font-size: 12px;
      color: ${THEME.textMuted};
      margin-top: 8px;
    }
    .arrow {
      font-size: 24px;
      color: ${THEME.textMuted};
    }
  `,
  javascript: `
const container = document.getElementById('viz-container');
container.innerHTML = '';

let queue = [];
let log = [];

// Controls
const controls = document.createElement('div');
controls.className = 'controls';

const input = document.createElement('input');
input.type = 'text';
input.placeholder = 'Value to enqueue';
input.style.cssText = 'padding:8px;border-radius:6px;border:1px solid #1e293b;background:#0f172a;color:#e2e8f0;width:130px;';

const enqBtn = document.createElement('button');
enqBtn.className = 'success';
enqBtn.textContent = '→ Enqueue';
enqBtn.onclick = () => enqueue(input.value);

const deqBtn = document.createElement('button');
deqBtn.className = 'danger';
deqBtn.textContent = '← Dequeue';
deqBtn.onclick = () => dequeue();

const peekBtn = document.createElement('button');
peekBtn.className = 'secondary';
peekBtn.textContent = '👁 Front';
peekBtn.onclick = () => peekFront();

controls.append(input, enqBtn, deqBtn, peekBtn);
container.appendChild(controls);

// Queue visual
const queueVisual = document.createElement('div');
queueVisual.className = 'queue-visual';
container.appendChild(queueVisual);

// Pointer labels
const pointers = document.createElement('div');
pointers.style.cssText = 'display:flex;justify-content:space-between;padding:0 24px;';
container.appendChild(pointers);

// Info
const info = document.createElement('div');
info.className = 'info-box';
info.innerHTML = '<strong>Queue (FIFO):</strong> First In, First Out. Enqueue adds to rear, Dequeue removes from front.';
container.appendChild(info);

function enqueue(value) {
  if (!value.trim()) return;
  queue.push(value.trim());
  input.value = '';
  render();
}

function dequeue() {
  if (queue.length === 0) return;
  queue.shift();
  render();
}

function peekFront() {
  if (queue.length > 0) {
    info.innerHTML = '<strong>Front element:</strong> ' + queue[0];
  } else {
    info.innerHTML = '<strong>Queue is empty!</strong>';
  }
}

function render() {
  queueVisual.innerHTML = '';
  
  if (queue.length === 0) {
    queueVisual.innerHTML = '<span style="color:#94a3b8">Empty Queue</span>';
    pointers.innerHTML = '';
    return;
  }
  
  // Front arrow
  const frontArrow = document.createElement('span');
  frontArrow.className = 'arrow';
  frontArrow.textContent = '→';
  queueVisual.appendChild(frontArrow);
  
  queue.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'queue-item';
    if (i === 0) el.classList.add('front');
    if (i === queue.length - 1) el.classList.add('rear');
    el.textContent = item;
    queueVisual.appendChild(el);
  });
  
  // Rear arrow
  const rearArrow = document.createElement('span');
  rearArrow.className = 'arrow';
  rearArrow.textContent = '→';
  queueVisual.appendChild(rearArrow);
  
  pointers.innerHTML = '<span style="color:#22c55e">↑ Front (Dequeue)</span><span style="color:#f59e0b">↑ Rear (Enqueue)</span>';
}

// Initialize
['P1', 'P2', 'P3'].forEach(v => queue.push(v));
render();
`
};

// =============================================================================
// BINARY TREE VISUALIZATION
// =============================================================================

export const BINARY_TREE_VIZ_TEMPLATE = {
  name: 'Binary Tree Visualization',
  description: 'Visualize binary tree with traversal animations',
  html: '<div id="viz-container"></div>',
  css: BASE_CSS + `
    .tree-canvas {
      background: ${THEME.bgSurface};
      border-radius: 8px;
    }
  `,
  javascript: `
const container = document.getElementById('viz-container');
container.innerHTML = '';

// Tree node class
class TreeNode {
  constructor(val) {
    this.val = val;
    this.left = null;
    this.right = null;
  }
}

// Build sample tree
let root = new TreeNode(50);
root.left = new TreeNode(30);
root.right = new TreeNode(70);
root.left.left = new TreeNode(20);
root.left.right = new TreeNode(40);
root.right.left = new TreeNode(60);
root.right.right = new TreeNode(80);

let visitedNodes = new Set();
let currentNode = null;
let animating = false;

// Controls
const controls = document.createElement('div');
controls.className = 'controls';

const inorderBtn = document.createElement('button');
inorderBtn.textContent = 'Inorder';
inorderBtn.onclick = () => runTraversal('inorder');

const preorderBtn = document.createElement('button');
preorderBtn.textContent = 'Preorder';
preorderBtn.onclick = () => runTraversal('preorder');

const postorderBtn = document.createElement('button');
postorderBtn.textContent = 'Postorder';
postorderBtn.onclick = () => runTraversal('postorder');

const resetBtn = document.createElement('button');
resetBtn.className = 'secondary';
resetBtn.textContent = '↺ Reset';
resetBtn.onclick = reset;

controls.append(inorderBtn, preorderBtn, postorderBtn, resetBtn);
container.appendChild(controls);

// Canvas
const canvas = document.createElement('canvas');
canvas.className = 'tree-canvas';
canvas.width = 500;
canvas.height = 300;
container.appendChild(canvas);
const ctx = canvas.getContext('2d');

// Output
const output = document.createElement('div');
output.className = 'info-box';
output.innerHTML = '<strong>Traversal Order:</strong> Click a traversal button to animate.';
container.appendChild(output);

function drawTree() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!root) return;
  
  function drawNode(node, x, y, dx) {
    if (!node) return;
    
    // Draw edges first
    ctx.strokeStyle = '${THEME.bgBorder}';
    ctx.lineWidth = 2;
    if (node.left) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dx, y + 60);
      ctx.stroke();
      drawNode(node.left, x - dx, y + 60, dx / 2);
    }
    if (node.right) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + 60);
      ctx.stroke();
      drawNode(node.right, x + dx, y + 60, dx / 2);
    }
    
    // Draw node
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    
    if (currentNode === node) {
      ctx.fillStyle = '${THEME.comparing}';
    } else if (visitedNodes.has(node)) {
      ctx.fillStyle = '${THEME.success}';
    } else {
      ctx.fillStyle = '${THEME.bgLight}';
    }
    ctx.fill();
    ctx.strokeStyle = '${THEME.bgBorder}';
    ctx.stroke();
    
    // Node value
    ctx.fillStyle = visitedNodes.has(node) || currentNode === node ? 'white' : '${THEME.textDark}';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.val, x, y);
  }
  
  drawNode(root, 250, 40, 100);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function* inorderGen(node) {
  if (!node) return;
  yield* inorderGen(node.left);
  yield node;
  yield* inorderGen(node.right);
}

async function* preorderGen(node) {
  if (!node) return;
  yield node;
  yield* preorderGen(node.left);
  yield* preorderGen(node.right);
}

async function* postorderGen(node) {
  if (!node) return;
  yield* postorderGen(node.left);
  yield* postorderGen(node.right);
  yield node;
}

async function runTraversal(type) {
  if (animating) return;
  animating = true;
  visitedNodes.clear();
  currentNode = null;
  
  let gen;
  switch (type) {
    case 'inorder': gen = inorderGen(root); break;
    case 'preorder': gen = preorderGen(root); break;
    case 'postorder': gen = postorderGen(root); break;
  }
  
  const order = [];
  for (const node of gen) {
    currentNode = node;
    drawTree();
    await sleep(600);
    visitedNodes.add(node);
    order.push(node.val);
    output.innerHTML = '<strong>' + type.charAt(0).toUpperCase() + type.slice(1) + ':</strong> ' + order.join(' → ');
    drawTree();
    await sleep(300);
  }
  
  currentNode = null;
  animating = false;
  drawTree();
}

function reset() {
  animating = false;
  visitedNodes.clear();
  currentNode = null;
  output.innerHTML = '<strong>Traversal Order:</strong> Click a traversal button to animate.';
  drawTree();
}

drawTree();
`
};

// =============================================================================
// GRAPH VISUALIZATION (BFS/DFS)
// =============================================================================

export const GRAPH_VIZ_TEMPLATE = {
  name: 'Graph Traversal Visualization',
  description: 'Visualize BFS and DFS graph traversals',
  html: '<div id="viz-container"></div>',
  css: BASE_CSS,
  javascript: `
const container = document.getElementById('viz-container');
container.innerHTML = '';

// Graph as adjacency list
const graph = {
  'A': ['B', 'C'],
  'B': ['A', 'D', 'E'],
  'C': ['A', 'F'],
  'D': ['B'],
  'E': ['B', 'F'],
  'F': ['C', 'E']
};

// Node positions for visualization
const positions = {
  'A': {x: 250, y: 50},
  'B': {x: 150, y: 130},
  'C': {x: 350, y: 130},
  'D': {x: 80, y: 220},
  'E': {x: 220, y: 220},
  'F': {x: 350, y: 220}
};

let visited = new Set();
let current = null;
let queue = [];
let animating = false;

// Controls
const controls = document.createElement('div');
controls.className = 'controls';

const bfsBtn = document.createElement('button');
bfsBtn.textContent = 'BFS (Breadth-First)';
bfsBtn.onclick = () => runBFS();

const dfsBtn = document.createElement('button');
dfsBtn.textContent = 'DFS (Depth-First)';
dfsBtn.onclick = () => runDFS();

const resetBtn = document.createElement('button');
resetBtn.className = 'secondary';
resetBtn.textContent = '↺ Reset';
resetBtn.onclick = reset;

controls.append(bfsBtn, dfsBtn, resetBtn);
container.appendChild(controls);

// Canvas
const canvas = document.createElement('canvas');
canvas.width = 500;
canvas.height = 280;
canvas.style.cssText = 'background:#0f172a;border-radius:8px;';
container.appendChild(canvas);
const ctx = canvas.getContext('2d');

// Output
const output = document.createElement('div');
output.className = 'info-box';
output.innerHTML = '<strong>Traversal:</strong> Select BFS or DFS to start.';
container.appendChild(output);

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw edges
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  Object.entries(graph).forEach(([node, neighbors]) => {
    neighbors.forEach(neighbor => {
      if (node < neighbor) { // Draw each edge once
        ctx.beginPath();
        ctx.moveTo(positions[node].x, positions[node].y);
        ctx.lineTo(positions[neighbor].x, positions[neighbor].y);
        ctx.stroke();
      }
    });
  });
  
  // Draw nodes
  Object.entries(positions).forEach(([node, pos]) => {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2);
    
    if (current === node) {
      ctx.fillStyle = '#fbbf24'; // Yellow - current
    } else if (visited.has(node)) {
      ctx.fillStyle = '#22c55e'; // Green - visited
    } else if (queue.includes(node)) {
      ctx.fillStyle = '#3b82f6'; // Blue - in queue
    } else {
      ctx.fillStyle = '#f1f5f9'; // Light - unvisited
    }
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();
    
    // Label
    ctx.fillStyle = visited.has(node) || current === node || queue.includes(node) ? 'white' : '#0f172a';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node, pos.x, pos.y);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runBFS() {
  if (animating) return;
  reset();
  animating = true;
  
  const order = [];
  queue = ['A'];
  
  while (queue.length > 0 && animating) {
    current = queue.shift();
    draw();
    await sleep(500);
    
    visited.add(current);
    order.push(current);
    output.innerHTML = '<strong>BFS Order:</strong> ' + order.join(' → ') + '<br><strong>Queue:</strong> [' + queue.join(', ') + ']';
    draw();
    await sleep(500);
    
    graph[current].forEach(neighbor => {
      if (!visited.has(neighbor) && !queue.includes(neighbor)) {
        queue.push(neighbor);
      }
    });
  }
  
  current = null;
  animating = false;
  draw();
  output.innerHTML = '<strong>BFS Complete:</strong> ' + order.join(' → ');
}

async function runDFS() {
  if (animating) return;
  reset();
  animating = true;
  
  const order = [];
  const stack = ['A'];
  
  while (stack.length > 0 && animating) {
    current = stack.pop();
    
    if (visited.has(current)) continue;
    
    queue = [...stack]; // Show stack as "queue" for visualization
    draw();
    await sleep(500);
    
    visited.add(current);
    order.push(current);
    output.innerHTML = '<strong>DFS Order:</strong> ' + order.join(' → ') + '<br><strong>Stack:</strong> [' + stack.join(', ') + ']';
    draw();
    await sleep(500);
    
    // Add neighbors in reverse order for correct DFS order
    [...graph[current]].reverse().forEach(neighbor => {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    });
  }
  
  current = null;
  queue = [];
  animating = false;
  draw();
  output.innerHTML = '<strong>DFS Complete:</strong> ' + order.join(' → ');
}

function reset() {
  animating = false;
  visited.clear();
  current = null;
  queue = [];
  output.innerHTML = '<strong>Traversal:</strong> Select BFS or DFS to start.';
  draw();
}

draw();
`
};

// =============================================================================
// LINKED LIST VISUALIZATION
// =============================================================================

export const LINKED_LIST_VIZ_TEMPLATE = {
  name: 'Linked List Visualization',
  description: 'Visualize linked list operations (insert, delete, traverse)',
  html: '<div id="viz-container"></div>',
  css: BASE_CSS + `
    .ll-container {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 24px;
      background: ${THEME.bgSurface};
      border-radius: 8px;
      overflow-x: auto;
      min-height: 100px;
    }
    .ll-node {
      display: flex;
      align-items: center;
    }
    .ll-data {
      padding: 16px 20px;
      background: ${THEME.primary};
      color: white;
      font-weight: 600;
      border-radius: 6px 0 0 6px;
    }
    .ll-next {
      padding: 16px 12px;
      background: ${THEME.bgBorder};
      color: ${THEME.textPrimary};
      font-size: 12px;
      border-radius: 0 6px 6px 0;
    }
    .ll-arrow {
      color: ${THEME.textMuted};
      font-size: 20px;
      margin: 0 4px;
    }
    .ll-null {
      padding: 16px;
      color: ${THEME.textMuted};
      font-style: italic;
    }
    .ll-node.highlight .ll-data { background: ${THEME.success}; }
  `,
  javascript: `
const container = document.getElementById('viz-container');
container.innerHTML = '';

// Linked List implementation
class Node {
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}

class LinkedList {
  constructor() {
    this.head = null;
    this.size = 0;
  }
  
  append(data) {
    const node = new Node(data);
    if (!this.head) {
      this.head = node;
    } else {
      let curr = this.head;
      while (curr.next) curr = curr.next;
      curr.next = node;
    }
    this.size++;
  }
  
  prepend(data) {
    const node = new Node(data);
    node.next = this.head;
    this.head = node;
    this.size++;
  }
  
  deleteFirst() {
    if (!this.head) return;
    this.head = this.head.next;
    this.size--;
  }
  
  deleteLast() {
    if (!this.head) return;
    if (!this.head.next) {
      this.head = null;
    } else {
      let curr = this.head;
      while (curr.next.next) curr = curr.next;
      curr.next = null;
    }
    this.size--;
  }
  
  toArray() {
    const arr = [];
    let curr = this.head;
    while (curr) {
      arr.push(curr.data);
      curr = curr.next;
    }
    return arr;
  }
}

const list = new LinkedList();
['10', '20', '30'].forEach(v => list.append(v));

// Controls
const controls = document.createElement('div');
controls.className = 'controls';

const input = document.createElement('input');
input.type = 'text';
input.placeholder = 'Value';
input.style.cssText = 'padding:8px;border-radius:6px;border:1px solid #1e293b;background:#0f172a;color:#e2e8f0;width:80px;';

const appendBtn = document.createElement('button');
appendBtn.textContent = 'Append';
appendBtn.onclick = () => { if(input.value) { list.append(input.value); input.value=''; render(); } };

const prependBtn = document.createElement('button');
prependBtn.textContent = 'Prepend';
prependBtn.onclick = () => { if(input.value) { list.prepend(input.value); input.value=''; render(); } };

const delFirstBtn = document.createElement('button');
delFirstBtn.className = 'danger';
delFirstBtn.textContent = 'Delete First';
delFirstBtn.onclick = () => { list.deleteFirst(); render(); };

const delLastBtn = document.createElement('button');
delLastBtn.className = 'danger';
delLastBtn.textContent = 'Delete Last';
delLastBtn.onclick = () => { list.deleteLast(); render(); };

controls.append(input, appendBtn, prependBtn, delFirstBtn, delLastBtn);
container.appendChild(controls);

// List visualization
const llContainer = document.createElement('div');
llContainer.className = 'll-container';
container.appendChild(llContainer);

// Info
const info = document.createElement('div');
info.className = 'info-box';
container.appendChild(info);

function render() {
  llContainer.innerHTML = '';
  
  if (!list.head) {
    llContainer.innerHTML = '<span class="ll-null">NULL (empty list)</span>';
    info.innerHTML = '<strong>Size:</strong> 0 | <strong>Head:</strong> NULL';
    return;
  }
  
  // Head pointer
  const headLabel = document.createElement('span');
  headLabel.style.cssText = 'color:#94a3b8;font-size:12px;margin-right:8px;';
  headLabel.textContent = 'HEAD →';
  llContainer.appendChild(headLabel);
  
  let curr = list.head;
  while (curr) {
    const node = document.createElement('div');
    node.className = 'll-node';
    
    const data = document.createElement('div');
    data.className = 'll-data';
    data.textContent = curr.data;
    
    const next = document.createElement('div');
    next.className = 'll-next';
    next.textContent = curr.next ? '•' : '∅';
    
    node.append(data, next);
    llContainer.appendChild(node);
    
    if (curr.next) {
      const arrow = document.createElement('span');
      arrow.className = 'll-arrow';
      arrow.textContent = '→';
      llContainer.appendChild(arrow);
    }
    
    curr = curr.next;
  }
  
  // Null terminator
  const nullTerm = document.createElement('span');
  nullTerm.className = 'll-null';
  nullTerm.textContent = '→ NULL';
  llContainer.appendChild(nullTerm);
  
  info.innerHTML = '<strong>Size:</strong> ' + list.size + ' | <strong>Values:</strong> ' + list.toArray().join(' → ') + ' → NULL';
}

render();
`
};

// =============================================================================
// HASH TABLE VISUALIZATION
// =============================================================================

export const HASH_TABLE_VIZ_TEMPLATE = {
  name: 'Hash Table Visualization',
  description: 'Visualize hash table with collision handling',
  html: '<div id="viz-container"></div>',
  css: BASE_CSS + `
    .hash-table {
      display: grid;
      grid-template-columns: 60px 1fr;
      gap: 4px;
      padding: 16px;
      background: ${THEME.bgSurface};
      border-radius: 8px;
    }
    .bucket-index {
      padding: 12px;
      background: ${THEME.bgBorder};
      color: ${THEME.textPrimary};
      text-align: center;
      border-radius: 6px;
      font-weight: 600;
    }
    .bucket {
      display: flex;
      gap: 8px;
      padding: 8px;
      min-height: 44px;
      border: 1px dashed ${THEME.bgBorder};
      border-radius: 6px;
      align-items: center;
    }
    .bucket-item {
      padding: 8px 12px;
      background: ${THEME.primary};
      color: white;
      border-radius: 4px;
      font-size: 13px;
    }
    .bucket-item.collision { background: ${THEME.warning}; color: ${THEME.textDark}; }
  `,
  javascript: `
const container = document.getElementById('viz-container');
container.innerHTML = '';

const SIZE = 7;
const table = Array.from({length: SIZE}, () => []);

function hash(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h + key.charCodeAt(i)) % SIZE;
  }
  return h;
}

// Controls
const controls = document.createElement('div');
controls.className = 'controls';

const keyInput = document.createElement('input');
keyInput.placeholder = 'Key';
keyInput.style.cssText = 'padding:8px;border-radius:6px;border:1px solid #1e293b;background:#0f172a;color:#e2e8f0;width:80px;';

const valInput = document.createElement('input');
valInput.placeholder = 'Value';
valInput.style.cssText = 'padding:8px;border-radius:6px;border:1px solid #1e293b;background:#0f172a;color:#e2e8f0;width:80px;';

const insertBtn = document.createElement('button');
insertBtn.className = 'success';
insertBtn.textContent = 'Insert';
insertBtn.onclick = () => insert();

const searchBtn = document.createElement('button');
searchBtn.textContent = 'Search';
searchBtn.onclick = () => search();

const clearBtn = document.createElement('button');
clearBtn.className = 'danger';
clearBtn.textContent = 'Clear All';
clearBtn.onclick = () => { table.forEach((_, i) => table[i] = []); render(); };

controls.append(keyInput, valInput, insertBtn, searchBtn, clearBtn);
container.appendChild(controls);

// Hash table visualization
const tableDiv = document.createElement('div');
tableDiv.className = 'hash-table';
container.appendChild(tableDiv);

// Info
const info = document.createElement('div');
info.className = 'info-box';
info.innerHTML = '<strong>Hash Function:</strong> Sum of ASCII codes mod ' + SIZE;
container.appendChild(info);

function insert() {
  const key = keyInput.value.trim();
  const val = valInput.value.trim();
  if (!key) return;
  
  const idx = hash(key);
  // Check if key exists, update if so
  const existing = table[idx].findIndex(item => item.key === key);
  if (existing >= 0) {
    table[idx][existing].value = val || key;
  } else {
    table[idx].push({ key, value: val || key });
  }
  
  keyInput.value = '';
  valInput.value = '';
  info.innerHTML = '<strong>Inserted:</strong> "' + key + '" at index ' + idx + ' (hash=' + idx + ')';
  render();
}

function search() {
  const key = keyInput.value.trim();
  if (!key) return;
  
  const idx = hash(key);
  const found = table[idx].find(item => item.key === key);
  
  if (found) {
    info.innerHTML = '<strong style="color:#22c55e">Found:</strong> "' + key + '" = "' + found.value + '" at index ' + idx;
  } else {
    info.innerHTML = '<strong style="color:#ef4444">Not Found:</strong> "' + key + '" (searched index ' + idx + ')';
  }
}

function render() {
  tableDiv.innerHTML = '';
  
  for (let i = 0; i < SIZE; i++) {
    const idx = document.createElement('div');
    idx.className = 'bucket-index';
    idx.textContent = '[' + i + ']';
    
    const bucket = document.createElement('div');
    bucket.className = 'bucket';
    
    if (table[i].length === 0) {
      bucket.innerHTML = '<span style="color:#64748b;font-size:13px;">empty</span>';
    } else {
      table[i].forEach((item, j) => {
        const el = document.createElement('span');
        el.className = 'bucket-item' + (j > 0 ? ' collision' : '');
        el.textContent = item.key + ':' + item.value;
        bucket.appendChild(el);
      });
    }
    
    tableDiv.append(idx, bucket);
  }
}

// Initialize with sample data
[{key:'apple', value:'🍎'}, {key:'banana', value:'🍌'}, {key:'cherry', value:'🍒'}].forEach(({key, value}) => {
  const idx = hash(key);
  table[idx].push({ key, value });
});
render();
`
};

// =============================================================================
// EXPORT ALL TEMPLATES
// =============================================================================

export const VISUALIZATION_TEMPLATES = {
  sorting: SORTING_VIZ_TEMPLATE,
  stack: STACK_VIZ_TEMPLATE,
  queue: QUEUE_VIZ_TEMPLATE,
  binaryTree: BINARY_TREE_VIZ_TEMPLATE,
  graph: GRAPH_VIZ_TEMPLATE,
  linkedList: LINKED_LIST_VIZ_TEMPLATE,
  hashTable: HASH_TABLE_VIZ_TEMPLATE,
};

/**
 * Get template names for AI prompts
 */
export function getTemplateNames(): string[] {
  return Object.keys(VISUALIZATION_TEMPLATES);
}

/**
 * Get template description for AI context
 */
export function getTemplateDescriptions(): string {
  return Object.entries(VISUALIZATION_TEMPLATES)
    .map(([key, template]) => `- ${key}: ${template.description}`)
    .join('\n');
}
