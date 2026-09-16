const canvas = document.getElementById("poolCanvas");
const ctx = canvas.getContext("2d");

// FRICTION REDUZIDA: Deslize mais fluido e realista
const FRICTION = 0.993;
const BALL_RADIUS = 10;
const POCKET_RADIUS = 22;
const SUB_STEPS = 8;

let currentTurn = "player";
let isAiThinking = false;
let isShotInProgress = false;

let playerGroup = null;
let aiGroup = null;
let gameOver = false;

let pocketedThisTurn = [];

const pockets = [
  { x: 0, y: 0 },
  { x: canvas.width / 2, y: 0 },
  { x: canvas.width, y: 0 },
  { x: 0, y: canvas.height },
  { x: canvas.width / 2, y: canvas.height },
  { x: canvas.width, y: canvas.height }
];

class Ball {
  constructor(x, y, color, number = 0) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.color = color;
    this.number = number;
    this.inPocket = false;
  }

  updatePhysics() {
    if (this.inPocket) return;

    this.x += this.vx / SUB_STEPS;
    this.y += this.vy / SUB_STEPS;

    this.vx *= Math.pow(FRICTION, 1 / SUB_STEPS);
    this.vy *= Math.pow(FRICTION, 1 / SUB_STEPS);

    // Limiar menor de parada para rolagem suave no final
    if (Math.hypot(this.vx, this.vy) < 0.02) {
      this.vx = 0;
      this.vy = 0;
    }

    if (this.x - BALL_RADIUS < 0) { this.x = BALL_RADIUS; this.vx *= -0.96; }
    if (this.x + BALL_RADIUS > canvas.width) { this.x = canvas.width - BALL_RADIUS; this.vx *= -0.96; }
    if (this.y - BALL_RADIUS < 0) { this.y = BALL_RADIUS; this.vy *= -0.96; }
    if (this.y + BALL_RADIUS > canvas.height) { this.y = canvas.height - BALL_RADIUS; this.vy *= -0.96; }

    for (let p of pockets) {
      if (Math.hypot(this.x - p.x, this.y - p.y) < POCKET_RADIUS) {
        this.inPocket = true;
        this.vx = 0;
        this.vy = 0;

        if (this.number === 0) {
          setTimeout(() => {
            this.x = 200;
            this.y = canvas.height / 2;
            this.inPocket = false;
          }, 400);
        } else {
          pocketedThisTurn.push(this);
        }
        break;
      }
    }
  }

  draw() {
    if (this.inPocket) return;

    ctx.save();
    
    // Brilho Neon na Bola
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.arc(this.x, this.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // Número
    if (this.number > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, BALL_RADIUS * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.fillStyle = "#000000";
      ctx.font = "bold 8px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.number, this.x, this.y);
    }
  }
}

const balls = [];
const whiteBall = new Ball(200, canvas.height / 2, "#ffffff", 0);
balls.push(whiteBall);

const ballColors = [
  "#ffe600", "#00f3ff", "#ff0055", "#b000ff", "#ff7700",
  "#00ff66", "#ff00aa", "#111111", "#ffe600", "#00f3ff",
  "#ff0055", "#b000ff", "#ff7700", "#00ff66", "#ff00aa"
];

function setupTriangle() {
  const startX = 550;
  const startY = canvas.height / 2;
  let colorIndex = 0;

  for (let col = 0; col < 5; col++) {
    for (let row = 0; row <= col; row++) {
      const x = startX + col * (BALL_RADIUS * 1.85);
      const y = startY + (row - col / 2) * (BALL_RADIUS * 2.05);
      const num = colorIndex + 1;
      const color = num === 8 ? "#111111" : ballColors[colorIndex];
      balls.push(new Ball(x, y, color, num));
      colorIndex++;
    }
  }
}
setupTriangle();

function isEverythingStopped() {
  return balls.every(b => b.vx === 0 && b.vy === 0);
}

function processTurnEnd() {
  let extraTurn = false;

  for (let ball of pocketedThisTurn) {
    if (gameOver) break;

    if (ball.number === 8) {
      const shooterGroup = currentTurn === "player" ? playerGroup : aiGroup;
      const remaining = getRemainingBalls(shooterGroup);

      if (remaining === 0) {
        alert((currentTurn === "player" ? "MARCELO" : "A IA") + " VENCEU O JOGO!");
      } else {
        alert((currentTurn === "player" ? "MARCELO" : "A IA") + " PERDEU! Encaçapou a bola 8 antes da hora.");
      }
      gameOver = true;
      addBallToBoard(ball, currentTurn);
      break;
    }

    const isOdd = ball.number % 2 !== 0;

    if (!playerGroup) {
      if (currentTurn === "player") {
        playerGroup = isOdd ? "odd" : "even";
        aiGroup = isOdd ? "even" : "odd";
      } else {
        aiGroup = isOdd ? "odd" : "even";
        playerGroup = isOdd ? "even" : "odd";
      }
    }

    const belongsToPlayer = playerGroup === "odd" ? isOdd : !isOdd;
    const owner = belongsToPlayer ? "player" : "ai";

    addBallToBoard(ball, owner);

    if (owner === currentTurn) {
      extraTurn = true;
    }
  }

  pocketedThisTurn = [];
  isShotInProgress = false;

  if (!extraTurn && !gameOver) {
    currentTurn = currentTurn === "player" ? "ai" : "player";
  }

  updateTurnUI();
}

function updateTurnUI() {
  const turnElem = document.getElementById("turn-name");
  if (!turnElem) return;

  if (gameOver) {
    turnElem.innerText = "Fim de Jogo";
    turnElem.style.color = "#aaa";
  } else {
    turnElem.innerText = currentTurn === "player" ? "Marcelo" : "IA (Computador)";
    turnElem.style.color = currentTurn === "player" ? "#ffe600" : "#ff0055";
  }
}

function addBallToBoard(ball, owner) {
  const containerId = owner === "player" ? "marcelo-balls" : "ai-balls";
  const container = document.getElementById(containerId);
  if (!container) return;

  const ballElem = document.createElement("div");
  ballElem.className = "mini-ball";
  ballElem.style.backgroundColor = ball.color;

  const numElem = document.createElement("div");
  numElem.className = "mini-ball-num";
  numElem.innerText = ball.number;

  ballElem.appendChild(numElem);
  container.appendChild(ballElem);
}

function getRemainingBalls(group) {
  if (!group) return 7;
  return balls.filter(b => !b.inPocket && b.number !== 0 && b.number !== 8 &&
    (group === "odd" ? b.number % 2 !== 0 : b.number % 2 === 0)).length;
}

function resolveCollisions() {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const b1 = balls[i];
      const b2 = balls[j];

      if (b1.inPocket || b2.inPocket) continue;

      const dx = b2.x - b1.x;
      const dy = b2.y - b1.y;
      const dist = Math.hypot(dx, dy);

      if (dist < BALL_RADIUS * 2) {
        const overlap = (BALL_RADIUS * 2) - dist;
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);

        b1.x -= nx * overlap * 0.5;
        b1.y -= ny * overlap * 0.5;
        b2.x += nx * overlap * 0.5;
        b2.y += ny * overlap * 0.5;

        const kx = b1.vx - b2.vx;
        const ky = b1.vy - b2.vy;
        const p = 2 * (nx * kx + ny * ky) / 2;

        b1.vx -= p * nx;
        b1.vy -= p * ny;
        b2.vx += p * nx;
        b2.vy += p * ny;
      }
    }
  }
}

// CONTROLES
const mouse = { x: 0, y: 0, isDragging: false };
let power = 0;

function getCanvasPos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

canvas.addEventListener("mousemove", (e) => {
  const pos = getCanvasPos(e.clientX, e.clientY);
  mouse.x = pos.x;
  mouse.y = pos.y;
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0 && isEverythingStopped() && currentTurn === "player" && !whiteBall.inPocket && !gameOver && !isShotInProgress) {
    mouse.isDragging = true;
    power = 0;
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0 && mouse.isDragging && currentTurn === "player") {
    mouse.isDragging = false;
    executeShot();
  }
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const pos = getCanvasPos(touch.clientX, touch.clientY);
  mouse.x = pos.x;
  mouse.y = pos.y;

  if (isEverythingStopped() && currentTurn === "player" && !whiteBall.inPocket && !gameOver && !isShotInProgress) {
    mouse.isDragging = true;
    power = 0;
  }
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const pos = getCanvasPos(touch.clientX, touch.clientY);
  mouse.x = pos.x;
  mouse.y = pos.y;
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (mouse.isDragging && currentTurn === "player") {
    mouse.isDragging = false;
    executeShot();
  }
}, { passive: false });

function executeShot() {
  isShotInProgress = true;
  const angle = Math.atan2(mouse.y - whiteBall.y, mouse.x - whiteBall.x);
  const force = Math.min(power / 3, 22);
  whiteBall.vx = -Math.cos(angle) * force;
  whiteBall.vy = -Math.sin(angle) * force;
}

function playAiTurn() {
  if (isAiThinking || !isEverythingStopped() || whiteBall.inPocket || gameOver || isShotInProgress) return;
  isAiThinking = true;

  setTimeout(() => {
    const aiRemaining = getRemainingBalls(aiGroup);

    let validTargets = balls.filter(b => {
      if (b.inPocket || b.number === 0) return false;
      if (aiRemaining === 0) return b.number === 8;
      if (b.number === 8) return false;
      if (!aiGroup) return true;
      return aiGroup === "odd" ? b.number % 2 !== 0 : b.number % 2 === 0;
    });

    if (validTargets.length === 0) validTargets = balls.filter(b => !b.inPocket && b.number !== 0);

    let closestBall = validTargets[0];
    let minDist = Infinity;

    for (let b of validTargets) {
      const dist = Math.hypot(b.x - whiteBall.x, b.y - whiteBall.y);
      if (dist < minDist) {
        minDist = dist;
        closestBall = b;
      }
    }

    if (closestBall) {
      isShotInProgress = true;
      const dx = closestBall.x - whiteBall.x;
      const dy = closestBall.y - whiteBall.y;
      const angle = Math.atan2(dy, dx);
      const force = 12 + Math.random() * 6;

      whiteBall.vx = Math.cos(angle) * force;
      whiteBall.vy = Math.sin(angle) * force;
    }

    isAiThinking = false;
  }, 800);
}

// LOOP PRINCIPAL (VISUAL NEON)
function gameLoop() {
  for (let step = 0; step < SUB_STEPS; step++) {
    balls.forEach(b => b.updatePhysics());
    resolveCollisions();
  }

  if (isShotInProgress && isEverythingStopped()) {
    processTurnEnd();
  }

  if (currentTurn === "ai" && isEverythingStopped() && !isShotInProgress) {
    playAiTurn();
  }

  // Fundo do pano neon
  ctx.fillStyle = "#03120e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Caçapas com brilho neon
  pockets.forEach(p => {
    ctx.save();
    ctx.shadowColor = "#d94e4e";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#0a0010";
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ea1212";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  });

  balls.forEach(b => b.draw());

  // Taco e Mira Neon
  if (isEverythingStopped() && currentTurn === "player" && !whiteBall.inPocket && !gameOver && !isShotInProgress) {
    const angle = Math.atan2(mouse.y - whiteBall.y, mouse.x - whiteBall.x);

    ctx.save();
    ctx.shadowColor = "#00f3ff";
    ctx.shadowBlur = 10;

    // Linha Guia
    ctx.beginPath();
    ctx.moveTo(whiteBall.x, whiteBall.y);
    ctx.lineTo(whiteBall.x - Math.cos(angle) * 150, whiteBall.y - Math.sin(angle) * 150);
    ctx.strokeStyle = "#00f3ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.restore();

    if (mouse.isDragging) power = Math.min(power + 0.5, 60);

    const offset = 18 + power;
    const cueX = whiteBall.x + Math.cos(angle) * offset;
    const cueY = whiteBall.y + Math.sin(angle) * offset;

    ctx.save();
    ctx.shadowColor = "#10db1a";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cueX, cueY);
    ctx.lineTo(cueX + Math.cos(angle) * 160, cueY + Math.sin(angle) * 160);
    ctx.strokeStyle = "#1de638";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);