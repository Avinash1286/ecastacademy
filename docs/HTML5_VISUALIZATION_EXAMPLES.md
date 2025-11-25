# HTML5 Visualization Examples for Capsule Generation

This guide provides example code snippets for creating interactive visualizations using pure HTML5, CSS, and vanilla JavaScript for the capsule course generation system.

## 1. Simple Animated Diagram (CSS)

### Use Case: Process flow, concept transformation

```javascript
// HTML
const html = `
  <div class="container">
    <div class="box" id="box1">Step 1</div>
    <div class="arrow">→</div>
    <div class="box" id="box2">Step 2</div>
    <div class="arrow">→</div>
    <div class="box" id="box3">Step 3</div>
  </div>
`;

// CSS
const css = `
  .container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 40px;
  }
  .box {
    padding: 20px 40px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    color: white;
    font-weight: bold;
    animation: pulse 2s infinite;
  }
  .arrow {
    font-size: 32px;
    color: #667eea;
    animation: slide 1s infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  @keyframes slide {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(5px); }
  }
`;

// JavaScript
const javascript = `
  console.log('Diagram loaded');
`;
```

## 2. Interactive Flowchart (Canvas)

### Use Case: Decision trees, algorithm flows

```javascript
// JavaScript for Canvas-based flowchart
const javascript = `
const canvas = document.getElementById('flowchart');
const ctx = canvas.getContext('2d');
canvas.width = 600;
canvas.height = 400;

// Draw box function
function drawBox(x, y, w, h, text, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  
  ctx.fillStyle = '#fff';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w/2, y + h/2 + 5);
}

// Draw arrow function
function drawArrow(fromX, fromY, toX, toY) {
  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  
  // Arrowhead
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - 10 * Math.cos(angle - Math.PI/6), toY - 10 * Math.sin(angle - Math.PI/6));
  ctx.lineTo(toX - 10 * Math.cos(angle + Math.PI/6), toY - 10 * Math.sin(angle + Math.PI/6));
  ctx.closePath();
  ctx.fill();
}

// Draw flowchart
drawBox(250, 20, 100, 50, 'Start', '#667eea');
drawArrow(300, 70, 300, 100);
drawBox(225, 100, 150, 60, 'Process Data', '#764ba2');
drawArrow(300, 160, 300, 200);
drawBox(250, 200, 100, 50, 'Output', '#48bb78');
`;

// HTML
const html = `<canvas id="flowchart"></canvas>`;

// CSS
const css = `
canvas {
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
}
`;
```

## 3. Animated Graph/Chart (Canvas)

### Use Case: Data visualization, statistics

```javascript
const javascript = `
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
canvas.width = 600;
canvas.height = 400;

const data = [30, 50, 80, 45, 90, 60, 75];
const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const barWidth = 60;
const gap = 20;
const maxHeight = 300;
const maxValue = Math.max(...data);

let animationProgress = 0;

function drawChart() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  data.forEach((value, index) => {
    const x = 50 + index * (barWidth + gap);
    const barHeight = (value / maxValue) * maxHeight * animationProgress;
    const y = canvas.height - barHeight - 40;
    
    // Draw bar
    const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Draw label
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(labels[index], x + barWidth/2, canvas.height - 20);
    
    // Draw value
    ctx.fillText(Math.round(value * animationProgress), x + barWidth/2, y - 10);
  });
  
  if (animationProgress < 1) {
    animationProgress += 0.02;
    requestAnimationFrame(drawChart);
  }
}

drawChart();
`;

const html = `<canvas id="chart"></canvas>`;
const css = `
canvas {
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: #f7fafc;
}
`;
```

## 4. Interactive Simulation (Physics)

### Use Case: Physics concepts, interactions

```javascript
const javascript = `
const canvas = document.getElementById('simulation');
const ctx = canvas.getContext('2d');
canvas.width = 600;
canvas.height = 400;

let balls = [];
const gravity = 0.5;
const bounce = 0.8;

class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 10;
    this.vy = 0;
    this.radius = 20;
    this.color = \`hsl(\${Math.random() * 360}, 70%, 60%)\`;
  }
  
  update() {
    this.vy += gravity;
    this.x += this.vx;
    this.y += this.vy;
    
    // Bounce off walls
    if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
      this.vx *= -bounce;
      this.x = this.x < 0 ? this.radius : canvas.width - this.radius;
    }
    
    if (this.y + this.radius > canvas.height) {
      this.vy *= -bounce;
      this.y = canvas.height - this.radius;
    }
  }
  
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  balls.push(new Ball(e.clientX - rect.left, e.clientY - rect.top));
});

function animate() {
  ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  balls.forEach(ball => {
    ball.update();
    ball.draw();
  });
  
  requestAnimationFrame(animate);
}

// Initial balls
balls.push(new Ball(300, 50));
balls.push(new Ball(200, 100));

animate();
`;

const html = `
  <div>
    <canvas id="simulation"></canvas>
    <p style="text-align: center; margin-top: 10px; color: #64748b;">
      Click anywhere to add more balls!
    </p>
  </div>
`;

const css = `
canvas {
  border: 2px solid #1e293b;
  border-radius: 8px;
  background: #0f172a;
  cursor: crosshair;
}
`;
```

## 5. Network Diagram (SVG with JavaScript)

### Use Case: Relationships, connections, graphs

```javascript
const javascript = `
const svg = document.getElementById('network');
const nodes = [
  { id: 1, x: 150, y: 100, label: 'A' },
  { id: 2, x: 300, y: 80, label: 'B' },
  { id: 3, x: 450, y: 100, label: 'C' },
  { id: 4, x: 225, y: 220, label: 'D' },
  { id: 5, x: 375, y: 220, label: 'E' }
];

const edges = [
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 1, to: 4 },
  { from: 2, to: 4 },
  { from: 2, to: 5 },
  { from: 3, to: 5 }
];

// Draw edges
edges.forEach(edge => {
  const from = nodes.find(n => n.id === edge.from);
  const to = nodes.find(n => n.id === edge.to);
  
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', from.x);
  line.setAttribute('y1', from.y);
  line.setAttribute('x2', to.x);
  line.setAttribute('y2', to.y);
  line.setAttribute('stroke', '#667eea');
  line.setAttribute('stroke-width', '2');
  svg.appendChild(line);
});

// Draw nodes
nodes.forEach(node => {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', node.x);
  circle.setAttribute('cy', node.y);
  circle.setAttribute('r', '30');
  circle.setAttribute('fill', '#764ba2');
  circle.setAttribute('stroke', '#fff');
  circle.setAttribute('stroke-width', '3');
  
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', node.x);
  text.setAttribute('y', node.y + 5);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('fill', '#fff');
  text.setAttribute('font-size', '18');
  text.setAttribute('font-weight', 'bold');
  text.textContent = node.label;
  
  svg.appendChild(circle);
  svg.appendChild(text);
});
`;

const html = `<svg id="network" width="600" height="300"></svg>`;
const css = `
svg {
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
}
`;
```

## Tips for Creating Visualizations

1. **Keep it Simple**: Start with basic shapes and build complexity
2. **Use Animations**: requestAnimationFrame for smooth animations
3. **Add Interactivity**: Mouse events, click handlers, hover effects
4. **Match Theme**: Use app colors (#667eea, #764ba2, etc.)
5. **Be Responsive**: Consider canvas/container sizing
6. **Test Thoroughly**: Ensure code runs in sandboxed iframe
7. **Add Instructions**: Help users understand what to do

## Security Notes

All code runs in sandboxed iframes with CSP:
- `default-src 'none'`
- `style-src 'unsafe-inline'`
- `script-src 'unsafe-inline'`
- No external resources allowed

## Performance Considerations

- Use `requestAnimationFrame` for animations
- Clear canvas before redrawing
- Limit number of animated objects
- Optimize drawing operations
- Consider mobile performance
