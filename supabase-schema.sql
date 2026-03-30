-- 记忆力游戏排行榜数据库表

-- 1. 创建游戏记录表
CREATE TABLE IF NOT EXISTS game_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id TEXT NOT NULL,
  player_name TEXT,           -- 可选：玩家昵称
  game_type TEXT NOT NULL,    -- 'cards' 或 'simon'
  difficulty TEXT,            -- 'easy', 'medium', 'hard'（仅 cards）
  score INTEGER NOT NULL,     -- 成绩：步数（越小越好）或 关卡数（越大越好）
  time_seconds INTEGER,       -- 用时（秒）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建索引加速查询
CREATE INDEX idx_game_scores_game_type ON game_scores(game_type);
CREATE INDEX idx_game_scores_difficulty ON game_scores(difficulty);
CREATE INDEX idx_game_scores_score ON game_scores(score);
CREATE INDEX idx_game_scores_created_at ON game_scores(created_at);

-- 3. RLS（行级安全）策略
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取排行榜
CREATE POLICY "允许公开读取排行榜" ON game_scores
  FOR SELECT USING (true);

-- 允许所有人插入成绩
CREATE POLICY "允许插入成绩" ON game_scores
  FOR INSERT WITH CHECK (true);

-- 4. 创建查询最佳成绩的视图（排行榜）
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  ROW_NUMBER() OVER (PARTITION BY game_type, COALESCE(difficulty, 'default')
                    ORDER BY score ASC, time_seconds ASC, created_at ASC) as rank,
  player_id,
  player_name,
  game_type,
  difficulty,
  score,
  time_seconds,
  created_at
FROM game_scores
WHERE game_type = 'cards'
  AND score > 0;

CREATE OR REPLACE VIEW leaderboard_simon AS
SELECT
  ROW_NUMBER() OVER (ORDER BY score DESC, time_seconds ASC, created_at ASC) as rank,
  player_id,
  player_name,
  score,
  time_seconds,
  created_at
FROM game_scores
WHERE game_type = 'simon'
  AND score > 0;

-- 5. 清理旧数据（可选：删除超过 30 天的记录）
-- CREATE OR REPLACE FUNCTION cleanup_old_scores()
-- RETURNS void AS $$
-- BEGIN
--   DELETE FROM game_scores WHERE created_at < NOW() - INTERVAL '30 days';
-- END;
-- $$ LANGUAGE plpgsql;
