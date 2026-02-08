const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");
const playerEl = document.getElementById("player");
const nameEntryEl = document.getElementById("name-entry");
const nameInputEl = document.getElementById("name-input");
const nameSubmitEl = document.getElementById("name-submit");
const leaderboardListEl = document.getElementById("leaderboard-list");

const game = {
  width: canvas.width,
  height: canvas.height,
  lanes: 8,
  lanePadding: 44,
  laneWidth: 0,
  speed: 3.2,
  player: {
    lane: 1,
    width: 38,
    height: 58,
    y: 0
  },
  trees: [],
  asteroids: [],
  warnings: [],
  score: 0,
  lastTime: 0,
  running: true,
  nextWave: 0,
  trackOffset: 0,
  playerName: "---"
};

const LEADERBOARD_KEY = "space-race-leaderboard";

game.laneWidth = (game.width - game.lanePadding * 2) / game.lanes;

game.player.y = game.height - 90;

game.warnings = Array.from({ length: game.lanes }, () => ({
  active: false,
  flashesLeft: 0,
  timer: 0,
  visible: false,
  lane: 0
}));

game.trees = [];

const keys = {
  left: false,
  right: false
};

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    keys.left = true;
  }
  if (event.key === "ArrowRight") {
    keys.right = true;
  }
  if (!game.running && event.key === " ") {
    resetGame();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft") {
    keys.left = false;
  }
  if (event.key === "ArrowRight") {
    keys.right = false;
  }
});

nameSubmitEl.addEventListener("click", () => {
  submitNameEntry();
});

nameInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    submitNameEntry();
  }
});

function showNameEntry() {
  nameEntryEl.classList.remove("hidden");
  nameEntryEl.setAttribute("aria-hidden", "false");
  nameInputEl.value = "";
  nameInputEl.focus();
  renderLeaderboard();
}

function hideNameEntry() {
  nameEntryEl.classList.add("hidden");
  nameEntryEl.setAttribute("aria-hidden", "true");
}

function submitNameEntry() {
  const cleaned = nameInputEl.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3);
  game.playerName = cleaned.padEnd(3, "-");
  playerEl.textContent = `Pilot: ${game.playerName}`;
  saveScore(game.playerName, Math.floor(game.score));
  renderLeaderboard();
  hideNameEntry();
}

function loadLeaderboard() {
  const raw = localStorage.getItem(LEADERBOARD_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(entries) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}

function saveScore(name, score) {
  if (!score || score <= 0) return;
  const entries = loadLeaderboard();
  entries.push({ name, score, time: Date.now() });
  entries.sort((a, b) => b.score - a.score || a.time - b.time);
  saveLeaderboard(entries.slice(0, 10));
}

function renderLeaderboard() {
  const entries = loadLeaderboard();
  leaderboardListEl.innerHTML = "";
  if (entries.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No scores yet";
    leaderboardListEl.appendChild(empty);
    return;
  }
  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    rank.textContent = `${index + 1}. ${entry.name}`;
    const value = document.createElement("span");
    value.textContent = entry.score.toString();
    item.appendChild(rank);
    item.appendChild(value);
    leaderboardListEl.appendChild(item);
  });
}

function resetGame() {
  game.score = 0;
  game.asteroids = [];
  game.warnings.forEach((warning) => {
    warning.active = false;
    warning.flashesLeft = 0;
    warning.timer = 0;
    warning.visible = false;
  });
  game.running = true;
  game.nextWave = 0;
  statusEl.textContent = "Avoid the missiles!";
  requestAnimationFrame(loop);
}

function laneCenter(laneIndex) {
  return game.lanePadding + game.laneWidth * laneIndex + game.laneWidth / 2;
}

function spawnWarning() {
  const lane = Math.floor(Math.random() * game.lanes);
  const warning = game.warnings[lane];
  if (warning.active) return;
  warning.active = true;
  warning.flashesLeft = 6;
  warning.timer = 0;
  warning.visible = true;
  warning.lane = lane;
}

function spawnAsteroid(lane) {
  const asteroid = {
    lane,
    x: laneCenter(lane),
    y: -40,
    radius: 22 + Math.random() * 8,
    speed: game.speed + Math.random() * 1.4
  };
  game.asteroids.push(asteroid);
}

function updateWarnings(delta) {
  game.warnings.forEach((warning) => {
    if (!warning.active) return;
    warning.timer += delta;
    if (warning.timer > 180) {
      warning.timer = 0;
      warning.visible = !warning.visible;
      warning.flashesLeft -= 1;
      if (warning.flashesLeft <= 0) {
        warning.active = false;
        warning.visible = false;
        spawnAsteroid(warning.lane);
      }
    }
  });
}

function updatePlayer() {
  if (keys.left && game.player.lane > 0) {
    game.player.lane -= 1;
    keys.left = false;
  }
  if (keys.right && game.player.lane < game.lanes - 1) {
    game.player.lane += 1;
    keys.right = false;
  }
}

function updateAsteroids(delta) {
  game.asteroids.forEach((asteroid) => {
    asteroid.y += asteroid.speed * delta * 0.06;
  });
  game.asteroids = game.asteroids.filter((asteroid) => asteroid.y < game.height + 60);
}

function checkCollision() {
  const playerX = laneCenter(game.player.lane);
  const playerY = game.player.y;
  for (const asteroid of game.asteroids) {
    if (asteroid.lane !== game.player.lane) continue;
    const missileWidth = asteroid.radius * 0.9;
    const missileHeight = asteroid.radius * 2.4;
    const halfMissileW = missileWidth * 0.45;
    const halfMissileH = missileHeight * 0.45;
    const halfPlayerW = game.player.width * 0.35;
    const halfPlayerH = game.player.height * 0.45;
    const overlapX = Math.abs(asteroid.x - playerX) < halfMissileW + halfPlayerW;
    const overlapY = Math.abs(asteroid.y - playerY) < halfMissileH + halfPlayerH;
    if (overlapX && overlapY) {
      game.running = false;
      showNameEntry();
      statusEl.textContent = "Crashed! Press Space to restart.";
      return true;
    }
  }
  return false;
}

function updateTrees() {}

function update(delta) {
  if (!game.running) return;
  updatePlayer();
  updateTrees(delta);
  game.trackOffset = (game.trackOffset + delta * game.speed * 0.06) % 40;
  updateWarnings(delta);
  updateAsteroids(delta);
  if (checkCollision()) return;

  game.score += delta * 0.02;
  scoreEl.textContent = `Score: ${Math.floor(game.score)}`;

  if (performance.now() > game.nextWave) {
    spawnWarning();
    const wait = 900 + Math.random() * 900;
    game.nextWave = performance.now() + wait;
  }
}

function drawTrack() {
  ctx.fillStyle = "#1f5e1f";
  ctx.fillRect(0, 0, game.width, game.height);

  const trackGradient = ctx.createLinearGradient(0, 0, 0, game.height);
  trackGradient.addColorStop(0, "rgba(100,160,255,0.12)");
  trackGradient.addColorStop(1, "rgba(20,40,80,0.5)");
  ctx.fillStyle = trackGradient;
  ctx.fillRect(game.lanePadding - 10, 0, game.width - game.lanePadding * 2 + 20, game.height);

  ctx.fillStyle = "rgba(10, 20, 40, 0.85)";
  ctx.fillRect(game.lanePadding + 4, 0, game.width - game.lanePadding * 2 - 8, game.height);

  ctx.fillStyle = "rgba(120, 200, 255, 0.35)";
  for (let lane = 1; lane < game.lanes; lane += 1) {
    const boundaryX = game.lanePadding + game.laneWidth * lane;
    for (let y = -40; y < game.height + 40; y += 40) {
      const segmentY = y + game.trackOffset;
      ctx.fillRect(boundaryX - 2, segmentY, 4, 18);
    }
  }

  ctx.strokeStyle = "rgba(160, 210, 255, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(game.lanePadding - 12, 0);
  ctx.lineTo(game.lanePadding - 12, game.height);
  ctx.moveTo(game.width - game.lanePadding + 12, 0);
  ctx.lineTo(game.width - game.lanePadding + 12, game.height);
  ctx.stroke();

  ctx.strokeStyle = "rgba(235, 235, 235, 0.8)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(game.lanePadding - 20, 0);
  ctx.lineTo(game.lanePadding - 20, game.height);
  ctx.moveTo(game.width - game.lanePadding + 20, 0);
  ctx.lineTo(game.width - game.lanePadding + 20, game.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawWarnings() {
  game.warnings.forEach((warning) => {
    if (!warning.active || !warning.visible) return;
    const x = game.lanePadding + game.laneWidth * warning.lane;
    ctx.fillStyle = "rgba(255, 70, 70, 0.7)";
    ctx.fillRect(x + 4, 0, game.laneWidth - 8, game.height);
  });
}

function drawPlayer() {
  const x = laneCenter(game.player.lane);
  const y = game.player.y;
  const width = game.player.width;
  const height = game.player.height;

  ctx.save();
  ctx.translate(x, y);
  const bodyWidth = width * 1.05;
  const bodyHeight = height * 1.05;

  ctx.fillStyle = "#c9182b";
  ctx.beginPath();
  ctx.roundRect(-bodyWidth * 0.18, -bodyHeight * 0.55, bodyWidth * 0.36, bodyHeight * 1.1, 10);
  ctx.fill();

  ctx.fillStyle = "#ff3b4f";
  ctx.beginPath();
  ctx.moveTo(0, -bodyHeight * 0.7);
  ctx.lineTo(bodyWidth * 0.18, -bodyHeight * 0.35);
  ctx.lineTo(0, -bodyHeight * 0.15);
  ctx.lineTo(-bodyWidth * 0.18, -bodyHeight * 0.35);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#1e2b44";
  ctx.beginPath();
  ctx.roundRect(-bodyWidth * 0.14, -bodyHeight * 0.18, bodyWidth * 0.28, bodyHeight * 0.25, 6);
  ctx.fill();

  ctx.fillStyle = "#0a0f1f";
  ctx.beginPath();
  ctx.roundRect(-bodyWidth * 0.5, -bodyHeight * 0.28, bodyWidth * 0.18, bodyHeight * 0.24, 6);
  ctx.roundRect(bodyWidth * 0.32, -bodyHeight * 0.28, bodyWidth * 0.18, bodyHeight * 0.24, 6);
  ctx.roundRect(-bodyWidth * 0.5, bodyHeight * 0.12, bodyWidth * 0.18, bodyHeight * 0.24, 6);
  ctx.roundRect(bodyWidth * 0.32, bodyHeight * 0.12, bodyWidth * 0.18, bodyHeight * 0.24, 6);
  ctx.fill();

  ctx.fillStyle = "#f4f4f6";
  ctx.beginPath();
  ctx.roundRect(-bodyWidth * 0.6, -bodyHeight * 0.48, bodyWidth * 1.2, bodyHeight * 0.12, 6);
  ctx.fill();

  ctx.fillStyle = "#c9182b";
  ctx.beginPath();
  ctx.roundRect(-bodyWidth * 0.55, bodyHeight * 0.42, bodyWidth * 1.1, bodyHeight * 0.16, 6);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.ellipse(0, -bodyHeight * 0.42, bodyWidth * 0.1, bodyHeight * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAsteroids() {
  game.asteroids.forEach((asteroid) => {
    const bodyWidth = asteroid.radius * 0.9;
    const bodyHeight = asteroid.radius * 2.4;

    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(Math.PI);

    ctx.fillStyle = "#d6d7df";
    ctx.beginPath();
    ctx.roundRect(-bodyWidth * 0.45, -bodyHeight * 0.45, bodyWidth * 0.9, bodyHeight * 0.9, 6);
    ctx.fill();

    ctx.fillStyle = "#ff5c5c";
    ctx.beginPath();
    ctx.moveTo(0, -bodyHeight * 0.65);
    ctx.lineTo(bodyWidth * 0.45, -bodyHeight * 0.2);
    ctx.lineTo(-bodyWidth * 0.45, -bodyHeight * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1e263a";
    ctx.beginPath();
    ctx.roundRect(-bodyWidth * 0.2, -bodyHeight * 0.15, bodyWidth * 0.4, bodyHeight * 0.25, 4);
    ctx.fill();

    ctx.fillStyle = "#3a4a6b";
    ctx.beginPath();
    ctx.moveTo(-bodyWidth * 0.45, bodyHeight * 0.15);
    ctx.lineTo(-bodyWidth * 0.75, bodyHeight * 0.35);
    ctx.lineTo(-bodyWidth * 0.45, bodyHeight * 0.35);
    ctx.closePath();
    ctx.moveTo(bodyWidth * 0.45, bodyHeight * 0.15);
    ctx.lineTo(bodyWidth * 0.75, bodyHeight * 0.35);
    ctx.lineTo(bodyWidth * 0.45, bodyHeight * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255, 180, 80, 0.9)";
    ctx.beginPath();
    ctx.moveTo(0, bodyHeight * 0.55);
    ctx.lineTo(bodyWidth * 0.25, bodyHeight * 0.2);
    ctx.lineTo(-bodyWidth * 0.25, bodyHeight * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  });
}

function draw() {
  drawTrack();
  drawWarnings();
  drawAsteroids();
  drawPlayer();
}

function loop(timestamp) {
  if (!game.lastTime) game.lastTime = timestamp;
  const delta = timestamp - game.lastTime;
  game.lastTime = timestamp;

  update(delta);
  draw();

  if (game.running) {
    requestAnimationFrame(loop);
  }
}

requestAnimationFrame(loop);
