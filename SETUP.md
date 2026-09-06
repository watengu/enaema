# エナエマ 開発環境セットアップ手順書

このドキュメントは、GitHub・Codespaces・Aider（Claude）・Supabase・
Vercelを使ったエナエマの開発環境セットアップ手順をまとめたものです。
上から順番に進めてください（全体の構造は末尾の「開発環境の階層整理」
を参照）。

---

## 事前準備：用意するファイル

以下のファイルをすべて用意しておく。

```
.gitignore
.env.example
.nvmrc
README.md
CLAUDE.md
CONVENTIONS.md
DESIGN.md
ASSETS.md
PROMPTS.md
docs/legal/terms.md
docs/legal/privacy.md
docs/legal/community.md
```

### ファイルの役割分担（重要）

```
仕様書（Aiderに /read で読み込ませる）
├── README.md
├── CONVENTIONS.md（CLAUDE.mdと同一）
├── DESIGN.md
└── ASSETS.md

実行用（人間がコピーしてAiderに貼る。/read はしない）
└── PROMPTS.md
```

`PROMPTS.md` は、Aiderへの指示文（プロンプト）をあらかじめ
まとめた**人間向けのコピペ集**であり、仕様そのものではない。
Aiderに `/read PROMPTS.md` として読み込ませる必要はない。
各ステップで貼るプロンプトは、このドキュメントの代わりに
`PROMPTS.md` から該当箇所をコピーして使ってよい（内容は同じ）。

---

## ① GitHubリポジトリ作成

1. https://github.com にログイン
2. 右上の「+」→「New repository」
3. Repository name（例：`enaema`）を入力
4. Public / Private を選択（個人開発ならPrivateがおすすめ）
5. 「Create repository」をクリック
6. リポジトリ画面の「Add file」→「Upload files」を選択
7. 用意した`.gitignore`と各`.md`ファイルをまとめてドラッグ＆ドロップ
   - `docs/legal/` フォルダに入れたい場合は、アップロード時に
     ファイル名を `docs/legal/terms.md` のようにパスごと入力すると
     自動でフォルダが作られる
8. 「Commit changes」で確定

> ✅ ここまでで、.mdファイル一式がGitHub上に反映された状態になる。

---

## ② GitHub Codespaces起動

1. リポジトリ画面の緑色の「Code」ボタンをクリック
2. 「Codespaces」タブを選択
3. 「Create codespace on main」をクリック
4. ブラウザ上でVS Code風の開発環境が起動する（数十秒〜数分）

---

## ③ Supabaseプロジェクト作成

1. https://supabase.com にログイン（GitHubアカウントでログイン可）
2. 「New Project」をクリック
3. 以下を入力：
   - Project name（例：`enaema`）
   - Database Password（後で使うので必ずメモしておく）
   - Region（Tokyoなど、近いリージョンを推奨）
4. 「Create new project」をクリック（数分で起動）
5. 起動後、左メニュー「Project Settings」→「API」を開く
6. 以下の2つをコピーしてメモしておく：
   - `Project URL`
   - `anon public` キー

> ⚠️ `service_role` キーも同じ画面にあるが、これは絶対に
> クライアントコードや.envファイルの公開部分に含めないこと。
> 使う場合はVercelのサーバー限定環境変数、またはSupabase
> Edge Functionの環境変数としてのみ設定する。

---

## ④ Vercelプロジェクト作成・連携

1. https://vercel.com にログイン（GitHubアカウントでログイン可）
2. 「Add New」→「Project」
3. 先ほど作成したGitHubリポジトリを選択→「Import」
4. 「Environment Variables」欄に以下を追加：

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ③でコピーしたProject URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ③でコピーしたanon public キー |

5. この時点ではまだ「Deploy」を無理に実行しなくてよい。今のリポジトリは
   まだ仕様書だけ（Next.jsプロジェクトが存在しない）ため、初回Deployは
   ⑦でAiderがプロジェクト初期化を終え、`git push` した後に行う方が
   自然。ここではプロジェクトの作成とGitHub連携・環境変数の登録だけ
   済ませておけば十分

---

## ⑤ Codespaces内でAider + Claudeのセットアップ

Codespacesのターミナルで、以下を順番に実行する。

```bash
# Aiderのインストール
pip install aider-install
aider-install
```

```bash
# Anthropic APIキーを環境変数に設定
export ANTHROPIC_API_KEY=ここに自分のAPIキーを貼る
```

```bash
# Aiderを起動（<使用するClaudeモデル>は、その時点のAider/Anthropic
# 双方の対応状況を確認してから指定する。モデル名は固定で覚えず、
# 作業時にAiderの --model ヘルプや公式ドキュメントで確認すること）
aider --model <使用するClaudeモデル>
```

> APIキーは https://console.anthropic.com から発行できる。
> 上記の `export` はターミナルに直接貼る一時的な方法であり、
> 永続的な保存方法ではない（シェルを閉じる、Codespacesを再作成する
> 等で消える場合がある）。頻繁に使うなら、Codespacesの「Secrets」機能
> （リポジトリ設定→Codespaces→Repository secrets）への登録を検討する。

---

## ⑥ Aiderにルールファイルを読み込ませ、まず「分析フェーズ」を挟む

Aider起動後、チャット欄にまず以下を入力する。

```
/read CONVENTIONS.md
/read README.md
/read DESIGN.md
/read ASSETS.md
```

読み込み直後にいきなり実装を指示せず、必ず一度理解度を確認する
「分析フェーズ」を挟む。これが最重要ステップ。

```
これらの仕様を理解したうえで、現状のリポジトリ構成を確認してください。
まだコードは変更しないでください。
現在の構成、技術スタック、仕様上の制約、
今後実装する際に注意すべき点を整理してください。
```

Aiderの回答内容が仕様と食い違っていないか（色トークン、キャラ画像の
使い分け、フッタータブ数、日本語表記など）を必ず確認してから次に進む。
ここを飛ばすと、後工程で仕様とズレた実装が生まれやすい。

---

## ⑦ 最初の実装指示（プロジェクト初期化）

分析フェーズで問題がなければ、以下を貼り付ける。

```
では、まずプロジェクトの初期構成だけ実装してください。
Next.js（App Router）+ TypeScript + Tailwind + shadcn/ui
を使用してください。
Supabaseについてはクライアント接続の基盤だけ作成してください。
まだ認証・SNS機能・本番機能などは実装しないでください。
DESIGN.md、CONVENTIONS.mdのルールを優先してください。
実装後にpnpm buildとpnpm lintが通る状態にしてください。
```

Aiderが変更を提示したら、**反映前に必ず変更内容を自分の目で確認する**。
Aiderの設定・操作によっては自動でコミットまで行われるため、
「自動でコミットされたから大丈夫」と過信せず、以下で確認する習慣を
最初から持つこと。

```bash
git status
git diff
```

`git diff` は既存ファイルの変更差分しか表示しない。Aiderが作成した
**新規ファイル**（プロジェクト初期化時に大量に生成される）は
`git status` で一覧に出るが、中身までは表示されないため、
気になるファイルは直接開いて内容を確認すること。

問題なければ、確認を行う。最初のプロジェクト初期化時は依存関係が
新規インストールされるため `pnpm install` が必要だが、以降の機能実装
では **package.json（依存パッケージ）に変更があったときだけ**
`pnpm install` を実行すればよい（毎回の実行は不要）。

```bash
pnpm install   # 最初のプロジェクト初期化時、または依存関係変更時のみ
pnpm build
pnpm lint
```

エラーが出た場合は、そのエラーメッセージをそのままAiderに貼り付けて
修正を依頼する。

---

## ⑧ 以降の進め方

- 1回の指示で「1機能」を目安にする（例：ステータス表示画面だけ、
  タスクセット機能だけ、のように分割する）
- 各指示の後、必ず `pnpm build` を実行して確認する
- 動作確認できたら `git push` してVercelに自動デプロイさせる
- 大きな仕様変更をする場合は、先にREADME.md側を更新してから
  Aiderに反映を依頼する（仕様書とコードの乖離を防ぐため）

---

## 開発環境の階層整理（迷ったときのメモ）

```
              GitHub
                │
                ▼
           Codespaces
         （開発環境・作業場所）
                │
                ▼
        Aider / Claude Code
          （AIエージェント）
                │
                ▼
              Claude
            （AIモデル）
                │
        ┌───────┴───────┐
        ▼               ▼
     Supabase          Vercel
     DB／Auth／Storage  Hosting／Deploy
```

- Codespaces＝作業するPC（場所）
- Aider／Claude Code＝その場所で動くAIエージェント（どちらを使うか選べる）
- 「Codespaces か Claude Code か」ではなく、「Codespaces上でAiderと
  Claude Codeのどちらをエージェントとして使うか」という選択である
- Supabase（DB・認証・ストレージ）とVercel（ホスティング）は
  並列の別サービスであり、どちらもGitHubリポジトリと連携する

今の段階では Codespaces + Aider + Claude で進める。理由は、
仕様書 → AIに理解させる（分析フェーズ） → 小さく実装 → build/lint
→ 次の実装、という手順を踏みやすいため。実際に使ってみて
Claude Codeの方が合うと感じたら、環境自体を変えずにエージェントだけ
Claude Codeに切り替えればよい。

### 1機能あたりの作業フロー（要約）

```
仕様書を読む → 分析（人間が内容を確認） → 小さく実装
→ git status / git diff（新規ファイルは中身も確認）
→ （依存関係を変更した場合のみ pnpm install）
→ pnpm build → pnpm lint → 動作確認
→ git push → Vercelへ自動デプロイ
```

AIにいきなり大きな実装をまとめて任せず、この単位で1機能ずつ
繰り返すことで、「動いているが仕様と違う」状態を防ぐ。

## トラブル時のチェックリスト

- ビルドエラーが出る → エラーメッセージをそのままAiderに貼る
- Supabase接続エラー → Vercel/Codespaces両方の環境変数が正しいか確認
- デザインがイメージと違う → 「DESIGN.mdのルールに従って修正して」と
  明示的に指示する
- 想定外の機能が追加されている → 「README.mdにない機能なので削除して」
  と指示する
- 「何が変更されたか分からない」→ `git status` で新規ファイルも含めて
  確認し、`git diff` で既存ファイルの変更差分を確認する。新規ファイルは
  diffに出ないため、気になるものは直接開いて中身を確認する。Aiderの
  自動コミットを過信せず、反映前に必ず目を通す
