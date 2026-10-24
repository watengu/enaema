import React from "react";

// Enaema ホーム画面 v1（2026-10-24）
// - 画像は Supabase Storage の公開URLから読み込む
// - タスク一覧は DB（public.tasks）と同じ内容を埋め込み表示。DB連携は次フェーズ
const STORAGE_BASE =
  "https://jttfiwlnhxqfercswfvg.supabase.co/storage/v1/object/public/enaema-images/characters/neko/reactions/";

type Task = { name: string; img: string };
type Module = { id: string; label: string; tasks: Task[] };

const MODULES: Module[] = [
  {
    id: "morning",
    label: "朝",
    tasks: [
      { name: "白湯", img: "neko_morning_01.png" },
      { name: "洗顔", img: "neko_morning_02.png" },
      { name: "化粧水", img: "neko_morning_03.png" },
      { name: "乳液", img: "neko_morning_04.png" },
      { name: "下地・メイク", img: "neko_morning_05.png" },
    ],
  },
  {
    id: "noon",
    label: "昼",
    tasks: [
      { name: "皮脂・崩れオフ", img: "neko_noon_01.png" },
      { name: "あぶらとり・ミスト", img: "neko_noon_02.png" },
      { name: "リップ直し", img: "neko_noon_03.png" },
      { name: "水分補給", img: "neko_noon_04.png" },
      { name: "姿勢・軽ストレッチ", img: "neko_noon_05.png" },
    ],
  },
  {
    id: "night",
    label: "夜",
    tasks: [
      { name: "クレンジング", img: "neko_night_01.png" },
      { name: "洗顔", img: "neko_night_02.png" },
      { name: "化粧水", img: "neko_night_03.png" },
      { name: "美容液", img: "neko_night_04.png" },
      { name: "乳液・クリーム", img: "neko_night_05.png" },
    ],
  },
  {
    id: "beforesleep",
    label: "寝る前",
    tasks: [
      { name: "ヘアケア", img: "neko_beforesleep_01.png" },
      { name: "ハンドクリーム", img: "neko_beforesleep_02.png" },
      { name: "リップケア", img: "neko_beforesleep_03.png" },
      { name: "ストレッチ・深呼吸", img: "neko_beforesleep_04.png" },
      { name: "翌日の服チェック", img: "neko_beforesleep_05.png" },
    ],
  },
];

function todayJST(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  );
  const w = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
  return `${now.getMonth() + 1}月${now.getDate()}日（${w}）`;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-rose-50 text-stone-800">
      <div className="mx-auto w-full max-w-md px-4 pb-16">
        {/* ヘッダー */}
        <header className="pt-6 pb-2 text-center">
          <p className="text-xs tracking-widest text-rose-400">{todayJST()}</p>
          <h1 className="mt-1 text-2xl font-bold">エナエマ</h1>
          <p className="mt-1 text-sm text-stone-500">
            今日の私を、もっと好きになる。
          </p>
        </header>

        {/* ヒーロー画像 */}
        <section className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={STORAGE_BASE + "home.png"}
            alt="猫巫女キャラクター"
            className="w-full object-cover"
          />
          <div className="px-4 py-3">
            <p className="text-sm font-semibold">今日のおすすめ度 ★★★★☆</p>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              乾燥しやすい一日。朝の保湿を厚めにすると、夕方まで崩れにくいよ。
              （天気・指数は仮表示です）
            </p>
          </div>
        </section>

        {/* タスクモジュール */}
        {MODULES.map((mod) => (
          <section key={mod.id} className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="inline-block h-5 w-1.5 rounded bg-rose-500" />
              {mod.label}のタスク
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {mod.tasks.map((t) => (
                <article
                  key={t.img}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={STORAGE_BASE + t.img}
                    alt={t.name}
                    className="aspect-[4/5] w-full object-cover"
                    loading="lazy"
                  />
                  <p className="px-3 py-2 text-sm font-medium">{t.name}</p>
                  <div className="flex gap-1 px-3 pb-3">
                    {["◎", "○", "△"].map((s) => (
                      <span
                        key={s}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-xs text-rose-600"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        <footer className="mt-10 text-center text-xs text-stone-400">
          Enaema — Buffly プロトタイプ
        </footer>
      </div>
    </main>
  );
}
