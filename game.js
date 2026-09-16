const canvas = document.getElementById("poolCanvas");
const ctx = canvas.getContext("2d");

const FRICTION = 0.988;
const BALL_RADIUS = 10;
const POCKET_RADIUS = 22;
const SUB_STEPS = 8;

let currentTurn = "player"; // "player" ou "ai"
let isAiThinking = false;
let isShotInProgess = false;

let playerGroup = null; // "odd" ou "even"
let aiGroup = null;
let gameOver = false;

// Registro das bolas encaçapadas na jogada atual
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

    if (Math.hypot(this.vx, this.vy) < 0.03) {
      this.vx = 0;
      this.vy = 0;
    }

    if (this.x - BALL_RADIUS < 0) { this.x = BALL_RADIUS; this.vx *= -0.95; }
    if (this.x + BALL_RADIUS > canvas.width) { this.x = canvas.width - BALL_RADIUS; this.vx *= -0.95; }
    if (this.y - BALL_RADIUS < 0) { this.y = BALL_RADIUS; this.vy *= -0.95; }
    if (this.y + BALL_RADIUS > canvas.height) { this.y = canvas.height - BALL_RADIUS; this.vy *= -0.95; }

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

    // 1. Sombra projetada no pano (Projeção 3D suave)
    ctx.beginPath();
    ctx.arc(this.x + 3, this.y + 4, BALL_RADIUS * 0.95, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fill();

    // 2. Corpo principal da bola com gradiente radial (Efeito Esférico 3D)
    ctx.beginPath();
    ctx.arc(this.x, this.y, BALL_RADIUS, 0, Math.PI * 2);
    
    // O ponto de luz fica deslocado no canto superior esquerdo
    const ballGradient = ctx.createRadialGradient(
      this.x - BALL_RADIUS * 0.35,
      this.y - BALL_RADIUS * 0.35,
      1,
      this.x,
      this.y,
      BALL_RADIUS
    );
    
    ballGradient.addColorStop(0, "#ffffff"); // Ponto máximo de reflexo
    ballGradient.addColorStop(0.25, this.color); // Cor natural
    ballGradient.addColorStop(1, "#0a0a0a"); // Sombra do lado oposto

    ctx.fillStyle = ballGradient;
    ctx.fill();

    // 3. Círculo com o número (para as bolas coloridas)
    if (this.number > 0) {
      const circleRadius = BALL_RADIUS * 0.48;
      
      ctx.beginPath();
      ctx.arc(this.x, this.y, circleRadius, 0, Math.PI * 2);
      
      const numGradient = ctx.createRadialGradient(
        this.x - circleRadius * 0.2,
        this.y - circleRadius * 0.2,
        0.5,
        this.x,
        this.y,
        circleRadius
      );
      numGradient.addColorStop(0, "#ffffff");
      numGradient.addColorStop(1, "#d1d1d1");

      ctx.fillStyle = numGradient;
      ctx.fill();

      ctx.fillStyle = "#111111";
      ctx.font = "bold 8px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.number, this.x, this.y + 0.5);
    }

    // 4. Brilho do especular superior (Efeito de reflexo de luz na resina)
    ctx.beginPath();
    ctx.arc(this.x - BALL_RADIUS * 0.3, this.y - BALL_RADIUS * 0.3, BALL_RADIUS * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.fill();
  }
}

const balls = [];
const whiteBall = new Ball(200, canvas.height / 2, "#ffffff", 0);
balls.push(whiteBall);

const ballColors = [
  "#fbc02d", "#1976d2", "#d32f2f", "#7b1fa2", "#f57c00",
  "#388e3c", "#5d4037", "#212121", "#fbc02d", "#1976d2",
  "#d32f2f", "#7b1fa2", "#f57c00", "#388e3c", "#5d4037"
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
      const color = num === 8 ? "#212121" : ballColors[colorIndex];
      balls.push(new Ball(x, y, color, num));
      colorIndex++;
    }
  }
}
setupTriangle();

function areBallsStopped() {
  return balls.every(b => b.vx === 0 && b.vy === 0);
}

// AVALIA A JOGADA APÓS TODAS AS BOLAS PARAREM
function evaluateShot() {
  let extraTurn = false;

  for (let ball of pocketedThisTurn) {
    if (gameOver) break;

    // Se encaçapar a Bola 8
    if (ball.number === 8) {
      const shooterGroup = currentTurn === "player" ? playerGroup : aiGroup;
      const remaining = getRemainingBalls(shooterGroup);

      if (remaining === 0) {
        alert((currentTurn === "player" ? "MARCELO" : "A IA") + " VENCEU O JOGO!");
      } else {
        alert((currentTurn === "player" ? "MARCELO" : "A IA") + " PERDEU! Encaçapou a bola 8 antes do tempo.");
      }
      gameOver = true;
      addBallToBoard(ball, currentTurn);
      break;
    }

    const isOdd = ball.number % 2 !== 0;

    // Define os grupos no primeiro acerto do jogo
    if (!playerGroup) {
      if (currentTurn === "player") {
        playerGroup = isOdd ? "odd" : "even";
        aiGroup = isOdd ? "even" : "odd";
      } else {
        aiGroup = isOdd ? "odd" : "even";
        playerGroup = isOdd ? "even" : "odd";
      }
    }

    // Identifica o dono correto da bola encaçapada
    const belongsToPlayer = playerGroup === "odd" ? isOdd : !isOdd;
    const owner = belongsToPlayer ? "player" : "ai";

    addBallToBoard(ball, owner);

    // Se o jogador acertou uma bola própria, ele ganha outra jogada
    if (owner === currentTurn) {
      extraTurn = true;
    }
  }

  pocketedThisTurn = [];
  isShotInProgess = false;

  // Troca o turno se o jogador não encaçapou nenhuma bola dele
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
    turnElem.style.color = currentTurn === "player" ? "#ffca28" : "#ff5252";
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

// CONTROLES DO JOGADOR MARCELO
const mouse = { x: 0, y: 0, isDragging: false };
let power = 0;

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0 && areBallsStopped() && currentTurn === "player" && !whiteBall.inPocket && !gameOver && !isShotInProgess) {
    mouse.isDragging = true;
    power = 0;
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0 && mouse.isDragging && currentTurn === "player") {
    mouse.isDragging = false;
    isShotInProgess = true;
    const angle = Math.atan2(mouse.y - whiteBall.y, mouse.x - whiteBall.x);
    const force = Math.min(power / 3, 20);
    whiteBall.vx = -Math.cos(angle) * force;
    whiteBall.vy = -Math.sin(angle) * force;
  }
});

// IA FILTRA AS BOLAS CORRETAS
function playAiTurn() {
  if (isAiThinking || !areBallsStopped() || whiteBall.inPocket || gameOver || isShotInProgess) return;
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
      isShotInProgess = true;
      const dx = closestBall.x - whiteBall.x;
      const dy = closestBall.y - whiteBall.y;
      const angle = Math.atan2(dy, dx);
      const force = 12 + Math.random() * 5;

      whiteBall.vx = Math.cos(angle) * force;
      whiteBall.vy = Math.sin(angle) * force;
    }

    isAiThinking = false;
  }, 1000);
}

// LOOP PRINCIPAL DE ANIMAÇÃO E FÍSICA
function gameLoop() {
  for (let step = 0; step < SUB_STEPS; step++) {
    balls.forEach(b => b.updatePhysics());
    resolveCollisions();
  }

  // Espera a tacada terminar e todas as bolas pararem antes de trocar o turno
  if (isShotInProgess && areBallsStopped()) {
    evaluateShot();
  }

  // Turno da IA
  if (currentTurn === "ai" && areBallsStopped() && !isShotInProgess) {
    playAiTurn();
  }

  ctx.fillStyle = "#0d5c2f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#111111";
  pockets.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  });

  balls.forEach(b => b.draw());

  // Desenhar Taco e Guia de Mira
  if (areBallsStopped() && currentTurn === "player" && !whiteBall.inPocket && !gameOver && !isShotInProgess) {
    const angle = Math.atan2(mouse.y - whiteBall.y, mouse.x - whiteBall.x);

    // Linha de mira pontilhada estendida e mais visível
    ctx.beginPath();
    ctx.moveTo(whiteBall.x, whiteBall.y);
    ctx.lineTo(whiteBall.x - Math.cos(angle) * 350, whiteBall.y - Math.sin(angle) * 350);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]); // Traços e espaços maiores
    ctx.stroke();
    ctx.setLineDash([]); // Restaura padrão de linha contínua

    if (mouse.isDragging) power = Math.min(power + 0.5, 60);

    const offset = 18 + power;
    const cueX = whiteBall.x + Math.cos(angle) * offset;
    const cueY = whiteBall.y + Math.sin(angle) * offset;

    // Sombra 3D do taco
    ctx.beginPath();
    ctx.moveTo(cueX + 3, cueY + 3);
    ctx.lineTo(cueX + Math.cos(angle) * 160 + 3, cueY + Math.sin(angle) * 160 + 3);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.stroke();

    // Desenho do taco
    ctx.beginPath();
    ctx.moveTo(cueX, cueY);
    ctx.lineTo(cueX + Math.cos(angle) * 160, cueY + Math.sin(angle) * 160);
    ctx.strokeStyle = "#e0a96d";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);