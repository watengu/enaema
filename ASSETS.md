# ASSETS.md

キャラクター画像・タスク・シチュエーション・ソーシャル関連の
データ設計。拡張（シチュエーション追加・タスク追加・キャラ追加）を
前提とした構成。

## ファイル命名規則

```
[キャラID]_[situation_id]_[連番].png

例:
neko_home_main.png        ← ホーム画面メイン画像（1枚）

neko_morning_01〜05.png   ← 白湯/洗顔/化粧水/乳液/下地・メイク
neko_noon_01〜05.png
neko_night_01〜05.png
neko_beforesleep_01〜05.png

計21枚（ホームメイン1枚＋各シチュエーション5枚×4）
```

※ MVPではPNG（透過）を採用。将来的な軽量化のため、WebPへの
一括変換を予定している。拡張子以外の命名規則は変更しないため、
移行時は `image_path` の拡張子部分のみ一括置換すればよい設計とする。

※ situation_idは固定4種に限定しない（デート前=`date`、休日=`holiday`等を将来追加）

## Supabase Storage構成

```
characters/
  [character_id]/
    source/      ← SeaArt原本（高解像度、非公開）
    reactions/   ← アプリ内使用の軽量版（webp）
```

## DBスキーマ

### situations（シチュエーションマスタ）
```sql
situation_id      -- morning / noon / night / beforesleep / date / holiday...
name              -- 朝 / 昼 / 晩 / 寝る前 / デート前 / 休日
display_order
is_default        -- 基本4つかどうか
access_tier       -- no_login / free / paid
```

### tasks（タスクマスタ）
```sql
task_id
situation_id       -- situationsへの外部キー
order_index        -- 1〜5（ノーログインはorder_index<=3のみ表示）
task_name          -- 白湯、洗顔など
image_path         -- 対応するキャラ画像パス（1タスク1画像）
dialogue           -- Geminiで作成したセリフ
dialogue_variation -- 同一シーンで複数セリフある場合の番号
```

### characters（キャラマスタ）
```sql
character_id      -- neko など
name
tier              -- free / paid
home_main_image_path
```

### users（アカウント情報）
```sql
user_id
tier                    -- no_login / free / paid
personal_color
body_type
face_type
selected_character
display_name            -- ニックネーム/キャラ名のみ。本名・メール等は含まない
terms_agreed_version    -- 同意した利用規約のバージョン
terms_agreed_at
privacy_agreed_version  -- 同意したプライバシーポリシーのバージョン
privacy_agreed_at
```

### user_progress（継続・実績ステータス）
```sql
user_id
login_streak_total     -- 累計ログイン日数
task_streak_total      -- 累計タスク達成日数
unlocked_scenes         -- 達成で解放された場面（JSON）
last_active_at
```

### user_events（行動ログ・分析用）
```sql
user_id
event_type        -- task_complete / task_retry / character_interaction / idle_reaction
created_at
```

### timeline_posts（タイムライン投稿）
```sql
post_id
user_id
content            -- タスクセット/やり直し内容
is_public          -- true: 公開 / false: 非公開（デフォルトtrue）
created_at
```

### blocks（ブロック機能）
```sql
blocker_id         -- ブロックした側のuser_id
blocked_id         -- ブロックされた側のuser_id
created_at
```

### legal_documents（法務文書マスタ）
```sql
doc_id
doc_type           -- terms / privacy / tokushoho / community
version
content            -- 本文（Markdown）
published_at
```

## RLSポリシー（概要）

```sql
-- マスタ系：全員読み取り可
CREATE POLICY "situations_select_all" ON situations FOR SELECT USING (true);
CREATE POLICY "tasks_select_all" ON tasks FOR SELECT USING (true);
CREATE POLICY "characters_select_all" ON characters FOR SELECT USING (true);
CREATE POLICY "legal_documents_select_all" ON legal_documents FOR SELECT USING (true);

-- 個人データ系：本人のみ
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_progress_select_own" ON user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_progress_update_own" ON user_progress FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_events_insert_own" ON user_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_events_select_own" ON user_events FOR SELECT USING (auth.uid() = user_id);

-- ソーシャル系：投稿は本人のみ作成、閲覧は公開＆直近3時間＆非ブロックのみ
CREATE POLICY "timeline_insert_own" ON timeline_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "timeline_select_public_recent" ON timeline_posts FOR SELECT
USING (
  is_public = true
  AND created_at > now() - interval '3 hours'
  AND user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid())
  AND auth.uid() NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = user_id)
);

-- blocks：本人のみ操作可
CREATE POLICY "blocks_insert_own" ON blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks_select_own" ON blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocks_delete_own" ON blocks FOR DELETE USING (auth.uid() = blocker_id);
```

透過コメント（1時間削除）は上記timeline方式と同様の設計を別テーブル
（例: `live_comments`）で持つか、`timeline_posts`と共通化するかは
実装時に決定する。

### 自動削除の実装方針（表示制御と物理削除の分離）
- MVPでは上記RLSの `created_at` 条件による**表示制御のみ**で自動削除を
  成立させる。これで「3時間/1時間経過後は見えなくなる」というユーザー
  体験は満たされる
- pg_cronやEdge Functionによる**物理削除**（DBからの実削除）は、
  ストレージ肥大化対策であり、MVPでは実装不要。運用が安定してから
  導入を検討する

### 同時間帯ユーザー枯渇時のフォールバック（初期グロース対策）
初期はアクティブユーザーが少なく、「同じ時間帯にセットしたユーザー」
だけでは表示件数が0件になりうる。以下の段階でフォールバックする。

1. 前後1時間以内 → 前後2時間以内に対象を拡大（README.md記載の仕様）
2. それでも枯渇する場合、直近で活動した**別時間帯**のユーザー投稿を
   不透明度を下げる、または「別の時間帯の投稿」と分かる控えめな表示で
   混ぜる（完全な空白画面を避ける）
3. フォールバックで表示した投稿は、同時間帯の投稿と視覚的に区別できる
   ようにし、ユーザーに「盛り上がっている時間帯」の誤認をさせない

## キャラクタービジュアル基準（neko）
- スタイル：チビ（デフォルメ）
- 髪色：白〜銀
- 目の色：ピンク系・黄系など、表情で切り替え可
- 衣装：白地に赤の巫女装束アレンジ、赤いリボン・帯
- 共通アクセサリー：猫耳・尻尾
- 露出は控えめに統一（高露出・きわどいアングルは不採用）
- 座り込み・まったりポーズは安全な構図を基準とする

### SeaArt生成プロンプト（確定版）

```
共通ベース（表情指定なし）:
masterpiece, best quality, ultra-detailed, 1girl, solo, (chibi:1.4),
2 heads tall, full body, silver long hair, human face, human eyes,
(white cat ears:1.1), (long fluffy white cat tail:1.1),
wearing cute miko attire (shrine maiden), looking at viewer,
pure white background, white outline for sticker effect, isolated subject

ネガティブプロンプト:
torii, shrine gate, other animals, pet, foreground elements,
complex background, cherry blossom on forehead, tattoo, markings,
text, watermark, signature, garter belt, excessive exposure,
slit pupils, animal face, feline face, whiskers, animal nose
```

`human face, human eyes` と、ネガティブ側の `slit pupils, animal face,
feline face, whiskers, animal nose` は、耳・尻尾のみ猫要素とし、顔立ちが
猫寄りに引っ張られるのを防ぐための固定指定。生成結果を見て顔が動物寄りに
なる場合は `(human face:1.2)` のように強度を上げて再調整する。

表情・ポーズは trigger_type ごとに共通ベースへ追記する形で個別指定する
（例: task_start → excited expression, pointing）

### ホーム画面用プロンプト（Idle / Default・確定版）

ホーム画面のメインキャラは、タスク反応用チビ（スタンプ）とは意図的に
スタイルを分ける。ファッション誌のモデル的な立ち位置として、より
等身の高いイラストで表現する。

```
[Core Style]
High-quality, detailed digital illustration, fashion illustration,
clean line art, (transparent watercolor and cel-shaded hybrid:1.2),
soft and luminous lighting, VOGUE magazine aesthetic,
curated color palette, pure white background, isolated subject,
scattered editorial sparkles, NO text.

[Character Base]
1girl, solo, human face with expressive green eyes,
long flowing silver hair with loose waves,
prominent fluffy white cat ears on head, long fluffy white cat tail,
relaxed, gentle, slightly cool and sophisticated smile.

[Outfit Base]
Modern trendy private clothing (oversized cable-knit sweater,
plaid skirt, loose socks, sneakers) fused with subtle miko elements,
kosode-style collar peeking out, red-and-white kumihimo cord with
a small bell as a necklace, stylish 5-6 head proportions.

[Action / Scene (Home Default)]
Standing full-body view, posed like a fashion model, one hand resting
gently on her hip or holding a modern smartphone, looking straight
ahead with a cool yet welcoming smile, masterpiece, best quality,
aesthetic.
```

※ タスク反応用（chibi, 2 heads tall）とホーム画面用（5-6 heads tall,
fashion illustration）は別スタイルとして扱う。両者の共通点は「白銀の
長髪・白い猫耳と尻尾・白×赤の巫女モチーフ」のみとし、それ以外の
画風・プロポーションは統一しない設計とする。
将来キャラを追加する場合も、この「chibi用」「ホーム用」の2系統
プロンプト構成を踏襲する。

### 採用済みリファレンス画像とtrigger_type対応（案）
| ポーズ・表情 | 用途イメージ |
|---|---|
| メガホンを持って呼びかけ | cheer（応援・励まし） |
| 困り顔・考え中 | idle または task_retry |
| 手を振る・挨拶 | ホーム画面 / greeting用 |
| 指差し＋クリップボード | task_start（タスク開始） |
| 鏡の前で身支度 | task_complete（メイク・身支度系） |
| 大きな袖に包まり考え中（吹き出し付き） | idle、または寝る前シチュエーションのtask_complete |

※ 実際の21枚制作時は、上記の安全基準に沿ったポーズ・構図で統一する

## タスク別プロンプト・trigger差分一覧

各行は共通ベースプロンプトの末尾に追記して使用する。
`image_path`は生成後にSupabase Storageへアップロードした実際のパスに置き換える。

### 朝（situation_id: morning）
| order | task_name | プロンプト差分 |
|---|---|---|
| 1 | 白湯 | sleepy expression, half-closed eyes, holding a small cup with both hands, slight steam effect, front view, cozy atmosphere |
| 2 | 洗顔 | cheerful expression, both hands cupped near face, bubbles/foam on hands, front view, slightly tilted head |
| 3 | 化粧水 | gentle smile, one hand touching cheek, holding a cotton pad, three-quarter view, soft blinking eyes |
| 4 | 乳液 | calm expression, both hands smoothing cheeks, eyes closed, front view, relaxed shoulders |
| 5 | 下地・メイク | focused expression, holding a small mirror, one eye slightly closed, three-quarter view, determined look |

### 昼（situation_id: noon）
| order | task_name | プロンプト差分 |
|---|---|---|
| 1 | 皮脂・崩れオフ | slightly surprised expression, holding a blotting paper near face, front view, one eyebrow raised |
| 2 | あぶらとり・ミスト | refreshed expression, eyes closed, spray mist effect near face, front view, gentle smile |
| 3 | リップ直し | smug confident expression, holding a lipstick, one eye winking, three-quarter view, hand near mouth |
| 4 | 水分補給 | content expression, holding a water bottle with both hands, drinking pose, front view, cheeks slightly puffed |
| 5 | 姿勢・軽ストレッチ | energetic expression, arms stretched upward, standing pose, front view, tail swaying |

### 晩（situation_id: night）
| order | task_name | プロンプト差分 |
|---|---|---|
| 1 | クレンジング | relaxed expression, both hands on cheeks, eyes gently closed, front view, calm atmosphere |
| 2 | 洗顔 | soft smile, hands near face with water droplet effects, front view, slightly damp hair strands |
| 3 | 化粧水 | sleepy but content expression, patting cheek with one hand, three-quarter view, tail curled |
| 4 | 美容液 | gentle focused expression, holding a small dropper bottle, front view, careful gaze downward |
| 5 | 乳液・クリーム | warm smile, both hands gently pressed on cheeks, eyes closed, front view, cozy pose |

### 寝る前（situation_id: beforesleep）
| order | task_name | プロンプト差分 |
|---|---|---|
| 1 | ヘアケア | peaceful expression, holding a hairbrush, brushing own hair, three-quarter view, eyes half-closed |
| 2 | ハンドクリーム | soft smile, rubbing hands together, cream texture on palms, front view, relaxed shoulders |
| 3 | リップケア | calm expression, holding a lip balm stick, gentle touch near lips, front view, slight head tilt |
| 4 | ストレッチ・深呼吸 | sleepy content expression, arms raised in gentle stretch, eyes closed, front view, yawning pose |
| 5 | 翌日の服チェック | thoughtful expression, one hand on chin, looking slightly upward, front view, thinking pose, small thought bubble |

### Supabase投入用SQL（雛形）

situationsテーブルへの投入:
```sql
INSERT INTO situations (situation_id, name, display_order, is_default, access_tier) VALUES
('morning', '朝', 1, true, 'no_login'),
('noon', '昼', 2, true, 'no_login'),
('night', '晩', 3, true, 'no_login'),
('beforesleep', '寝る前', 4, true, 'no_login');
```

tasksテーブルへの投入（image_pathは実ファイルアップロード後に差し替え）:
```sql
INSERT INTO tasks (situation_id, order_index, task_name, image_path, dialogue) VALUES
('morning', 1, '白湯', 'characters/neko/reactions/neko_morning_01.png', ''),
('morning', 2, '洗顔', 'characters/neko/reactions/neko_morning_02.png', ''),
('morning', 3, '化粧水', 'characters/neko/reactions/neko_morning_03.png', ''),
('morning', 4, '乳液', 'characters/neko/reactions/neko_morning_04.png', ''),
('morning', 5, '下地・メイク', 'characters/neko/reactions/neko_morning_05.png', ''),
('noon', 1, '皮脂・崩れオフ', 'characters/neko/reactions/neko_noon_01.png', ''),
('noon', 2, 'あぶらとり・ミスト', 'characters/neko/reactions/neko_noon_02.png', ''),
('noon', 3, 'リップ直し', 'characters/neko/reactions/neko_noon_03.png', ''),
('noon', 4, '水分補給', 'characters/neko/reactions/neko_noon_04.png', ''),
('noon', 5, '姿勢・軽ストレッチ', 'characters/neko/reactions/neko_noon_05.png', ''),
('night', 1, 'クレンジング', 'characters/neko/reactions/neko_night_01.png', ''),
('night', 2, '洗顔', 'characters/neko/reactions/neko_night_02.png', ''),
('night', 3, '化粧水', 'characters/neko/reactions/neko_night_03.png', ''),
('night', 4, '美容液', 'characters/neko/reactions/neko_night_04.png', ''),
('night', 5, '乳液・クリーム', 'characters/neko/reactions/neko_night_05.png', ''),
('beforesleep', 1, 'ヘアケア', 'characters/neko/reactions/neko_beforesleep_01.png', ''),
('beforesleep', 2, 'ハンドクリーム', 'characters/neko/reactions/neko_beforesleep_02.png', ''),
('beforesleep', 3, 'リップケア', 'characters/neko/reactions/neko_beforesleep_03.png', ''),
('beforesleep', 4, 'ストレッチ・深呼吸', 'characters/neko/reactions/neko_beforesleep_04.png', ''),
('beforesleep', 5, '翌日の服チェック', 'characters/neko/reactions/neko_beforesleep_05.png', '');
```

charactersテーブルへの投入:
```sql
INSERT INTO characters (character_id, name, tier, home_main_image_path) VALUES
('neko', '猫巫女獣人', 'free', 'characters/neko/reactions/neko_home_main.png');
```

## 拡張時のルール
- 新しいシチュエーションを追加する際は `situations` テーブルに1行追加のみ
  （コード修正不要な設計を維持すること）
- 新しいタスクを追加する際は `tasks` テーブルに1行追加し、対応する画像・
  セリフを用意する
- 画像が用意できていないタスクは、`image_path` をキャラのデフォルト画像
  （`home_main_image_path`）にフォールバックさせる設計にしておく

## 画像・アセット拡張ロードマップ（MVP後）
MVPは「ホーム1枚＋タスク20枚」の計21枚で運用し、以下の優先順位で
段階的に拡張する。

1. **セリフバリエーション追加（低コスト・画像追加なし）**
   既存21枚は据え置きのまま、`dialogue_variation` を活用して
   同じ場面でも複数パターンのセリフを持たせる。
   継続日数や呼びかけ等、「キャラに見てもらえている感」を
   強化する方向を優先する。

2. **実績解放シーン追加（中コスト）**
   `user_progress.unlocked_scenes` 用に、ホーム画面と同系統
   （5〜6頭身・私服×巫女モチーフ）のご褒美カットを追加する。
   「3日坊主クリア」「7日ログイン」等の達成時に表示する想定。

3. **シチュエーション追加に伴うタスク画像追加（高コスト）**
   「デート前」「休日」等を追加する場合、そのシチュエーション分の
   タスク画像（5枚単位）が新たに必要になる。

