
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const $ = (id) => document.getElementById(id);

const overlay = $("overlay");
const startBtn = $("startBtn");
const pauseIndicator = $("pauseIndicator");

let W = 0;
let H = 0;
let running = false;
let paused = false;
let gameOver = false;
let animationId = 0;
let lastTime = 0;
let elapsed = 0;
let score = 0;
let level = 1;
let lives = 3;
let spawnTimer = 0;
let orbTimer = 0;
let shake = 0;
let dashTime = 0;
let invulnerable = 0;
let best = 0;

try {
  best = Number(localStorage.getItem("neonDodgeBest")) || 0;
} catch {
  best = 0;
}

const keys = new Set();
const particles = [];
const hazards = [];
const orbs = [];
const stars = [];

const player = {
  x: 0,
  y: 0,
  size: 12,
  speed: 260,
  trail: []
};

const colors = {
  cyan: "#55f6e5",
  red: "#ff5874",
  yellow: "#ffd166",
  purple: "#a78bfa"
};

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  W = rect.width;
  H = rect.height;

  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!running) {
    player.x = W / 2;
    player.y = H * 0.72;
  }

  createStars();
  draw();
}

function createStars() {
  stars.length = 0;

  const count = Math.floor((W * H) / 2500);

  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 20 + 8,
      alpha: Math.random() * 0.55 + 0.15
    });
  }
}

function updateHUD() {
  $("score").textContent = String(score).padStart(5, "0");
  $("best").textContent = String(best).padStart(5, "0");
  $("level").textContent = String(level).padStart(2, "0");
  $("lives").textContent = lives > 0
    ? Array.from({ length: lives }, () => "♥").join(" ")
    : "—";
}

function showOverlay(type) {
  overlay.classList.remove("hidden");

  if (type === "start") {
    $("overlayEyebrow").textContent = "SYSTEM READY";
    $("overlayTitle").innerHTML = "Ready to<br><span>survive?</span>";
    $("overlayText").textContent =
      "Move fast. Think faster. Don't touch the red.";
    startBtn.innerHTML = 'START GAME <span>→</span>';
    $("overlayHint").textContent = "PRESS ENTER TO BEGIN";
  } else {
    $("overlayEyebrow").textContent = "SIGNAL LOST";
    $("overlayTitle").innerHTML = "Game<br><span>over.</span>";
    $("overlayText").textContent =
      `You scored ${score} points. ${
        score >= best && score > 0
          ? "New high score!"
          : "Ready for another run?"
      }`;
    startBtn.innerHTML = 'PLAY AGAIN <span>↻</span>';
    $("overlayHint").textContent = "PRESS ENTER TO RETRY";
  }
}

function startGame() {
  cancelAnimationFrame(animationId);

  hazards.length = 0;
  orbs.length = 0;
  particles.length = 0;
  player.trail.length = 0;
  keys.clear();

  score = 0;
  level = 1;
  lives = 3;
  elapsed = 0;
  spawnTimer = 0;
  orbTimer = 0;
  shake = 0;
  dashTime = 0;
  invulnerable = 0;

  player.x = W / 2;
  player.y = H * 0.72;

  running = true;
  paused = false;
  gameOver = false;

  overlay.classList.add("hidden");
  pauseIndicator.classList.add("hidden");

  updateHUD();

  lastTime = performance.now();
  animationId = requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  gameOver = true;
  keys.clear();

  if (score > best) {
    best = score;

    try {
      localStorage.setItem("neonDodgeBest", String(best));
    } catch {
      // The game still works if browser storage is unavailable.
    }
  }

  updateHUD();
  showOverlay("over");
}

function togglePause() {
  if (!running || gameOver) return;

  paused = !paused;
  keys.clear();

  if (paused) {
    pauseIndicator.classList.remove("hidden");
    lastTime = performance.now();
  } else {
    pauseIndicator.classList.add("hidden");
    lastTime = performance.now();
    animationId = requestAnimationFrame(loop);
  }
}

function spawnHazard() {
  const size = 12 + Math.random() * 20;
  const difficulty = Math.min(level, 12);

  hazards.push({
    x: size + Math.random() * (W - size * 2),
    y: -size - 5,
    size,
    speed: 100 + Math.random() * 65 + difficulty * 13,
    angle: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 3
  });
}

function spawnOrb() {
  const radius = 7;

  orbs.push({
    x: radius + 12 + Math.random() * Math.max(1, W - 48),
    y: -20,
    radius,
    speed: 95 + Math.random() * 45 + level * 5,
    phase: Math.random() * Math.PI * 2
  });
}

function addParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 170;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + Math.random() * 0.55,
      maxLife: 0.85,
      size: 1.5 + Math.random() * 3,
      color
    });
  }
}

function collides(x, y, radius, obj) {
  const half = obj.size / 2;
  const nearestX = Math.max(obj.x - half, Math.min(x, obj.x + half));
  const nearestY = Math.max(obj.y - half, Math.min(y, obj.y + half));
  const dx = x - nearestX;
  const dy = y - nearestY;

  return dx * dx + dy * dy < radius * radius;
}

function update(dt) {
  elapsed += dt;

  level = 1 + Math.floor(elapsed / 15);
  score += Math.floor(dt * 10);
  dashTime = Math.max(0, dashTime - dt);
  invulnerable = Math.max(0, invulnerable - dt);
  shake = Math.max(0, shake - dt * 24);

  const directions = {
    left: keys.has("ArrowLeft") || keys.has("a") || keys.has("A"),
    right: keys.has("ArrowRight") || keys.has("d") || keys.has("D"),
    up: keys.has("ArrowUp") || keys.has("w") || keys.has("W"),
    down: keys.has("ArrowDown") || keys.has("s") || keys.has("S")
  };

  let dx = Number(directions.right) - Number(directions.left);
  let dy = Number(directions.down) - Number(directions.up);

  if (dx && dy) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }

  const speed = player.speed * (dashTime > 0 ? 2.25 : 1);

  player.x += dx * speed * dt;
  player.y += dy * speed * dt;

  const margin = player.size + 2;
  player.x = Math.max(margin, Math.min(W - margin, player.x));
  player.y = Math.max(margin, Math.min(H - margin, player.y));

  player.trail.push({ x: player.x, y: player.y });
  if (player.trail.length > 7) player.trail.shift();

  for (const star of stars) {
    star.y += star.speed * dt;

    if (star.y > H) {
      star.y = 0;
      star.x = Math.random() * W;
    }
  }

  spawnTimer += dt;
  const spawnInterval = Math.max(0.19, 0.82 - (level - 1) * 0.055);

  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnHazard();

    if (level >= 4 && Math.random() < 0.22) {
      spawnHazard();
    }
  }

  orbTimer += dt;

  if (orbTimer >= 2.4) {
    orbTimer = 0;

    if (Math.random() < 0.85) spawnOrb();
  }

  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];

    h.y += h.speed * dt;
    h.angle += h.spin * dt;

    if (h.y - h.size > H) {
      hazards.splice(i, 1);
      continue;
    }

    if (invulnerable <= 0 && collides(player.x, player.y, player.size, h)) {
      hazards.splice(i, 1);
      lives--;
      invulnerable = 1.25;
      shake = 9;

      addParticles(player.x, player.y, colors.red, 22);
      updateHUD();

      if (lives <= 0) {
        endGame();
        return;
      }
    }
  }

  for (let i = orbs.length - 1; i >= 0; i--) {
    const orb = orbs[i];

    orb.y += orb.speed * dt;
    orb.phase += dt * 4;

    if (orb.y - orb.radius > H) {
      orbs.splice(i, 1);
      continue;
    }

    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < player.size + orb.radius + 2) {
      score += 50;
      addParticles(orb.x, orb.y, colors.yellow, 15);
      orbs.splice(i, 1);
      updateHUD();
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.08, dt);
    p.vy *= Math.pow(0.08, dt);
    p.life -= dt;

    if (p.life <= 0) particles.splice(i, 1);
  }

  updateHUD();
}

function drawBackground() {
  ctx.fillStyle = "#080e1b";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(
    W / 2, H * 0.4, 5,
    W / 2, H * 0.4, H * 0.8
  );

  glow.addColorStop(0, "#14223b");
  glow.addColorStop(1, "#080e1b");

  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const gridSize = 32;

  ctx.strokeStyle = "#6685b0";
  ctx.globalAlpha = 0.09;
  ctx.lineWidth = 0.6;

  for (let x = 0; x < W; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  for (let y = 0; y < H; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#d6e9ff";
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }

  ctx.globalAlpha = 1;
}

function drawPlayer() {
  for (let i = 0; i < player.trail.length; i++) {
    const p = player.trail[i];
    const alpha = ((i + 1) / player.trail.length) * 0.22;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = dashTime > 0 ? colors.purple : colors.cyan;
    ctx.beginPath();
    ctx.arc(p.x, p.y, player.size * ((i + 1) / player.trail.length), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  if (invulnerable > 0 && Math.floor(invulnerable * 12) % 2 === 0) {
    return;
  }

  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.shadowBlur = 22;
  ctx.shadowColor = dashTime > 0 ? colors.purple : colors.cyan;
  ctx.fillStyle = dashTime > 0 ? colors.purple : colors.cyan;

  ctx.beginPath();
  ctx.moveTo(0, -player.size - 3);
  ctx.lineTo(player.size, 0);
  ctx.lineTo(0, player.size + 3);
  ctx.lineTo(-player.size, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#10202b";
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawHazards() {
  for (const h of hazards) {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);

    ctx.shadowBlur = 18;
    ctx.shadowColor = colors.red;
    ctx.fillStyle = "#ff587426";
    ctx.strokeStyle = colors.red;
    ctx.lineWidth = 1.5;

    ctx.fillRect(-h.size / 2, -h.size / 2, h.size, h.size);
    ctx.strokeRect(-h.size / 2, -h.size / 2, h.size, h.size);

    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.red;
    ctx.fillRect(-2, -2, 4, 4);

    ctx.restore();
  }
}

function drawOrbs() {
  for (const orb of orbs) {
    const pulse = 1 + Math.sin(orb.phase) * 0.16;

    ctx.save();
    ctx.translate(orb.x, orb.y);
    ctx.scale(pulse, pulse);

    ctx.shadowBlur = 22;
    ctx.shadowColor = colors.yellow;
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ffd16622";
    ctx.fill();

    ctx.fillStyle = colors.yellow;
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  ctx.globalAlpha = 1;
}

function draw() {
  ctx.save();

  if (shake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * shake,
      (Math.random() - 0.5) * shake
    );
  }

  drawBackground();
  drawOrbs();
  drawHazards();
  drawParticles();
  drawPlayer();

  ctx.restore();

  if (running && !paused) {
    ctx.fillStyle = "#9baac3";
    ctx.font = "10px monospace";
    ctx.fillText(`SURVIVAL: ${Math.floor(elapsed)}s`, 14, 23);

    ctx.textAlign = "right";
    ctx.fillStyle = colors.cyan;
    ctx.fillText(`LVL ${String(level).padStart(2, "0")}`, W - 14, 23);
    ctx.textAlign = "left";
  }
}

function loop(timestamp) {
  if (!running || paused) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.035);
  lastTime = timestamp;

  update(dt);
  draw();

  if (running && !paused) {
    animationId = requestAnimationFrame(loop);
  }
}

function boost() {
  if (!running || paused || dashTime > 0) return;

  dashTime = 0.22;
  addParticles(player.x, player.y, colors.purple, 8);
}

window.addEventListener("keydown", (event) => {
  const key = event.key;

  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(key)
  ) {
    event.preventDefault();
  }

  if (key === "Enter" && !running) {
    startGame();
    return;
  }

  if (key === " " && running) {
    togglePause();
    return;
  }

  if (key === "Escape" && running) {
    togglePause();
    return;
  }

  if (key === "Shift") {
    boost();
  }

  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

window.addEventListener("blur", () => {
  keys.clear();

  if (running && !paused) {
    togglePause();
  }
});

startBtn.addEventListener("click", startGame);

document.querySelectorAll(".touch-btn").forEach((button) => {
  const dir = button.dataset.dir;

  const keyMap = {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight"
  };

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    keys.add(keyMap[dir]);
  });

  const release = () => keys.delete(keyMap[dir]);

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
updateHUD();
showOverlay("start");
