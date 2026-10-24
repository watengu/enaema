// Enaema ホーム画面 v8（2026-10-24）— 表紙＋タスクセット＋ステータス＋Bot テキストロール
// 根拠: reconciliation-2026-10-24.md（ホーム＝雑誌の表紙／最小ローンチ範囲／Bot ロールは #7 から前倒し）
// 構成: マストヘッド（題字＋日付＋天気ボックス）はサーバ側、表紙とタスク表示は HomeClient、
//       ホーム下部の細い帯に Ticker（天気の実データ＋ DB の ticker_items を流す）
// 権限: 現在は未ログイン前提（tier=no_login）。認証導入時にセッションの Tier を渡す。

import HomeClient, { type Situation, type Task } from "./home-client";
import Ticker from "./ticker";
import { type Tier } from "./permissions";

type Character = {
character_id: string;
name: string;
tier: string;
home_main_image_path: string;
};

type DayWeather = {
label: string;
max: number;
min: number;
};

type Weather = DayWeather & {
now: number | null;
condition: string;
tomorrow: DayWeather | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function fetchTable<T>(path: string): Promise<T[]> {
const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
headers: {
apikey: SUPABASE_ANON_KEY ?? "",
Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ""}`,
},
cache: "no-store",
});
if (!res.ok) throw new Error(`fetch failed: ${path}`);
return (await res.json()) as T[];
}

function storageUrl(imagePath: string): string {
return `${SUPABASE_URL}/storage/v1/object/public/enaema-images/${imagePath}`;
}

function todayLabelJST(): string {
const now = new Date(
new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
);
const w = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${w}）`;
}

// WMO weather code → 日本語ラベル
function weatherLabel(code: number): string {
if (code === 0 || code === 1) return "晴れ";
if (code === 2) return "晴れ時々曇り";
if (code === 3) return "曇り";
if (code === 45 || code === 48) return "霧";
if (code >= 51 && code <= 57) return "霧雨";
if (code === 61 || code === 63 || code === 66 || code === 67) return "雨";
if (code === 65 || code === 82) return "大雨";
if (code === 71 || code === 73 || code === 77) return "雪";
if (code === 75 || code === 85 || code === 86) return "大雪";
if (code === 80 || code === 81) return "にわか雨";
if (code >= 95) return "雷雨";
return "―";
}

function conditionLine(code: number, max: number): string {
if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95)
return "雨対策と湿気ケアを忘れずに";
if (code >= 71 && code <= 86) return "足元と防寒に気をつけて";
if (max >= 28) return "暑さと紫外線の対策を";
if (max >= 23) return "軽やかな装いで過ごしやすい一日";
if (max >= 17) return "羽織りものがあると安心な一日";
if (max >= 11) return "暖かめのコーデが安心な一日";
return "しっかり防寒したい一日";
}

// 銀座の天気（Open-Meteo、無料・キー不要）。失敗時は null（天気ボックスを出さない）
async function fetchWeather(): Promise<Weather | null> {
try {
const url =
"https://api.open-meteo.com/v1/forecast?latitude=35.6712&longitude=139.7649" +
"&daily=weather_code,temperature_2m_max,temperature_2m_min" +
"&current=temperature_2m&timezone=Asia%2FTokyo&forecast_days=2";
const res = await fetch(url, { next: { revalidate: 1800 } });
if (!res.ok) return null;
const j = await res.json();
const code = Number(j?.daily?.weather_code?.[0]);
const max = Math.round(Number(j?.daily?.temperature_2m_max?.[0]));
const min = Math.round(Number(j?.daily?.temperature_2m_min?.[0]));
if (Number.isNaN(code) || Number.isNaN(max) || Number.isNaN(min))
return null;
const nowRaw = Number(j?.current?.temperature_2m);
const tCode = Number(j?.daily?.weather_code?.[1]);
const tMax = Math.round(Number(j?.daily?.temperature_2m_max?.[1]));
const tMin = Math.round(Number(j?.daily?.temperature_2m_min?.[1]));
const tomorrow =
Number.isNaN(tCode) || Number.isNaN(tMax) || Number.isNaN(tMin)
? null
: { label: weatherLabel(tCode), max: tMax, min: tMin };
return {
label: weatherLabel(code),
max,
min,
now: Number.isNaN(nowRaw) ? null : Math.round(nowRaw),
condition: conditionLine(code, max),
tomorrow,
};
} catch {
return null;
}
}

// テキストロールの editorial 文言（DB の ticker_items）。テーブル未作成・失敗時は空でよい
async function fetchTickerTexts(): Promise<string[]> {
try {
const rows = await fetchTable<{ text: string }>(
"ticker_items?select=text&is_active=eq.true&order=display_order.asc,id.asc"
);
return rows.map((r) => r.text).filter(Boolean);
} catch {
return [];
}
}

// いまの時間帯（JST）: 朝 5–10 / 昼 11–16 / 晩 17–21 / 寝る前 22–4
function currentSituationKeyJST(): string {
const fmt = new Intl.DateTimeFormat("en-US", {
timeZone: "Asia/Tokyo",
hour: "numeric",
hourCycle: "h23",
});
const hour = parseInt(fmt.format(new Date()), 10);
if (hour >= 5 && hour < 11) return "morning";
if (hour >= 11 && hour < 17) return "noon";
if (hour >= 17 && hour < 22) return "night";
return "beforesleep";
}

// 認証導入までは未ログイン扱い（認証の工程でセッションから決める）
const CURRENT_TIER: Tier = "no_login";

export default async function Home() {
let situations: Situation[] = [];
let tasks: Task[] = [];
let character: Character | null = null;
let weather: Weather | null = null;
let tickerTexts: string[] = [];
let loadError = false;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
loadError = true;
} else {
try {
const [s, t, c, w] = await Promise.all([
fetchTable<Situation>("situations?select=*&order=display_order.asc"),
fetchTable<Task>("tasks?select=*&order=situation_id.asc,order_index.asc"),
fetchTable<Character>("characters?select=*&character_id=eq.neko"),
fetchWeather(),
]);
situations = s;
tasks = t;
character = c[0] ?? null;
weather = w;
} catch {
loadError = true;
}
tickerTexts = await fetchTickerTexts();
}

const currentKey = currentSituationKeyJST();
const currentName =
situations.find((s) => s.situation_id === currentKey)?.name ?? "";

const tickerLines: string[] = [];
if (weather) {
tickerLines.push(
`銀座の天気 ― ${weather.label}　最高${weather.max}℃／最低${weather.min}℃`
);
if (weather.tomorrow) {
tickerLines.push(
`明日の銀座 ― ${weather.tomorrow.label}　最高${weather.tomorrow.max}℃／最低${weather.tomorrow.min}℃`
);
}
}
tickerLines.push(...tickerTexts);

return (
<main
className="min-h-screen"
style={{ background: "var(--bg)", color: "var(--text)" }}
>
<div className="mx-auto w-full max-w-md px-4 pb-12">
{/* マストヘッド（雑誌の題字） */}
<header className="pt-6 text-center">
<div
className="border-y-4 border-double py-4"
style={{ borderColor: "var(--text)" }}
>
<p
className="text-[10px] tracking-[0.35em]"
style={{ color: "var(--muted)", fontFamily: "var(--font-display)" }}
>
DAILY BEAUTY MAGAZINE
</p>
<h1
className="mt-1 text-5xl font-semibold tracking-wide"
style={{ fontFamily: "var(--font-display)" }}
>
Enaema
</h1>
<p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
今日の私を、もっと好きになる。
</p>
</div>
{/* 日付＋天気ボックス */}
<div className="flex items-center justify-between gap-2 py-2 text-[11px]">
<span style={{ color: "var(--muted)" }}>{todayLabelJST()}</span>
{weather && (
<span
className="border px-2 py-1 whitespace-nowrap"
style={{ borderColor: "var(--text)" }}
>
銀座 {weather.label}　最高{weather.max}℃／最低{weather.min}℃
{weather.now !== null && `　いま${weather.now}℃`}
</span>
)}
</div>
{weather && (
<p className="pb-2 text-[11px]" style={{ color: "var(--muted)" }}>
今日のコンディション ― {weather.condition}
</p>
)}
{/* 時間帯セレクタ（｜区切り・各セクションへのリンク） */}
<nav
className="border-b pb-2 text-xs"
style={{ borderColor: "var(--line)" }}
>
{situations.map((s, i) => (
<span key={s.situation_id}>
{i > 0 && <span style={{ color: "var(--muted)" }}>｜</span>}
<a
href={`#situation-${s.situation_id}`}
className={s.name === currentName ? "font-bold" : ""}
style={
s.name === currentName
? { color: "var(--accent)" }
: { color: "var(--muted)" }
}
>
{s.name}
</a>
</span>
))}
</nav>
</header>

{loadError ? (
<p
className="py-16 text-center text-sm"
style={{ color: "var(--muted)" }}
>
マスタデータを読み込めませんでした。時間をおいて再度お試しください。
</p>
) : (
<HomeClient
situations={situations}
tasks={tasks}
heroUrl={
character ? storageUrl(character.home_main_image_path) : null
}
characterName={character?.name ?? ""}
imageBase={`${SUPABASE_URL}/storage/v1/object/public/enaema-images/`}
tier={CURRENT_TIER}
currentKey={currentKey}
/>
)}

{/* Bot テキストロール（表紙の外・ホーム下部の細い帯） */}
<Ticker lines={tickerLines} />

{/* フッター（3タブ構成・テキスト） */}
<footer
className="mt-12 border-t pt-4 text-center"
style={{ borderColor: "var(--line)" }}
>
<p className="text-xs" style={{ color: "var(--muted)" }}>
ホーム｜タイムライン｜マイページ
</p>
<p className="mt-2 text-[10px]" style={{ color: "var(--muted)" }}>
Enaema — Buffly プロトタイプ
</p>
</footer>
</div>
</main>
);
}
