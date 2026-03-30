# Supabase 排行榜配置指南

## 已完成的工作

✅ 前端代码已更新，支持排行榜功能
✅ 数据库表结构 SQL 脚本已准备好：`supabase-schema.sql`

## 剩余步骤（需要你的 anon key）

### 1. 获取 Supabase anon key

在 Supabase 控制台：
- 进入 **Settings** → **API**
- 复制 `anon public` 或 `public` 下的 key（以 `eyJ...` 开头）

### 2. 替换 key

编辑 `game.js` 文件第 3 行：
```javascript
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE'; // TODO: 替换为你的 anon key
```

把 `YOUR_ANON_KEY_HERE` 换成你的真实 key。

### 3. 导入数据库表结构

在 Supabase 控制台：
- 进入 **SQL Editor**
- 点击 **New Query**
- 复制 `supabase-schema.sql` 文件的内容
- 粘贴到 SQL 编辑器
- 点击 **Run** 执行

### 4. 测试

修改完成后：
1. 刷新浏览器页面
2. 玩一局游戏
3. 回到首页查看排行榜

---

## 功能说明

| 功能 | 描述 |
|------|------|
| **昵称** | 可选输入，显示在排行榜 |
| **自动提交** | 每次游戏完成自动提交成绩 |
| **排行榜** | 4 个标签：翻牌(简单/中等/困难) + 序列记忆 |
| **玩家标识** | 你的记录会高亮显示 |
| **实时更新** | 每次提交后自动刷新排行榜 |

---

## 数据结构

`game_scores` 表字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `player_id` | TEXT | 玩家唯一 ID |
| `player_name` | TEXT | 玩家昵称（可选） |
| `game_type` | TEXT | 'cards' 或 'simon' |
| `difficulty` | TEXT | 'easy', 'medium', 'hard'（仅 cards） |
| `score` | INTEGER | 步数/关卡数 |
| `time_seconds` | INTEGER | 用时（秒） |
| `created_at` | TIMESTAMP | 创建时间 |

---

## 问题排查

| 问题 | 解决方案 |
|------|----------|
| 排行榜显示"配置 Supabase" | 检查 game.js 中的 SUPABASE_ANON_KEY 是否已替换 |
| 加载失败 | 检查 SQL 是否正确执行，表是否存在 |
| 成绩没有提交 | 打开浏览器控制台查看错误信息 |
