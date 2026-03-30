/* ===== Supabase 配置（动态加载，避免变量冲突） ===== */
var _db = null;
(function() {
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  s.onload = function() {
    try {
      _db = window.supabase.createClient(
        'https://khkipsfovatbqoacitcb.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtoa2lwc2ZvdmF0YnFvYWNpdGNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTY5MzksImV4cCI6MjA5MDM5MjkzOX0.KeBXedxf28oNg5jwaS5IQ4h3ErjrnDHLRKTA6RorAkc'
      );
      // SDK 加载完成后初始化排行榜
      if (document.getElementById('leaderboard-content')) {
        loadLeaderboard();
      }
    } catch(e) {
      console.warn('Supabase 初始化失败');
    }
  };
  s.onerror = function() {
    console.warn('Supabase SDK 加载失败，排行榜不可用');
  };
  document.head.appendChild(s);
})();

/* ===== 辅助函数：玩家 ID ===== */
function getPlayerId() {
  return localStorage.getItem('player-id') || '';
}

function getPlayerName() {
  return localStorage.getItem('player-name') || '';
}

function login() {
  var name = document.getElementById('login-id').value.trim();
  if (!name) {
    document.getElementById('login-id').style.borderColor = 'var(--accent)';
    document.getElementById('login-id').focus();
    return;
  }
  localStorage.setItem('player-id', name);
  localStorage.setItem('player-name', name);
  gameState.playerId = name;
  gameState.playerName = name;

  document.getElementById('current-player-name').textContent = name;
  loadScores();
  updateScoresDisplay();
  showScreen('screen-home');

  if (_db) {
    loadLeaderboard();
  }
}

function logout() {
  localStorage.removeItem('player-id');
  localStorage.removeItem('player-name');
  gameState.playerId = '';
  gameState.playerName = '';
  document.getElementById('login-id').value = '';
  showScreen('screen-login');
}

/* ===== 全局状态 ===== */
var gameState = {
  currentScreen: 'login',
  playerId: '',
  playerName: '',
  scores: {},
  leaderboardGame: 'cards',
  leaderboardLevel: 'easy'
};

const CARD_EMOJIS = ['🍎','🍌','🍉','🍊','🍋','🍌','🍓','🍒','🍑','🥝','🍍','🥭','🍐','🍈','🥕','🌽'];

let cardsGame = {
  level: 'easy',
  board: [],
  flipped: [],
  matched: new Set(),
  moves: 0,
  startTime: null,
  timerInterval: null,
  lockBoard: false,
  previewMode: false
};

let simonGame = {
  sequence: [],
  playerSequence: [],
  level: 1,
  best: 1,
  gameActive: false,
  canPlay: false,
  timerInterval: null
};

let game2048 = {
  grid: [],
  score: 0,
  bestScore: 0,
  gameOver: false,
  won: false
};

function getScoreKey(game, level) {
  if (level) {
    return gameState.playerId + '-' + game + '-' + level;
  }
  return gameState.playerId + '-' + game;
}

function loadScores() {
  gameState.scores = {
    cardsEasy: localStorage.getItem(getScoreKey('cards', 'easy')) || '--',
    cardsMedium: localStorage.getItem(getScoreKey('cards', 'medium')) || '--',
    cardsHard: localStorage.getItem(getScoreKey('cards', 'hard')) || '--',
    simon: localStorage.getItem(getScoreKey('simon')) || 1,
    game2048: localStorage.getItem(getScoreKey('game2048')) || 0
  };
}

/* ===== 初始化 ===== */
window.addEventListener('DOMContentLoaded', function() {
  // 检查是否有已登录的用户
  var savedName = localStorage.getItem('player-name');
  if (savedName) {
    gameState.playerId = savedName;
    gameState.playerName = savedName;
    document.getElementById('current-player-name').textContent = savedName;
    document.getElementById('login-id').value = savedName;
    loadScores();
    updateScoresDisplay();
    showScreen('screen-home');

    // 加载排行榜
    if (_db) {
      loadLeaderboard();
    } else {
      document.getElementById('leaderboard-content').innerHTML = '<div class="loading">排行榜正在加载...</div>';
    }
  } else {
    showScreen('screen-login');
    document.getElementById('login-id').focus();
  }

  // 回车键触发登录
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && gameState.currentScreen === 'screen-login') {
      login();
    }
  });
});

/* ===== 屏幕导航 ===== */
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  gameState.currentScreen = screenId;
}

function goHome() {
  stopCardsGame();
  stopSimonGame();
  // 关闭所有弹窗
  document.getElementById('modal-win').classList.add('hidden');
  document.getElementById('modal-fail').classList.add('hidden');
  showScreen('screen-home');
  updateScoresDisplay();
}

function startGame(mode) {
  if (mode === 'cards') {
    initCardsGame('easy');
    showScreen('screen-cards');
  } else if (mode === 'simon') {
    initSimonGame();
    showScreen('screen-simon');
  } else if (mode === 'game2048') {
    initGame2048();
    showScreen('screen-2048');
  } else if (mode === 'brick') {
    initBrickGame();
    showScreen('screen-brick');
  }
}

/* ===== 翻牌游戏逻辑 ===== */
function initCardsGame(level) {
  cardsGame.level = level;
  cardsGame.board = [];
  cardsGame.flipped = [];
  cardsGame.matched = new Set();
  cardsGame.moves = 0;
  cardsGame.lockBoard = true;
  cardsGame.previewMode = true;
  clearInterval(cardsGame.timerInterval);

  const config = { easy: {w:4, h:4}, medium: {w:5, h:4}, hard: {w:6, h:5} };
  const { w, h } = config[level];
  const totalCards = w * h;
  const pairsCount = totalCards / 2;

  // 创建卡牌数组
  let emojis = [];
  for (let i = 0; i < pairsCount; i++) {
    emojis.push(CARD_EMOJIS[i % CARD_EMOJIS.length]);
    emojis.push(CARD_EMOJIS[i % CARD_EMOJIS.length]);
  }
  emojis = emojis.sort(() => Math.random() - 0.5);

  cardsGame.board = emojis;

  // 构建棋盘
  const boardEl = document.getElementById('cards-board');
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${w}, 1fr)`;

  emojis.forEach((emoji, idx) => {
    const card = document.createElement('div');
    card.className = 'card-item previewing';
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-back"></div>
        <div class="card-front">${emoji}</div>
      </div>
    `;
    card.addEventListener('click', () => flipCard(idx));
    boardEl.appendChild(card);
  });

  // 更新UI
  const levelLabels = { easy: '简单 (4×4)', medium: '中等 (4×5)', hard: '困难 (5×6)' };
  document.getElementById('cards-level-label').textContent = levelLabels[level];
  document.getElementById('cards-moves').textContent = '0';
  document.getElementById('cards-pairs').textContent = `0/${pairsCount}`;
  document.querySelectorAll('.level-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.level === level);
  });
  document.getElementById('cards-level-selector').style.display = 'flex';

  // 显示所有卡牌 3 秒后盖上
  const previewTime = 3000;
  setTimeout(() => {
    cardsGame.lockBoard = false;
    cardsGame.previewMode = false;
    document.querySelectorAll('.card-item').forEach(card => {
      card.classList.remove('previewing');
      card.classList.remove('flipped');
    });
    cardsGame.startTime = Date.now();
    startCardsTimer();
  }, previewTime);
}

function setCardsLevel(level) {
  stopCardsGame();
  initCardsGame(level);
}

function flipCard(idx) {
  if (cardsGame.lockBoard) return;
  if (cardsGame.flipped.includes(idx)) return;
  if (cardsGame.matched.has(idx)) return;

  cardsGame.flipped.push(idx);
  const card = document.querySelectorAll('.card-item')[idx];
  card.classList.add('flipped');

  if (cardsGame.flipped.length === 2) {
    cardsGame.lockBoard = true;
    cardsGame.moves++;
    document.getElementById('cards-moves').textContent = cardsGame.moves;
    setTimeout(checkMatch, 600);
  }
}

function checkMatch() {
  const [a, b] = cardsGame.flipped;
  const match = cardsGame.board[a] === cardsGame.board[b];

  const cardEls = document.querySelectorAll('.card-item');
  if (match) {
    cardsGame.matched.add(a);
    cardsGame.matched.add(b);
    cardEls[a].classList.add('matched');
    cardEls[b].classList.add('matched');
    cardEls[a].addEventListener('click', () => {}, true);
    cardEls[b].addEventListener('click', () => {}, true);
  } else {
    cardEls[a].classList.remove('flipped');
    cardEls[b].classList.remove('flipped');
  }

  const totalCards = cardsGame.board.length;
  const pairsCount = totalCards / 2;
  document.getElementById('cards-pairs').textContent = `${cardsGame.matched.size / 2}/${pairsCount}`;

  if (cardsGame.matched.size === totalCards) {
    const time = Math.floor((Date.now() - cardsGame.startTime) / 1000);
    const msg = `用时 ${Math.floor(time / 60)} 分 ${time % 60} 秒，${cardsGame.moves} 步完成！`;
    showWinModal(msg, 'cards');
    saveCardsScore(cardsGame.level, cardsGame.moves);
    // 提交到排行榜
    submitScore('cards', cardsGame.level, cardsGame.moves, time);
  }

  cardsGame.flipped = [];
  cardsGame.lockBoard = false;
}

function startCardsTimer() {
  clearInterval(cardsGame.timerInterval);
  cardsGame.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - cardsGame.startTime) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    document.getElementById('cards-time').textContent = `${min}:${sec}`;
  }, 100);
}

function stopCardsGame() {
  clearInterval(cardsGame.timerInterval);
  cardsGame.flipped = [];
  cardsGame.matched.clear();
}

function restartCards() {
  initCardsGame(cardsGame.level);
}

function saveCardsScore(level, moves) {
  const key = getScoreKey('cards', level);
  const best = localStorage.getItem(key);
  if (!best || parseInt(moves) < parseInt(best)) {
    localStorage.setItem(key, moves);
    const levelKey = 'cards' + level.charAt(0).toUpperCase() + level.slice(1);
    gameState.scores[levelKey] = moves;
  }
}

/* ===== Simon游戏逻辑 ===== */
function initSimonGame() {
  simonGame.sequence = [];
  simonGame.playerSequence = [];
  simonGame.level = 1;
  simonGame.gameActive = false;
  simonGame.canPlay = false;
  simonGame.best = localStorage.getItem(getScoreKey('simon')) || 1;

  document.getElementById('simon-level').textContent = '1';
  document.getElementById('simon-best-display').textContent = simonGame.best;
  document.getElementById('simon-status').textContent = '按开始按钮开始游戏';
  document.getElementById('simon-status').className = 'simon-status';
  document.getElementById('simon-start-btn').disabled = false;
  document.getElementById('simon-progress').innerHTML = '';

  document.querySelectorAll('.simon-btn').forEach(btn => {
    btn.classList.remove('lit', 'disabled');
  });
}

function simonStart() {
  if (simonGame.gameActive) return;
  simonGame.gameActive = true;
  simonGame.sequence = [];
  simonGame.playerSequence = [];
  simonGame.level = 1;
  document.getElementById('simon-start-btn').disabled = true;
  simonGameRound();
}

function simonGameRound() {
  // 清空玩家输入
  simonGame.playerSequence = [];
  document.querySelectorAll('.simon-btn').forEach(b => b.classList.add('disabled'));

  // 添加新颜色
  const colors = ['green', 'red', 'blue', 'yellow'];
  const newColor = colors[Math.floor(Math.random() * 4)];
  simonGame.sequence.push(newColor);

  document.getElementById('simon-status').textContent = `关卡 ${simonGame.level}: 看颜色序列`;
  document.getElementById('simon-status').className = 'simon-status';

  // 显示序列
  setTimeout(() => {
    simonPlaySequence();
  }, 600);
}

async function simonPlaySequence() {
  for (let i = 0; i < simonGame.sequence.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 600));
    const color = simonGame.sequence[i];
    simonFlashButton(color);
  }

  // 允许玩家输入
  document.querySelectorAll('.simon-btn').forEach(b => b.classList.remove('disabled'));
  document.getElementById('simon-status').textContent = '你的回合：请重复颜色序列';
  document.getElementById('simon-status').className = 'simon-status playing';
  simonGame.canPlay = true;

  // 更新进度条
  updateSimonProgress();
}

function simonFlashButton(color) {
  const btn = document.getElementById(`simon-${color}`);
  btn.classList.add('lit');
  setTimeout(() => {
    btn.classList.remove('lit');
  }, 400);
}

function simonPlayerPress(color) {
  if (!simonGame.canPlay) return;
  if (!simonGame.gameActive) return;

  simonGame.playerSequence.push(color);
  simonFlashButton(color);

  // 验证
  const idx = simonGame.playerSequence.length - 1;
  if (simonGame.playerSequence[idx] !== simonGame.sequence[idx]) {
    // 失败
    simonGameFail();
    return;
  }

  // 检查是否完成这一关
  if (simonGame.playerSequence.length === simonGame.sequence.length) {
    document.getElementById('simon-status').textContent = '✓ 正确！准备下一关...';
    document.getElementById('simon-status').className = 'simon-status success';
    simonGame.canPlay = false;
    document.querySelectorAll('.simon-btn').forEach(b => b.classList.add('disabled'));

    simonGame.level++;
    document.getElementById('simon-level').textContent = simonGame.level;

  // 更新最高分
  if (simonGame.level > simonGame.best) {
    simonGame.best = simonGame.level;
    localStorage.setItem(getScoreKey('simon'), simonGame.best);
    document.getElementById('simon-best-display').textContent = simonGame.best;
  }
  // 提交到排行榜
  submitScore('simon', null, simonGame.level - 1, null);

    setTimeout(() => {
      simonGameRound();
    }, 1000);
  }
}

function simonGameFail() {
  simonGame.gameActive = false;
  simonGame.canPlay = false;
  document.querySelectorAll('.simon-btn').forEach(b => b.classList.add('disabled'));

  document.getElementById('simon-status').textContent = '✗ 错了！游戏结束';
  document.getElementById('simon-status').className = 'simon-status fail';

  const msg = `到达第 ${simonGame.level} 关，个人最高记录：${simonGame.best}`;
  showFailModal(msg);
}

function updateSimonProgress() {
  const container = document.getElementById('simon-progress');
  container.innerHTML = '';
  for (let i = 0; i < simonGame.sequence.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'progress-dot done';
    container.appendChild(dot);
  }
}

function stopSimonGame() {
  simonGame.gameActive = false;
  simonGame.canPlay = false;
  document.getElementById('simon-start-btn').disabled = false;
}

function restartSimon() {
  stopSimonGame();
  initSimonGame();
}

let winGameType = null;

/* ===== 模态框 ===== */
function showWinModal(msg, gameType) {
  winGameType = gameType;
  document.getElementById('modal-title').textContent = '🎉 恭喜通关！';
  document.getElementById('modal-msg').textContent = msg;
  document.getElementById('modal-win').classList.remove('hidden');
  stopCardsGame();
}

function showFailModal(msg) {
  document.getElementById('modal-fail-msg').textContent = msg;
  document.getElementById('modal-fail').classList.remove('hidden');
}

function modalNextLevel() {
  document.getElementById('modal-win').classList.add('hidden');
  if (winGameType === 'cards') {
    const nextLevel = { easy: 'medium', medium: 'hard', hard: 'easy' };
    const next = nextLevel[cardsGame.level] || 'easy';
    initCardsGame(next);
  }
}

function modalRetry() {
  document.getElementById('modal-fail').classList.add('hidden');
  if (gameState.currentScreen === 'screen-cards') {
    restartCards();
  } else if (gameState.currentScreen === 'screen-simon') {
    restartSimon();
  } else if (gameState.currentScreen === 'screen-2048') {
    restartGame2048();
  }
}

/* ===== 成绩显示 ===== */
function updateScoresDisplay() {
  document.getElementById('best-cards-easy').textContent = localStorage.getItem(getScoreKey('cards', 'easy')) || '--';
  document.getElementById('best-cards-medium').textContent = localStorage.getItem(getScoreKey('cards', 'medium')) || '--';
  document.getElementById('best-cards-hard').textContent = localStorage.getItem(getScoreKey('cards', 'hard')) || '--';
  document.getElementById('best-simon').textContent = localStorage.getItem(getScoreKey('simon')) || 1;
  document.getElementById('best-game2048').textContent = localStorage.getItem(getScoreKey('game2048')) || 0;
  document.getElementById('best-brick').textContent = localStorage.getItem(getScoreKey('brick')) || '--';
}

/* ===== 排行榜功能 ===== */
async function loadLeaderboard() {
  if (!_db) return;

  const content = document.getElementById('leaderboard-content');
  content.innerHTML = '<div class="loading">加载中...</div>';

  try {
    let query;
    if (gameState.leaderboardGame === 'cards') {
      query = _db
        .from('game_scores')
        .select('*')
        .eq('game_type', 'cards')
        .eq('difficulty', gameState.leaderboardLevel)
        .order('score', { ascending: true })
        .order('time_seconds', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50);
    } else if (gameState.leaderboardGame === 'simon') {
      query = _db
        .from('game_scores')
        .select('*')
        .eq('game_type', 'simon')
        .order('score', { ascending: false })
        .order('time_seconds', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50);
    } else if (gameState.leaderboardGame === 'game2048') {
      query = _db
        .from('game_scores')
        .select('*')
        .eq('game_type', 'game2048')
        .order('score', { ascending: false })
        .order('time_seconds', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50);
    } else if (gameState.leaderboardGame === 'brick') {
      query = _db
        .from('game_scores')
        .select('*')
        .eq('game_type', 'brick')
        .order('score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
    }

    const { data, error } = await query;

    if (error) throw error;

    renderLeaderboard(data);
  } catch (err) {
    console.error('加载排行榜失败:', err);
    content.innerHTML = '<div class="error">加载失败，请稍后重试</div>';
  }
}

function renderLeaderboard(scores) {
  const content = document.getElementById('leaderboard-content');

  if (!scores || scores.length === 0) {
    content.innerHTML = '<div class="empty">暂无记录，快来挑战吧！</div>';
    return;
  }

  const difficultyLabels = { easy: '简单', medium: '中等', hard: '困难' };

  let html = '<div class="leaderboard-list">';
  scores.forEach((record, index) => {
    const rank = index + 1;
    const rankClass = rank <= 3 ? `rank-${rank}` : '';
    const name = record.player_name || '匿名玩家';
    const isMe = record.player_id === gameState.playerId;

    let scoreText = '';
    if (gameState.leaderboardGame === 'cards') {
      scoreText = `${record.score} 步 · ${formatTime(record.time_seconds)}`;
    } else if (gameState.leaderboardGame === 'simon') {
      scoreText = `第 ${record.score} 关`;
    } else if (gameState.leaderboardGame === 'game2048') {
      scoreText = `得分 ${record.score}`;
    } else if (gameState.leaderboardGame === 'brick') {
      scoreText = `得分 ${record.score}`;
    }

    html += `
      <div class="leaderboard-item ${rankClass} ${isMe ? 'highlight' : ''}">
        <div class="rank">${rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}</div>
        <div class="player-info">
          <div class="player-name">${name} ${isMe ? '(你)' : ''}</div>
          <div class="player-time">${new Date(record.created_at).toLocaleDateString()}</div>
        </div>
        <div class="player-score">${scoreText}</div>
      </div>
    `;
  });
  html += '</div>';

  content.innerHTML = html;
}

function switchLeaderboard(game, level) {
  gameState.leaderboardGame = game;
  gameState.leaderboardLevel = level;

  // 更新 Tab 样式
  document.querySelectorAll('.leaderboard-tab').forEach(tab => {
    const isActive = tab.dataset.game === game && tab.dataset.level === level;
    tab.classList.toggle('active', isActive);
  });

  loadLeaderboard();
}

async function submitScore(gameType, difficulty, score, timeSeconds) {
  if (!_db) {
    console.warn('Supabase 未配置，无法提交成绩到排行榜');
    return;
  }

  try {
    const { error } = await _db
      .from('game_scores')
      .insert({
        player_id: gameState.playerId,
        player_name: gameState.playerName || null,
        game_type: gameType,
        difficulty: difficulty || null,
        score: score,
        time_seconds: timeSeconds || null
      });

    if (error) throw error;

    console.log('✅ 成绩已提交到排行榜');
    // 如果当前显示的是相关排行榜，刷新它
    if (gameState.leaderboardGame === gameType &&
        (gameType === 'simon' || gameType === 'game2048' || gameType === 'brick' || gameState.leaderboardLevel === difficulty)) {
      loadLeaderboard();
    }
  } catch (err) {
    console.error('提交成绩失败:', err);
  }
}

function formatTime(seconds) {
  if (!seconds) return '--:--';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/* ===== 打赏区域 ===== */
function toggleTip() {
  var content = document.getElementById('tip-content');
  var arrow = document.getElementById('tip-arrow');
  content.classList.toggle('hidden');
  arrow.textContent = content.classList.contains('hidden') ? '▼' : '▲';
}

/* ===== 2048 游戏逻辑 ===== */
function initGame2048() {
  game2048.grid = [
    [0,0,0,0],
    [0,0,0,0],
    [0,0,0,0],
    [0,0,0,0]
  ];
  game2048.score = 0;
  game2048.gameOver = false;
  game2048.won = false;
  game2048.bestScore = localStorage.getItem(getScoreKey('game2048')) || 0;
  game2048.cells = null;   // 触发重新创建格子
  game2048.cellEls = {};
  game2048.mergedCells = {};
  game2048.justNewCells = {};
  game2048.prevGrid = null;

  document.getElementById('game2048-score').textContent = '0';
  document.getElementById('game2048-best').textContent = game2048.bestScore;

  // 先渲染空棋盘建立 prevGrid，再加格子再次渲染触发动画
  renderGame2048();
  addRandomTile();
  addRandomTile();
  renderGame2048();
}

function addRandomTile() {
  var empty = [];
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      if (game2048.grid[i][j] === 0) {
        empty.push({r: i, c: j});
      }
    }
  }
  if (empty.length === 0) return null;
  var pos = empty[Math.floor(Math.random() * empty.length)];
  game2048.grid[pos.r][pos.c] = Math.random() < 0.9 ? 2 : 4;
  // 标记新格子用于动画
  game2048.justNewCells = {};
  game2048.justNewCells[pos.r + '-' + pos.c] = true;
  return pos;
}

function renderGame2048() {
  var board = document.getElementById('game2048-board');
  var colors = {
    2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563',
    32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61',
    512: '#edc850', 1024: '#edc53f', 2048: '#edc22e'
  };

  // 如果是首次渲染，创建背景格子和所有格子
  if (!game2048.cells) {
    // 插入4x4背景格
    board.innerHTML = '';
    for (var bi = 0; bi < 16; bi++) {
      var bg = document.createElement('div');
      bg.className = 'game2048-bg-cell';
      board.appendChild(bg);
    }

    game2048.cells = [];
    game2048.cellEls = {};
    for (var i = 0; i < 4; i++) {
      game2048.cells[i] = [];
      for (var j = 0; j < 4; j++) {
        game2048.cells[i][j] = null;
        var key = i + '-' + j;
        var el = document.createElement('div');
        el.className = 'game2048-cell';
        el.style.display = 'none';
        board.appendChild(el);
        game2048.cellEls[key] = el;
      }
    }
    game2048.prevGrid = JSON.parse(JSON.stringify(game2048.grid));
    game2048.boardRect = null;
    update2048CellPositions();
    window.addEventListener('resize', function() { game2048.boardRect = null; });
  }

  update2048CellPositions();

  // 对比新旧格子，算出动画
  var prev = game2048.prevGrid || game2048.grid;
  var mergedPositions = {};
  var movedCells = {};

  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      var val = game2048.grid[i][j];
      var key = i + '-' + j;

      if (val === 0) {
        // 消失了
        if (game2048.cells[i][j]) {
          game2048.cells[i][j].el.style.display = 'none';
          game2048.cells[i][j] = null;
        }
      } else if (prev[i][j] === val && !game2048.mergedCells[key] && !game2048.justNewCells[key]) {
        // 值没变也没合并，正常显示
        updateCellStyle(game2048.cellEls[key], val, colors);
        game2048.cells[i][j] = { el: game2048.cellEls[key], val: val };
      } else {
        // 新值或刚合并
        var isMerge = !!game2048.mergedCells[key];
        var isNew = !game2048.cells[i][j] || game2048.cells[i][j].val !== val;
        updateCellStyle(game2048.cellEls[key], val, colors);
        game2048.cellEls[key].style.display = 'flex';
        game2048.cellEls[key].className = 'game2048-cell' + (isMerge ? ' merged' : (isNew ? ' new-cell' : ''));
        game2048.cells[i][j] = { el: game2048.cellEls[key], val: val };
        setTimeout(function(k) {
          return function() {
            var el2 = game2048.cellEls[k];
            if (el2) el2.classList.remove('merged', 'new-cell');
          };
        }(key), 200);
      }
    }
  }

  game2048.prevGrid = JSON.parse(JSON.stringify(game2048.grid));
  game2048.justMerged = {};
}

function update2048CellPositions() {
  var board = document.getElementById('game2048-board');
  if (!game2048.boardRect) {
    game2048.boardRect = board.getBoundingClientRect();
  }
  var rect = board.getBoundingClientRect();
  var gap = 12;
  var cellSize = (rect.width - gap * 5) / 4;

  // 隐藏所有格再显示有值的
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      var key = i + '-' + j;
      var el = game2048.cellEls[key];
      if (el) {
        el.style.width = cellSize + 'px';
        el.style.height = cellSize + 'px';
        el.style.left = (gap + j * (cellSize + gap)) + 'px';
        el.style.top = (gap + i * (cellSize + gap)) + 'px';
        el.style.fontSize = Math.max(cellSize * 0.35, 16) + 'px';
      }
    }
  }
}

function updateCellStyle(el, val, colors) {
  el.textContent = val;
  el.style.backgroundColor = colors[val] || '#3c3a32';
  el.style.color = val <= 4 ? '#776e65' : '#f9f6f2';
}

function moveGame2048(direction) {
  if (game2048.gameOver) return;

  var oldGrid = JSON.parse(JSON.stringify(game2048.grid));
  var moved = false;
  game2048.mergedCells = {}; // 记录合并位置 { 'i-j': true }

  if (direction === 'left') {
    for (var i = 0; i < 4; i++) {
      var before = JSON.stringify(game2048.grid[i]);
      var row = slideAndMerge(game2048.grid[i]);
      if (JSON.stringify(row) !== before) moved = true;
      game2048.grid[i] = row;
      // 找出合并了的位置（值变大的格）
      for (var j = 0; j < 4; j++) {
        if (row[j] > 0 && oldGrid[i][j] > 0 && row[j] > oldGrid[i][j]) {
          game2048.mergedCells[i + '-' + j] = true;
        }
      }
    }
  } else if (direction === 'right') {
    for (var i = 0; i < 4; i++) {
      var row = game2048.grid[i].slice().reverse();
      row = slideAndMerge(row);
      var finalRow = row.reverse();
      if (JSON.stringify(finalRow) !== JSON.stringify(game2048.grid[i])) moved = true;
      game2048.grid[i] = finalRow;
    }
  } else if (direction === 'up') {
    for (var j = 0; j < 4; j++) {
      var col = [game2048.grid[0][j], game2048.grid[1][j], game2048.grid[2][j], game2048.grid[3][j]];
      col = slideAndMerge(col);
      if (JSON.stringify(col) !== JSON.stringify([game2048.grid[0][j], game2048.grid[1][j], game2048.grid[2][j], game2048.grid[3][j]])) moved = true;
      for (var i = 0; i < 4; i++) game2048.grid[i][j] = col[i];
      for (var i2 = 0; i2 < 4; i2++) {
        if (col[i2] > 0 && oldGrid[i2][j] > 0 && col[i2] > oldGrid[i2][j]) {
          game2048.mergedCells[i2 + '-' + j] = true;
        }
      }
    }
  } else if (direction === 'down') {
    for (var j = 0; j < 4; j++) {
      var col = [game2048.grid[3][j], game2048.grid[2][j], game2048.grid[1][j], game2048.grid[0][j]];
      col = slideAndMerge(col);
      col.reverse();
      var finalCol = [col[3], col[2], col[1], col[0]];
      if (JSON.stringify(finalCol) !== JSON.stringify([game2048.grid[0][j], game2048.grid[1][j], game2048.grid[2][j], game2048.grid[3][j]])) moved = true;
      for (var i = 0; i < 4; i++) game2048.grid[i][j] = finalCol[i];
    }
  }

  if (moved) {
    addRandomTile();
    renderGame2048();
    document.getElementById('game2048-score').textContent = game2048.score;

    if (game2048.score > game2048.bestScore) {
      game2048.bestScore = game2048.score;
      localStorage.setItem(getScoreKey('game2048'), game2048.bestScore);
      document.getElementById('game2048-best').textContent = game2048.bestScore;
    }

    checkGameOver();
  }
}

function slideAndMerge(arr) {
  var result = arr.filter(function(v) { return v !== 0; });
  var scoreAdd = 0;
  for (var i = 0; i < result.length - 1; i++) {
    if (result[i] === result[i + 1]) {
      result[i] *= 2;
      scoreAdd += result[i];
      result.splice(i + 1, 1);
    }
  }
  game2048.score += scoreAdd;
  while (result.length < 4) result.push(0);
  return result;
}

function checkGameOver() {
  // 检查是否还有空格
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      if (game2048.grid[i][j] === 0) return;
    }
  }
  // 检查是否还能合并
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 3; j++) {
      if (game2048.grid[i][j] === game2048.grid[i][j + 1]) return;
    }
  }
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 4; j++) {
      if (game2048.grid[i][j] === game2048.grid[i + 1][j]) return;
    }
  }
  game2048.gameOver = true;
  showFailModal('游戏结束！最终得分：' + game2048.score);
  // 提交成绩
  submitScore('game2048', null, game2048.score, null);
}

function restartGame2048() {
  initGame2048();
}

// 键盘事件
document.addEventListener('keydown', function(e) {
  if (gameState.currentScreen !== 'screen-2048') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    var dir = e.key.replace('Arrow', '').toLowerCase();
    moveGame2048(dir);
  }
});

/* ===== 图片预览 ===== */
function previewImg(img) {
  var preview = document.getElementById('modal-img-preview');
  var previewImg = document.getElementById('img-preview-src');
  var label = document.getElementById('img-preview-label');

  previewImg.src = img.src;
  label.textContent = img.alt || '预览';
  preview.classList.remove('hidden');
}

function closeImgPreview(e) {
  if (e && e.target !== document.getElementById('modal-img-preview')) return;
  document.getElementById('modal-img-preview').classList.add('hidden');
}

/* ===== 打砖块游戏逻辑 ===== */
var brickGame = {
  canvas: null,
  ctx: null,
  paddle: { x: 0, y: 0, width: 100, height: 14, targetX: 0, trailX: 0 },
  ball: { x: 0, y: 0, dx: 4, dy: -4, radius: 8, trail: [] },
  balls: [],      // 支持多球
  bricks: [],
  score: 0,
  lives: 3,
  level: 1,
  running: false,
  animationId: null,
  brickColors: ['#e94560', '#f65e3b', '#ffd166', '#06d6a0', '#0074d9', '#533483'],
  // 掉落道具
  powerups: [],
  powerupTypes: [
    { id: 'wide',     emoji: '🔱', label: '挡板加宽', color: '#0074d9', weight: 6 },
    { id: 'life',     emoji: '❤️', label: '加命',     color: '#e94560', weight: 3 },
    { id: 'multi',    emoji: '⚡', label: '三球',     color: '#ffd166', weight: 4 },
    { id: 'slow',     emoji: '🐢', label: '减速',     color: '#06d6a0', weight: 5 },
    { id: 'laser',    emoji: '🔱', label: '穿透',     color: '#533483', weight: 3 }
  ],
  // Buff状态
  buffs: {
    wide:    { active: false, timer: null, endTime: 0, origWidth: 100 },
    multi:   { active: false, timer: null, endTime: 0 },
    slow:    { active: false, timer: null, endTime: 0, origSpeed: 4 },
    laser:   { active: false, timer: null, endTime: 0 }
  }
};

function initBrickGame() {
  brickGame.canvas = document.getElementById('brick-canvas');
  brickGame.ctx = brickGame.canvas.getContext('2d');

  // 重置游戏状态
  brickGame.score = 0;
  brickGame.lives = 3;
  brickGame.level = 1;
  brickGame.running = false;

  // 清空道具和Buff
  brickGame.powerups = [];
  clearAllBuffs();

  // 设置挡板位置
  brickGame.paddle.width = 100;
  brickGame.paddle.x = (brickGame.canvas.width - brickGame.paddle.width) / 2;
  brickGame.paddle.y = brickGame.canvas.height - 30;
  brickGame.paddle.targetX = brickGame.paddle.x;
  brickGame.paddle.trailX = brickGame.paddle.x;

  // 初始化小球列表
  brickGame.balls = [];
  brickGame.ball = { x: 0, y: 0, dx: 4, dy: -4, radius: 8, trail: [] };
  addBall();

  // 创建砖块
  createBricks();

  // 更新显示
  updateBrickDisplay();

  // 绑定事件
  brickGame.canvas.onmousemove = brickMouseMove;
  brickGame.canvas.ontouchmove = brickTouchMove;
  brickGame.canvas.onclick = brickStartGame;

  // 停止之前的动画
  if (brickGame.animationId) {
    cancelAnimationFrame(brickGame.animationId);
  }

  // 渲染初始画面
  renderBrick();
}

function addBall() {
  var b = {
    x: brickGame.canvas.width / 2,
    y: brickGame.canvas.height - 50,
    dx: 4 * (Math.random() > 0.5 ? 1 : -1),
    dy: -4,
    radius: 8,
    trail: []
  };
  brickGame.balls.push(b);
  brickGame.ball = b; // 主球引用
  return b;
}

function resetBall() {
  brickGame.ball.trail = []; // 清空尾迹
  brickGame.ball.x = brickGame.canvas.width / 2;
  brickGame.ball.y = brickGame.canvas.height - 50;
  brickGame.ball.dx = 4 * (Math.random() > 0.5 ? 1 : -1);
  brickGame.ball.dy = -4;
  brickGame.running = false;
}

function clearAllBuffs() {
  var buffs = brickGame.buffs;
  ['wide', 'multi', 'slow', 'laser'].forEach(function(k) {
    if (buffs[k].timer) clearTimeout(buffs[k].timer);
    buffs[k].active = false;
    buffs[k].timer = null;
  });
  // 恢复挡板宽度
  if (brickGame.paddle) {
    brickGame.paddle.width = buffs.wide ? buffs.wide.origWidth : 100;
  }
}

function activateBuff(type, duration) {
  var buffs = brickGame.buffs;
  var p = brickGame.paddle;
  if (buffs[type].timer) clearTimeout(buffs[type].timer);

  if (type === 'wide') {
    buffs.wide.origWidth = buffs.wide.origWidth || p.width;
    p.width = Math.min(p.width * 1.5, brickGame.canvas.width * 0.8);
    buffs.wide.active = true;
    buffs.wide.endTime = Date.now() + duration;
    buffs.wide.timer = setTimeout(function() {
      p.width = buffs.wide.origWidth;
      buffs.wide.active = false;
    }, duration);

  } else if (type === 'multi') {
    if (!buffs.multi.active) {
      // 加两个额外球
      var mainBall = brickGame.balls[0];
      for (var i = 0; i < 2; i++) {
        var nb = {
          x: mainBall.x,
          y: mainBall.y,
          dx: (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 2),
          dy: -Math.abs(mainBall.dy),
          radius: 8,
          trail: []
        };
        brickGame.balls.push(nb);
      }
    }
    buffs.multi.active = true;
    buffs.multi.endTime = Date.now() + duration;
    buffs.multi.timer = setTimeout(function() {
      // 移除多余球，只保留第一个
      brickGame.balls = [brickGame.balls[0]];
      buffs.multi.active = false;
    }, duration);

  } else if (type === 'slow') {
    buffs.slow.origSpeed = buffs.slow.origSpeed || 4;
    buffs.slow.active = true;
    buffs.slow.endTime = Date.now() + duration;
    // 降低所有球速
    brickGame.balls.forEach(function(b) {
      b.dx *= 0.5;
      b.dy *= 0.5;
    });
    buffs.slow.timer = setTimeout(function() {
      brickGame.balls.forEach(function(b) {
        b.dx *= 2;
        b.dy *= 2;
      });
      buffs.slow.active = false;
    }, duration);

  } else if (type === 'laser') {
    buffs.laser.active = true;
    buffs.laser.endTime = Date.now() + duration;
    buffs.laser.timer = setTimeout(function() {
      buffs.laser.active = false;
    }, duration);
  }
}

function spawnPowerup(brick) {
  // 35% 概率掉落道具
  if (Math.random() > 0.35) return;

  var totalWeight = brickGame.powerupTypes.reduce(function(s, t) { return s + t.weight; }, 0);
  var r = Math.random() * totalWeight;
  var selected = brickGame.powerupTypes[0];
  var cum = 0;
  for (var i = 0; i < brickGame.powerupTypes.length; i++) {
    cum += brickGame.powerupTypes[i].weight;
    if (r < cum) { selected = brickGame.powerupTypes[i]; break; }
  }

  brickGame.powerups.push({
    x: brick.x + brick.width / 2,
    y: brick.y + brick.height / 2,
    radius: 14,
    type: selected.id,
    emoji: selected.emoji,
    color: selected.color,
    vy: 1.5,          // 下落速度
    wobble: Math.random() * Math.PI * 2, // 晃动相位
    age: 0
  });
}

function updatePowerups() {
  var now = Date.now();
  brickGame.powerups = brickGame.powerups.filter(function(pu) {
    pu.y += pu.vy;
    pu.wobble += 0.08;
    pu.age++;

    var p = brickGame.paddle;
    // 检测挡板碰撞
    if (pu.y + pu.radius > p.y && pu.y - pu.radius < p.y + p.height &&
        pu.x > p.x && pu.x < p.x + p.width) {
      // 捡到道具
      triggerPowerup(pu);
      return false;
    }
    // 掉落出界
    return pu.y < brickGame.canvas.height + 30;
  });
}

function triggerPowerup(pu) {
  var p = brickGame.paddle;
  if (pu.type === 'wide') {
    activateBuff('wide', 10000);
    flashText('🔱 挡板加宽！');
  } else if (pu.type === 'life') {
    brickGame.lives++;
    updateBrickDisplay();
    flashText('❤️ +1生命！');
  } else if (pu.type === 'multi') {
    activateBuff('multi', 10000);
    flashText('⚡ 三球模式！');
  } else if (pu.type === 'slow') {
    activateBuff('slow', 8000);
    flashText('🐢 球速减慢！');
  } else if (pu.type === 'laser') {
    activateBuff('laser', 8000);
    flashText('🔱 穿透模式！');
  }
}

function flashText(msg) {
  // 画布顶部飘字
  brickGame.flashMsg = msg;
  brickGame.flashMsgTimer = Date.now();
}

function createBricks() {
  brickGame.bricks = [];
  var rows = 4 + Math.floor(brickGame.level / 2);
  var cols = 8;
  var brickWidth = 65;
  var brickHeight = 20;
  var padding = 8;
  var offsetTop = 40;
  var offsetLeft = (brickGame.canvas.width - (cols * (brickWidth + padding) - padding)) / 2;

  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      brickGame.bricks.push({
        x: offsetLeft + c * (brickWidth + padding),
        y: offsetTop + r * (brickHeight + padding),
        width: brickWidth,
        height: brickHeight,
        alive: true,
        color: brickGame.brickColors[r % brickGame.brickColors.length]
      });
    }
  }
}

function brickMouseMove(e) {
  var rect = brickGame.canvas.getBoundingClientRect();
  var scaleX = brickGame.canvas.width / rect.width;
  var mouseX = (e.clientX - rect.left) * scaleX;
  var targetX = mouseX - brickGame.paddle.width / 2;
  if (targetX < 0) targetX = 0;
  if (targetX + brickGame.paddle.width > brickGame.canvas.width) {
    targetX = brickGame.canvas.width - brickGame.paddle.width;
  }
  brickGame.paddle.targetX = targetX;
}

function brickTouchMove(e) {
  e.preventDefault();
  var rect = brickGame.canvas.getBoundingClientRect();
  var scaleX = brickGame.canvas.width / rect.width;
  var touchX = (e.touches[0].clientX - rect.left) * scaleX;
  var targetX = touchX - brickGame.paddle.width / 2;
  if (targetX < 0) targetX = 0;
  if (targetX + brickGame.paddle.width > brickGame.canvas.width) {
    targetX = brickGame.canvas.width - brickGame.paddle.width;
  }
  brickGame.paddle.targetX = targetX;
}

function brickStartGame() {
  if (!brickGame.running) {
    brickGame.running = true;
    playBrickGame();
  }
}

function playBrickGame() {
  if (!brickGame.running) return;

  renderBrick();

  // --- 挡板惯性滑动（LERP） ---
  var lerpFactor = 0.18;
  brickGame.paddle.trailX = brickGame.paddle.x;
  brickGame.paddle.x += (brickGame.paddle.targetX - brickGame.paddle.x) * lerpFactor;
  if (brickGame.paddle.x < 0) brickGame.paddle.x = 0;
  if (brickGame.paddle.x + brickGame.paddle.width > brickGame.canvas.width) {
    brickGame.paddle.x = brickGame.canvas.width - brickGame.paddle.width;
  }

  // --- 更新所有球 ---
  var lostBalls = 0;
  brickGame.balls.forEach(function(ball) {
    // 尾迹
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 12) ball.trail.shift();

    // 移动
    ball.x += ball.dx;
    ball.y += ball.dy;

    // 墙壁碰撞（若不是穿透模式）
    if (!brickGame.buffs.laser.active) {
      if (ball.x + ball.radius > brickGame.canvas.width || ball.x - ball.radius < 0) {
        ball.dx = -ball.dx;
        ball.x = Math.max(ball.radius, Math.min(brickGame.canvas.width - ball.radius, ball.x));
      }
      if (ball.y - ball.radius < 0) {
        ball.dy = -ball.dy;
        ball.y = ball.radius;
      }
    } else {
      // 穿透模式：左右出界从另一边出来
      if (ball.x < 0) ball.x = brickGame.canvas.width;
      if (ball.x > brickGame.canvas.width) ball.x = 0;
    }

    // 挡板碰撞
    var p = brickGame.paddle;
    if (ball.y + ball.radius > p.y && ball.y - ball.radius < p.y + p.height &&
        ball.x > p.x && ball.x < p.x + p.width && ball.dy > 0) {
      ball.dy = -Math.abs(ball.dy);
      var hitPos = (ball.x - p.x) / p.width;
      ball.dx = (hitPos - 0.5) * 8;
      // 确保最小速度
      var speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
      if (speed < 3) {
        ball.dx *= 3 / speed;
        ball.dy *= 3 / speed;
      }
    }

    // 砖块碰撞
    for (var bi = 0; bi < brickGame.bricks.length; bi++) {
      var brick = brickGame.bricks[bi];
      if (!brick.alive) continue;

      if (ball.x + ball.radius > brick.x &&
          ball.x - ball.radius < brick.x + brick.width &&
          ball.y + ball.radius > brick.y &&
          ball.y - ball.radius < brick.y + brick.height) {
        brick.alive = false;
        if (!brickGame.buffs.laser.active) {
          ball.dy = -ball.dy;
        }
        brickGame.score += 10;
        updateBrickDisplay();
        spawnPowerup(brick);
      }
    }

    // 球落底
    if (ball.y + ball.radius > brickGame.canvas.height) {
      lostBalls++;
    }
  });

  // 处理丢球
  if (lostBalls >= brickGame.balls.length) {
    brickGame.lives--;
    updateBrickDisplay();
    if (brickGame.lives <= 0) {
      brickGame.running = false;
      brickGameOver();
      return;
    } else {
      // 移除所有球，重置主球
      brickGame.balls = [];
      addBall();
      resetBall();
      setTimeout(function() { brickGame.running = true; }, 500);
    }
  }

  // 检查是否通关
  if (brickGame.bricks.every(function(b) { return !b.alive; })) {
    brickNextLevel();
    return;
  }

  // 更新掉落道具
  updatePowerups();

  brickGame.animationId = requestAnimationFrame(playBrickGame);
}

function renderBrick() {
  var ctx = brickGame.ctx;
  var canvas = brickGame.canvas;

  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制砖块（带发光底色）
  brickGame.bricks.forEach(function(brick) {
    if (!brick.alive) return;

    // 砖块阴影/光晕
    ctx.shadowColor = brick.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 4);
    ctx.fillStyle = brick.color;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 砖块高光
    var glossGrad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
    glossGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
    glossGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    glossGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 4);
    ctx.fillStyle = glossGrad;
    ctx.fill();
  });

  // --- 挡板滑动残影 ---
  var p = brickGame.paddle;
  var slideDelta = p.x - p.trailX; // 滑动方向和距离
  var slideIntensity = Math.min(Math.abs(slideDelta) / 30, 1); // 0~1 滑动强度

  if (slideIntensity > 0.05) {
    var trailAlpha = slideIntensity * 0.25;
    ctx.beginPath();
    ctx.roundRect(p.x - slideDelta * 1.5, p.y, p.width, p.height, 7);
    ctx.fillStyle = 'rgba(83,52,131,' + trailAlpha + ')';
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(p.x - slideDelta * 3, p.y, p.width, p.height, 7);
    ctx.fillStyle = 'rgba(83,52,131,' + (trailAlpha * 0.4) + ')';
    ctx.fill();
  }

  // 挡板主体（带发光）
  ctx.shadowColor = '#e94560';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.width, p.height, 7);
  var paddleGradient = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
  paddleGradient.addColorStop(0, '#e94560');
  paddleGradient.addColorStop(1, '#533483');
  ctx.fillStyle = paddleGradient;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 挡板顶部高光
  ctx.beginPath();
  ctx.roundRect(p.x + 4, p.y + 2, p.width - 8, 4, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();

  // --- 渲染所有球 ---
  brickGame.balls.forEach(function(ball) {
    // 尾迹光点
    ball.trail.forEach(function(pos, i) {
      var alpha = (i / ball.trail.length) * 0.5;
      var r = ball.radius * (0.3 + (i / ball.trail.length) * 0.7);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,209,102,' + alpha + ')';
      ctx.fill();
    });

    // 球主体
    var ballColor = brickGame.buffs.laser.active ? '#e94560' : '#ffd166';
    ctx.shadowColor = ballColor;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    var ballGrad = ctx.createRadialGradient(
      ball.x - 2, ball.y - 2, 0,
      ball.x, ball.y, ball.radius
    );
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(1, ballColor);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 球高光
    ctx.beginPath();
    ctx.arc(ball.x - 3, ball.y - 3, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
  });

  // --- 渲染掉落道具 ---
  brickGame.powerups.forEach(function(pu) {
    var wobbleX = Math.sin(pu.wobble) * 4;
    ctx.shadowColor = pu.color;
    ctx.shadowBlur = 15;

    // 道具圆形背景
    ctx.beginPath();
    ctx.arc(pu.x + wobbleX, pu.y, pu.radius, 0, Math.PI * 2);
    ctx.fillStyle = pu.color + 'cc';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 道具 emoji
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.emoji, pu.x + wobbleX, pu.y + 1);
  });

  // --- Buff 指示器（画布左上角） ---
  var buffs = brickGame.buffs;
  var now = Date.now();
  var ix = 10, iy = 8;
  var activeBuffs = [];
  if (buffs.wide.active) activeBuffs.push({ label: '🔱宽', end: buffs.wide.endTime });
  if (buffs.multi.active) activeBuffs.push({ label: '⚡三球', end: buffs.multi.endTime });
  if (buffs.slow.active)  activeBuffs.push({ label: '🐢慢', end: buffs.slow.endTime });
  if (buffs.laser.active) activeBuffs.push({ label: '🔱穿', end: buffs.laser.endTime });

  activeBuffs.forEach(function(b, i) {
    var remaining = Math.max(0, Math.ceil((b.end - now) / 1000));
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(ix - 2, iy + i * 22 - 2, 60, 18);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(b.label + ' ' + remaining + 's', ix, iy + i * 22 + 12);
  });

  // --- 飘字特效 ---
  if (brickGame.flashMsg && now - brickGame.flashMsgTimer < 1500) {
    var age = now - brickGame.flashMsgTimer;
    var alpha = Math.max(0, 1 - age / 1500);
    var yOff = -age * 0.03;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 10;
    ctx.fillText(brickGame.flashMsg, canvas.width / 2, canvas.height / 2 + yOff);
    ctx.shadowBlur = 0;
  }

  // 如果没开始，显示提示
  if (!brickGame.running) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('点击开始游戏', canvas.width / 2, canvas.height / 2);
  }
}

function updateBrickDisplay() {
  document.getElementById('brick-score').textContent = brickGame.score;
  document.getElementById('brick-level').textContent = brickGame.level;
  document.getElementById('brick-lives').textContent = '❤️'.repeat(Math.max(0, brickGame.lives));
}

function brickNextLevel() {
  brickGame.level++;
  brickGame.running = false;

  // 清空 Buff 和道具
  clearAllBuffs();
  brickGame.powerups = [];

  // 增加挡板宽度
  brickGame.paddle.width = Math.max(60, 100 - brickGame.level * 5);
  brickGame.paddle.targetX = (brickGame.canvas.width - brickGame.paddle.width) / 2;

  // 重置球列表
  brickGame.balls = [];
  addBall();
  resetBall();

  createBricks();
  updateBrickDisplay();
  renderBrick();

  // 保存最高分
  var bestKey = getScoreKey('brick');
  var best = parseInt(localStorage.getItem(bestKey)) || 0;
  if (brickGame.score > best) {
    localStorage.setItem(bestKey, brickGame.score);
    submitScore('brick', null, brickGame.score, null);
  }

  setTimeout(function() {
    alert('🎉 第 ' + brickGame.level + ' 关通过！准备下一关...');
    brickGame.running = true;
    playBrickGame();
  }, 300);
}

function brickGameOver() {
  clearAllBuffs();
  brickGame.powerups = [];
  var bestKey = getScoreKey('brick');
  var best = parseInt(localStorage.getItem(bestKey)) || 0;
  if (brickGame.score > best) {
    localStorage.setItem(bestKey, brickGame.score);
  }
  submitScore('brick', null, brickGame.score, null);
  showFailModal('游戏结束！最终得分：' + brickGame.score + '\n到达关卡：第 ' + brickGame.level + ' 关');
}

function restartBrick() {
  if (brickGame.animationId) {
    cancelAnimationFrame(brickGame.animationId);
  }
  initBrickGame();
}
