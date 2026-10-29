// Enaema ホーム画面 v14（2026-10-25）— ヘッダー/フッターを廃し、題字・日付・天気・ログインはすべて表紙側に集約— 表紙＋タスクセット＋ステータス＋Bot テキストロール
// 根拠: reconciliation-2026-10-24.md（ホーム＝雑誌の表紙／最小ローンチ範囲／Bot ロールは #7 から前倒し）
// 構成: 画面そのものが表紙。題字・日付・天気・操作はすべて HomeClient の表紙上に集約し、
//       このファイルはデータ取得と最下部の細い Ticker 帯だけを担う
// 権限: 現在は未ログイン前提（tier=no_login）。認証導入時にセッションの Tier を渡す。

import HomeClient, { type Situation, type Task } from "./home-client";
import Ticker from "./ticker";
import { type Tier } from "./permissions";
import { fetchWeatherAt } from "./weather";

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
conditionShort: string;
icon: string;
uvMax: number | null;
humidityDay: number | null;
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
// 天気の変換表と取得は app/weather.ts の共通部品を使う（表紙の地域切り替えと共有するため）。
// サーバー側は既定地域（銀座）を従来どおり取得する。地域連動はクライアント側で行う。
async function fetchWeather(): Promise<Weather | null> {
return fetchWeatherAt(35.6712, 139.7649, { next: { revalidate: 1800 } });
}

// テキストロールの editorial 文言（DB の ticker_items）。テーブル未作成・失敗時は空でよい
// v15.12: url 列も取得する（GC記事などの行はタップで遷移できる）
type TickerItem = { text: string; url: string | null };
async function fetchTickerItems(): Promise<TickerItem[]> {
try {
const rows = await fetchTable<TickerItem>(
"ticker_items?select=text,url&is_active=eq.true&order=display_order.asc,id.asc"
);
return rows.filter((r) => r.text);
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

// 初期値は未ログイン。実際の階層は HomeClient がセッション（localStorage）から決める
const CURRENT_TIER: Tier = "no_login";

export default async function Home() {
let situations: Situation[] = [];
let tasks: Task[] = [];
let character: Character | null = null;
let weather: Weather | null = null;
let tickerItems: TickerItem[] = [];
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
tickerItems = await fetchTickerItems();
}

const currentKey = currentSituationKeyJST();

// v15.11: 天気行は editorial と分けて渡す（クライアント側に地域連動の天気行があれば Ticker がそちらを優先する）
const weatherLines: string[] = [];
if (weather) {
weatherLines.push(
`銀座の天気 ― ${weather.label}　最高${weather.max}℃／最低${weather.min}℃`
);
if (weather.tomorrow) {
weatherLines.push(
`明日の銀座 ― ${weather.tomorrow.label}　最高${weather.tomorrow.max}℃／最低${weather.tomorrow.min}℃`
);
}
}
const tickerLines: TickerItem[] = [...tickerItems];

return (
<main
className="h-svh overflow-hidden"
style={{ background: "var(--bg)", color: "var(--text)" }}
>
<div className="mx-auto flex h-full w-full max-w-md flex-col px-4">


{loadError ? (
<p
className="py-16 text-center text-sm"
style={{ color: "var(--muted)" }}
>
マスタデータを読み込めませんでした。時間をおいて再度お試しください。
</p>
) : (
<div className="min-h-0 flex-1">
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
coverMeta={{
todayLabel: todayLabelJST(),
weather: weather
? {
label: weather.label,
max: weather.max,
min: weather.min,
now: weather.now,
condition: weather.condition,
conditionShort: weather.conditionShort,
icon: weather.icon,
uvMax: weather.uvMax,
humidityDay: weather.humidityDay,
tomorrow: weather.tomorrow,
}
: null,
}}
/>
</div>
)}

{/* Bot テキストロール（表紙の外・ホーム下部の細い帯） */}
<div className="shrink-0">
<Ticker items={tickerLines} weatherLines={weatherLines} />
</div>


</div>
</main>
);
}
