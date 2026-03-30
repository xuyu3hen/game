/* ===== Supabase 配置 ===== */
const SUPABASE_URL = 'https://khkipsfovatbqoacitcb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtoa2lwc2ZvdmF0YnFvYWNpdGNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTY5MzksImV4cCI6MjA5MDM5MjkzOX0.KeBXedxf28oNg5jwaS5IQ4h3ErjrnDHLRKTA6RorAkc';

// 初始化 Supabase
let supabase = null;
try {
  if (typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn('Supabase SDK 未加载，排行榜功能不可用');
}

/* ===== 辅助函数：玩家 ID ===== */
function getPlayerId() {
  let id = localStorage.getItem('player-id');
  if (!id) {
    id = 'player_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('player-id', id);
  }
  return id;
}

/* ===== 全局状态 ===== */
let gameState = {
  currentScreen: 'home',
  playerId: getPlayerId(),
  playerName: localStorage.getItem('player-name') || '',
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
  lockBoard: false
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

function saveNickname() {
  const name = document.getElementById('player-nickname').value.trim();
  gameState.playerName = name;
  if (name) {
    localStorage.setItem('player-name', name);
  } else {
    localStorage.removeItem('player-name');
  }
}

function getScoreKey(game, level = null) {
  if (level) {
    return `${gameState.playerId}-${game}-${level}`;
  }
  return `${gameState.playerId}-${game}`;
}

function loadScores() {
  gameState.scores = {
    cardsEasy: localStorage.getItem(getScoreKey('cards', 'easy')) || '--',
    cardsMedium: localStorage.getItem(getScoreKey('cards', 'medium')) || '--',
    cardsHard: localStorage.getItem(getScoreKey('cards', 'hard')) || '--',
    simon: localStorage.getItem(getScoreKey('simon')) || 1
  };
}

/* ===== 初始化 ===== */
window.addEventListener('DOMContentLoaded', () => {
  loadScores();
  updateScoresDisplay();

  // 显示玩家 ID（截取后8位方便展示）
  const shortId = gameState.playerId.substring(gameState.playerId.length - 8);
  document.getElementById('player-id-display').textContent = '...' + shortId;

  // 恢复昵称
  if (gameState.playerName) {
    document.getElementById('player-nickname').value = gameState.playerName;
  }

  // 加载排行榜
  if (supabase) {
    loadLeaderboard();
  } else {
    document.getElementById('leaderboard-content').innerHTML = '<div class="error">排行榜功能需要配置 Supabase</div>';
  }

  console.log('🎮 Player ID:', gameState.playerId);
});

/* ===== 屏幕导航 ===== */
function showScreen(screenId) {
  console.log('showScreen 被调用，目标:', screenId);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    gameState.currentScreen = screenId;
    console.log('界面切换成功:', screenId);
  } else {
    console.error('找不到目标界面:', screenId);
  }
}

function goHome() {
  stopCardsGame();
  stopSimonGame();
  showScreen('screen-home');
  updateScoresDisplay();
}

function startGame(mode) {
  console.log('startGame 被调用，模式:', mode);
  if (mode === 'cards') {
    console.log('初始化翻牌游戏');
    initCardsGame('easy');
    console.log('显示翻牌界面');
    showScreen('screen-cards');
  } else if (mode === 'simon') {
    console.log('初始化 Simon 游戏');
    initSimonGame();
    console.log('显示 Simon 界面');
    showScreen('screen-simon');
  }
}

/* ===== 翻牌游戏逻辑 ===== */
function initCardsGame(level) {
  cardsGame.level = level;
  cardsGame.board = [];
  cardsGame.flipped = [];
  cardsGame.matched = new Set();
  cardsGame.moves = 0;
  cardsGame.lockBoard = false;
  clearInterval(cardsGame.timerInterval);
  cardsGame.startTime = Date.now();

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
    card.className = 'card-item';
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

  startCardsTimer();
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
  }
}

/* ===== 成绩显示 ===== */
function updateScoresDisplay() {
  document.getElementById('best-cards-easy').textContent = localStorage.getItem(getScoreKey('cards', 'easy')) || '--';
  document.getElementById('best-cards-medium').textContent = localStorage.getItem(getScoreKey('cards', 'medium')) || '--';
  document.getElementById('best-cards-hard').textContent = localStorage.getItem(getScoreKey('cards', 'hard')) || '--';
  document.getElementById('best-simon').textContent = localStorage.getItem(getScoreKey('simon')) || 1;
}

/* ===== 排行榜功能 ===== */
async function loadLeaderboard() {
  if (!supabase) return;

  const content = document.getElementById('leaderboard-content');
  content.innerHTML = '<div class="loading">加载中...</div>';

  try {
    let query;
    if (gameState.leaderboardGame === 'cards') {
      query = supabase
        .from('game_scores')
        .select('*')
        .eq('game_type', 'cards')
        .eq('difficulty', gameState.leaderboardLevel)
        .order('score', { ascending: true })
        .order('time_seconds', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50);
    } else {
      query = supabase
        .from('game_scores')
        .select('*')
        .eq('game_type', 'simon')
        .order('score', { ascending: false })
        .order('time_seconds', { ascending: true })
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
    } else {
      scoreText = `第 ${record.score} 关`;
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
  if (!supabase) {
    console.warn('Supabase 未配置，无法提交成绩到排行榜');
    return;
  }

  try {
    const { error } = await supabase
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
        (gameType === 'simon' || gameState.leaderboardLevel === difficulty)) {
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
