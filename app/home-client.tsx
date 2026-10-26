"use client";

// Enaema ホームクライアント部品 v15.5（表紙キャッチを天気連動に：雨・雪・猛暑・厳寒で出し分け、それ以外は従来の時間帯キャッチ）
// v11: 表紙カード（ダッシュボード型）を廃し、シーン主役＋字幕＋ストーリーバーに再構成。
// 操作（新規セット等）はパネルと下部の細い帯に沈める。「眺める」体験を画面の中心に戻す
// 体験の中心は「操作」ではなく「眺める」: 今の時間帯のシーンがスライドで自動再生される（放置型）
// - 先頭スライド = 表紙（キャラのメイン画像）。続いて今の時間帯に選んだタスクのシーンが流れる
// - 開始位置は時刻から決まる（時間帯の経過割合 × シーン数）。タップは「次のシーンへ」の軽い操作だけ
// - タスク完了のタップ（済）は廃止。ユーザーの操作は「自分のセットを選ぶ」ことに集約する
// - ステータス入力: 属性（骨格／PC／顔タイプ／肌タイプ／髪型）を選ぶと表紙に刷られる。
//   基本ステータス（骨格×PC）は全員、追加ステータス（顔タイプ等）はログイン時のみ表紙に出る
// - 選択とステータスは端末内（localStorage）に保存。権限（選べる範囲）は permissions.ts が決める

import { useEffect, useMemo, useRef, useState} from "react";
import {
canSeeSituation,
canSelectTask,
type Tier,
} from "./permissions";
import { getSession, type Session } from "./auth-client";
import { REGIONS, fetchWeatherAt, type WeatherData } from "./weather";
import { checkConsent, recordConsent, ConsentSheet } from "./consent";
import LoginButton from "./login-button";

export type Situation = {
situation_id: string;
name: string;
display_order: number;
is_default: boolean;
access_tier: string;
};

export type Task = {
task_id: number;
situation_id: string;
order_index: number;
task_name: string;
image_path: string;
dialogue: string;
dialogue_variation: number;
};

type Props = {
situations: Situation[];
tasks: Task[];
heroUrl: string | null;
characterName: string;
imageBase: string;
tier: Tier;
currentKey: string;
coverMeta: {
todayLabel: string;
weather: {
label: string;
max: number;
min: number;
now: number | null;
condition: string;
conditionShort: string;
icon: string;
} | null;
};
};

const SET_KEY = "enaema.taskset.v1";
const PROFILE_KEY = "enaema.profile.v1";

// ステータス（属性）の選択肢
export type Profile = {
  bone: string;
  pc: string;
  face: string;
  skin: string;
  hair: string;
};

const EMPTY_PROFILE: Profile = { bone: "", pc: "", face: "", skin: "", hair: "" };

const PROFILE_FIELDS: {
  key: keyof Profile;
  label: string;
  options: string[];
  loginOnly: boolean;
}[] = [
  { key: "bone", label: "骨格タイプ", options: ["ストレート", "ウェーブ", "ナチュラル"], loginOnly: false },
  { key: "pc", label: "パーソナルカラー", options: ["イエベ春", "ブルベ夏", "イエベ秋", "ブルベ冬"], loginOnly: false },
  { key: "face", label: "顔タイプ", options: ["キュート", "アクティブキュート", "フレッシュ", "ソフトエレガント", "フェミニン", "エレガント", "クールカジュアル", "クール"], loginOnly: true },
  { key: "skin", label: "肌タイプ", options: ["普通肌", "乾燥肌", "脂性肌", "混合肌", "敏感肌"], loginOnly: true },
  { key: "hair", label: "髪型", options: ["ショート", "ショートボブ", "ボブ", "ミディアム", "セミロング", "ロング"], loginOnly: true },
];

// 時間帯の窓（JST・分）: 朝 5:00–11:00 / 昼 11:00–17:00 / 晩 17:00–22:00 / 寝る前 22:00–29:00(=翌5:00)
const WINDOWS: Record<string, { start: number; end: number}> = {
morning: { start: 5 * 60, end: 11 * 60},
noon: { start: 11 * 60, end: 17 * 60},
night: { start: 17 * 60, end: 22 * 60},
beforesleep: { start: 22 * 60, end: 29 * 60},
};

function minutesNowJST(): number {
const fmt = new Intl.DateTimeFormat("en-GB", {
timeZone: "Asia/Tokyo",
hour: "2-digit",
minute: "2-digit",
hourCycle: "h23",
});
const parts = fmt.formatToParts(new Date());
const h = Number(parts.find((p) => p.type === "hour")?.value?? "0");
const m = Number(parts.find((p) => p.type === "minute")?.value?? "0");
return h * 60 + m;
}

// その時間帯の中で「いま何番目のシーンか」を時刻から決める
function timeSceneIndex(situationId: string, sceneCount: number): number {
if (sceneCount <= 0) return 0;
const w = WINDOWS[situationId];
if (!w) return 0;
let now = minutesNowJST();
if (now < w.start && w.end > 24 * 60) now += 24 * 60; // 寝る前（0時跨ぎ）
const total = w.end - w.start;
const elapsed = Math.min(Math.max(now - w.start, 0), total - 1);
return Math.min(sceneCount - 1, Math.floor((elapsed / total) * sceneCount));
}

type Slide = {
key: string;
imageUrl: string;
task: Task | null; // 舞台はタスクシーンのみ（表紙はホーム側で heroUrl を直接使う）
};


// 家具 v14.2: 文字リンクをやめ、すりガラス風ピル＋アイコンに統一（初期HTMLの文法を卒業する）
function PillIcon({ name }: { name: "check" | "list" | "sliders" | "home" }) {
const common = {
width: 12,
height: 12,
viewBox: "0 0 24 24",
fill: "none",
stroke: "currentColor",
strokeWidth: 2,
strokeLinecap: "round" as const,
strokeLinejoin: "round" as const,
"aria-hidden": true,
};
if (name === "check")
return (
<svg {...common}>
<path d="M9 11l3 3L22 4" />
<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
</svg>
);
if (name === "list")
return (
<svg {...common}>
<path d="M8 6h13M8 12h13M8 18h13" />
<path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
</svg>
);
if (name === "sliders")
return (
<svg {...common}>
<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
<path d="M1.5 14h5M9.5 8h5M17.5 16h5" />
</svg>
);
return (
<svg {...common}>
<path d="M3 10.5 12 3l9 7.5" />
<path d="M5 9.8V21h14V9.8" />
</svg>
);
}

// 初回説明（3ステップ）。文案を変えるときはここだけ直す
const ONBOARD_STEPS = [
{
title: "ようこそ、Enaemaへ",
body: "「今日の私を、もっと好きになる。」天気と​時間帯に​合わせて、​今日の​美容タスクを​一冊の​表紙で​お届けします。",
},
{
title: "タスクをタップ",
body: "表紙の​タスク名を​押すと、​キャラクターの​シーンが​流れます。​操作は​最小限。​眺めているだけで​大丈夫です。",
},
{
title: "ステータスを入れる",
body: "骨格・パーソナルカラーなどを​選ぶと、​表紙に​あなたの​情報が​載ります。​あとからでも​変更できます。",
},
];

function GlassPill(props: {
label: string;
icon: "check" | "list" | "sliders" | "home";
onClick: () => void;
}) {
return (
<button
type="button"
onClick={props.onClick}
className="pointer-events-auto flex items-center gap-1.5 whitespace-nowrap rounded-full py-1.5 pl-2.5 pr-3 text-[11px] font-medium shadow-sm transition active:scale-95"
style={{ background: "rgba(255,255,255,0.92)", color: "var(--text)" }}
>
<PillIcon name={props.icon} />
{props.label}
</button>
);
}


// 天気アイコン（表紙ボックス用）
function WeatherIcon({ name }: { name: string }) {
const common = {
width: 15,
height: 15,
viewBox: "0 0 24 24",
fill: "none",
stroke: "currentColor",
strokeWidth: 1.8,
strokeLinecap: "round" as const,
strokeLinejoin: "round" as const,
"aria-hidden": true,
};
if (name === "sun")
return (
<svg {...common}>
<circle cx="12" cy="12" r="4" />
<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
</svg>
);
if (name === "cloud")
return (
<svg {...common}>
<path d="M17.5 18a4.5 4.5 0 0 0 .4-8.98 6 6 0 0 0-11.7 1.62A4 4 0 0 0 7 18h10.5Z" />
</svg>
);
if (name === "snow")
return (
<svg {...common}>
<path d="M17.5 15a4.5 4.5 0 0 0 .4-8.98 6 6 0 0 0-11.7 1.62A4 4 0 0 0 7 15h10.5Z" />
<path d="M8 19h.01M12.5 19h.01M17 19h.01M10.2 22h.01M15 22h.01" />
</svg>
);
if (name === "storm")
return (
<svg {...common}>
<path d="M17.5 15a4.5 4.5 0 0 0 .4-8.98 6 6 0 0 0-11.7 1.62A4 4 0 0 0 7 15h10.5Z" />
<path d="M13 16l-2.5 4h3L11 23" />
</svg>
);
return (
<svg {...common}>
<path d="M17.5 15a4.5 4.5 0 0 0 .4-8.98 6 6 0 0 0-11.7 1.62A4 4 0 0 0 7 15h10.5Z" />
<path d="M8 19l-1 2M12.5 19l-1 2M17 19l-1 2" />
</svg>
);
}

// ステータスの小アイコン（顔=猫／肌=しずく／髪=流れ）
function StatusIcon({ name }: { name: "cat" | "drop" | "hair" }) {
const common = {
width: 11,
height: 11,
viewBox: "0 0 24 24",
fill: "none",
stroke: "currentColor",
strokeWidth: 2,
strokeLinecap: "round" as const,
strokeLinejoin: "round" as const,
"aria-hidden": true,
};
if (name === "cat")
return (
<svg {...common}>
<circle cx="12" cy="13.5" r="5.5" />
<path d="M7.5 9.5 6 5l4 2M16.5 9.5 18 5l-4 2" />
</svg>
);
if (name === "drop")
return (
<svg {...common}>
<path d="M12 3.5s5.5 5.8 5.5 9.3a5.5 5.5 0 1 1-11 0C6.5 9.3 12 3.5 12 3.5Z" />
</svg>
);
return (
<svg {...common}>
<path d="M5 19c-1-5 .5-8 2.5-10A5.5 5.5 0 0 1 17.5 9c2 2 3.5 5 2.5 10" />
<path d="M9.5 19.5c-.5-3.5.5-6 2.5-8" />
</svg>
);
}

type CoverWeather = {
label: string;
max: number;
min: number;
now: number | null;
condition: string;
conditionShort: string;
icon: string;
} | null;

// 表紙のキャッチは「今日の条件で変わる文言だけ」という原則に従い、天気で出し分ける
function coverCatch(weather: CoverWeather, situationName: string | null): string {
if (weather) {
if (weather.icon === "rain" || weather.icon === "storm")
return "雨の日は、崩れ対策を先手で。";
if (weather.icon === "snow") return "雪の日は、冷えと乾燥に気をつけて。";
if (weather.max >= 30) return "暑さで崩れやすい日。皮脂ケアを厚めに。";
if (weather.max <= 8) return "冷え込む日。保湿を厚めに。";
}
return situationName
? `${situationName}のルーチン、今日も整える。`
: "今日のルーチン、今日も整える。";
}

export default function HomeClient({
situations,
tasks,
heroUrl,
characterName,
imageBase,
tier: initialTier,
currentKey,
coverMeta,
}: Props) {
const [tier, setTier] = useState<Tier>(initialTier);
const [tierReady, setTierReady] = useState(false);
const [session, setSession] = useState<Session | null>(null);
const [consentNeeded, setConsentNeeded] = useState(false);
const [consentOpen, setConsentOpen] = useState(false);
const [onboardOpen, setOnboardOpen] = useState(false);
const [onboardStep, setOnboardStep] = useState(0);
const onboardShownRef = useRef(false);
const loadStartedRef = useRef(false);

// セッション確認（クライアント側）: 有効なセッション＋規約への同意があれば free に上げる
// 未同意なら同意シートを出す（同意するまで特典は使えない）。確認に失敗したらログインは妨げない
useEffect(() => {
let cancelled = false;
getSession()
.then(async (s) => {
if (cancelled) return;
setSession(s);
if (!s) {
setTier("no_login");
setTierReady(true);
return;
}
const c = await checkConsent(s);
if (cancelled) return;
if (c === "needed") {
setConsentNeeded(true);
setConsentOpen(true);
setTier("no_login");
} else {
setTier("free");
}
setTierReady(true);
})
.catch(() => {
if (!cancelled) setTierReady(true);
});
return () => {
cancelled = true;
};
}, []);

// 初回だけ自動で出す（同意シートが出ている間は待つ）。閉じたらフラグを立てて二度と出さない
useEffect(() => {
if (!tierReady || consentOpen || onboardShownRef.current) return;
let seen = false;
try {
seen = window.localStorage.getItem("enaema.onboarded.v1") === "1";
} catch {
seen = true;
}
if (!seen) {
onboardShownRef.current = true;
setOnboardStep(0);
setOnboardOpen(true);
}
}, [tierReady, consentOpen]);

const closeOnboarding = () => {
try {
window.localStorage.setItem("enaema.onboarded.v1", "1");
} catch {
// 保存できなくても閉じる
}
setOnboardOpen(false);
};

const openOnboarding = () => {
setOnboardStep(0);
setOnboardOpen(true);
};

const agreeConsent = async (): Promise<boolean> => {
if (!session) return false;
const ok = await recordConsent(session);
if (ok) {
setConsentNeeded(false);
setConsentOpen(false);
setTier("free");
}
return ok;
};

const visibleSituations = useMemo(
() => situations.filter((s) => canSeeSituation(tier, s.access_tier)),
[situations, tier]
);

const selectableBySituation = useMemo(() => {
const map: Record<string, Task[]> = {};
for (const s of visibleSituations) {
map[s.situation_id] = tasks
.filter(
(t) => t.situation_id === s.situation_id && canSelectTask(tier, t.order_index)
)
.sort((a, b) => a.order_index - b.order_index);
}
return map;
}, [visibleSituations, tasks, tier]);

const defaultSelection = useMemo<Record<string, number[]>>(() => {
const sel: Record<string, number[]> = {};
for (const s of visibleSituations) {
sel[s.situation_id] = (selectableBySituation[s.situation_id]?? []).map(
(t) => t.task_id
);
}
return sel;
}, [visibleSituations, selectableBySituation]);

const [selection, setSelection] = useState<Record<string, number[]>>(defaultSelection);
const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
const [editingProfile, setEditingProfile] = useState(false);
const [loaded, setLoaded] = useState(false);
const [editing, setEditing] = useState<string | null>(null);
const [panelOpen, setPanelOpen] = useState(false);
const [view, setView] = useState<"cover" | "stage">("cover");
const [slide, setSlide] = useState(0);
const [cycle, setCycle] = useState(0); // タップでタイマーを仕切り直すための世代カウンタ
const startedRef = useRef(false);

// v15.8: 天気の地域（8ヶ所ピンポイント）と天気ボックスの表示/非表示。端末内保存
const REGION_KEY = "enaema.region.v1";
const WEATHERBOX_KEY = "enaema.weatherbox.v1";
const [regionId, setRegionId] = useState("ginza");
const [showWeatherBox, setShowWeatherBox] = useState(true);
const [regionWeather, setRegionWeather] = useState<WeatherData | null>(null);
const currentRegion = REGIONS.find((r) => r.id === regionId)?? REGIONS[0];
const weatherNow: CoverWeather =
regionId === "ginza"? coverMeta.weather: (regionWeather?? coverMeta.weather);

useEffect(() => {
try {
const r = window.localStorage.getItem(REGION_KEY);
if (r && REGIONS.some((x) => x.id === r)) setRegionId(r);
const b = window.localStorage.getItem(WEATHERBOX_KEY);
if (b !== null) setShowWeatherBox(b === "1");
} catch {
// 読めなければ既定（銀座・表示）
}
}, []);

useEffect(() => {
try {
window.localStorage.setItem(REGION_KEY, regionId);
window.localStorage.setItem(WEATHERBOX_KEY, showWeatherBox? "1": "0");
} catch {
// 保存できなくても表示はそのまま
}
}, [regionId, showWeatherBox]);

useEffect(() => {
if (regionId === "ginza") {
setRegionWeather(null);
return;
}
const region = REGIONS.find((x) => x.id === regionId);
if (!region) return;
let cancelled = false;
fetchWeatherAt(region.lat, region.lon).then((w) => {
if (!cancelled) setRegionWeather(w);
});
return () => {
cancelled = true;
};
}, [regionId]);

useEffect(() => {
if (!tierReady || loadStartedRef.current) return;
loadStartedRef.current = true;
try {
const rawSet = window.localStorage.getItem(SET_KEY);
if (rawSet) {
const parsed = JSON.parse(rawSet) as Record<string, number[]>;
const cleaned: Record<string, number[]> = {};
for (const s of visibleSituations) {
const allowed = new Set(
(selectableBySituation[s.situation_id]?? []).map((t) => t.task_id)
);
const kept = (parsed[s.situation_id]?? []).filter((id) =>
allowed.has(id)
);
cleaned[s.situation_id] =
kept.length > 0? kept: defaultSelection[s.situation_id];
}
setSelection(cleaned);
}
const rawProfile = window.localStorage.getItem(PROFILE_KEY);
if (rawProfile) {
const parsedProfile = JSON.parse(rawProfile) as Partial<Profile>;
setProfile({ ...EMPTY_PROFILE, ...parsedProfile });
}
} catch {
// 読めなければ標準セット・未設定のまま
}
setLoaded(true);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [tierReady]);

useEffect(() => {
if (!loaded) return;
try {
window.localStorage.setItem(SET_KEY, JSON.stringify(selection));
} catch {
// 保存できなくても画面は動かす
}
}, [selection, loaded]);

useEffect(() => {
if (!loaded) return;
try {
window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
} catch {
// 同上
}
}, [profile, loaded]);

const currentSituation =
visibleSituations.find((s) => s.situation_id === currentKey)??
visibleSituations[0]??
null;

const selectedTasks = (situationId: string): Task[] => {
const ids = selection[situationId]?? [];
return (selectableBySituation[situationId]?? [])
.filter((t) => ids.includes(t.task_id))
.sort((a, b) => a.order_index - b.order_index);
};

const deck = currentSituation? selectedTasks(currentSituation.situation_id): [];

const slides: Slide[] = useMemo(() => {
const list: Slide[] = [];
for (const t of deck) {
list.push({ key: `task-${t.task_id}`, imageUrl: `${imageBase}${t.image_path}`, task: t});
}
return list;
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [heroUrl, imageBase, deck.map((t) => t.task_id).join(",")]);

// 初回だけ、開始位置を時刻に合わせる（いまのシーンから）
useEffect(() => {
if (startedRef.current || slides.length <= 1 ||!currentSituation) return;
startedRef.current = true;
const sceneIdx = timeSceneIndex(currentSituation.situation_id, deck.length);
setSlide(sceneIdx);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [slides.length]);

// 自動再生（6秒ごと）。タップで次へ＋タイマー仕切り直し
useEffect(() => {
if (slides.length <= 1 || onboardOpen || consentOpen) return;
const id = window.setInterval(() => {
setSlide((prev) => (prev + 1) % slides.length);
}, 6000);
return () => window.clearInterval(id);
}, [slides.length, cycle, onboardOpen, consentOpen]);

const advance = () => {
if (slides.length <= 1) return;
setSlide((prev) => (prev + 1) % slides.length);
setCycle((c) => c + 1);
};

const toggleSelected = (situationId: string, taskId: number) => {
setSelection((prev) => {
const cur = prev[situationId]?? [];
const next = cur.includes(taskId)
? cur.filter((id) => id!== taskId)
: [...cur, taskId];
return {...prev, [situationId]: next};
});
};

// 3ボタン（README）: 新規セット=標準に戻して編集を開く／前回の続き=保存済みセットのまま先頭から／やり直し=先頭から再生
const startNewSet = () => {
setSelection(defaultSelection);
if (currentSituation) setEditing(currentSituation.situation_id);
};
const playFromTop = () => {
setSlide(0);
setCycle((c) => c + 1);
};

const current = slides[Math.min(slide, Math.max(slides.length - 1, 0))]?? null;
const playingTaskId = current?.task?.task_id?? null;

const toggleProfileOption = (key: keyof Profile, value: string) => {
setProfile((prev) => ({ ...prev, [key]: prev[key] === value? "": value }));
};
const baseStatus = [profile.bone, profile.pc].filter(Boolean).join("×");
const extraStatus = tier === "no_login"? "": [profile.face, profile.skin, profile.hair].filter(Boolean).join("・");
const statusRows: { icon: "cat" | "drop" | "hair"; value: string }[] = [];
if (tier !== "no_login") {
if (profile.face) statusRows.push({ icon: "cat", value: profile.face });
if (profile.skin) statusRows.push({ icon: "drop", value: profile.skin });
if (profile.hair) statusRows.push({ icon: "hair", value: profile.hair });
}

const editingSituation = editing
? visibleSituations.find((s) => s.situation_id === editing)?? null
: null;

const coverTasks = slides.flatMap((s) => (s.task? [s.task]: []));

// v15.7: 「ずれ」があるときだけ、ずれを踏まえたひとことをロール用に端末内へ渡す。
// セット自体はユーザーの選択なので変えない。パターンは 肌×天気 の組み合わせで決め、
// 文案は日替わりで回して同じ文が続かないようにする。ずれがない日は何も渡さない。
const adviceNamesKey = coverTasks.map((t) => t.task_name).join("|");
useEffect(() => {
if (!loaded) return;
const w = weatherNow;
const dayIdx = Math.floor(Date.now() / 86400000);
const pick = (variants: string[], seed: number) => variants[(dayIdx + seed) % variants.length];
const lines: string[] = [];
if (w) {
const rainy = w.icon === "rain" || w.icon === "storm";
const dryClear = (w.icon === "sun" || w.icon === "cloud") && w.max <= 15;
const hotHumid = rainy || w.max >= 26;
if (profile.skin === "乾燥肌" && rainy) {
lines.push(pick([
"今日は雨で皮脂対策の日。乾燥肌なので、あぶらとりのあとは保湿ミストを",
"雨の日は湿気ケアが主役。乾燥肌のあなたは、仕上げに保湿をひと足し",
"皮脂対策の日でも、乾燥肌は落としすぎ注意。うるおいは別で足して",
], 1));
} else if (profile.skin === "乾燥肌" && dryClear) {
lines.push(pick([
"空気が乾く日。乾燥肌は保湿を「量より回数」で重ねて",
"晴れても油断大敵。乾燥肌の日は、朝の保湿をいつもより丁寧に",
"乾いた風の日。メイク前の保湿で、夕方のカサつきを先回り",
], 2));
} else if (profile.skin === "脂性肌" && hotHumid) {
lines.push(pick([
"皮脂が出やすい日。落とすケアのあとも、薄い保湿でフタをして",
"湿気でテカリやすい日。あぶらとりは優しく1枚、押し当てずに",
"暑さと湿気の日。さっぱり仕上げでも、保湿ゼロにはしないで",
], 3));
} else if (profile.skin === "脂性肌" && dryClear) {
lines.push(pick([
"脂性肌でも、乾く季節は乾燥します。落としすぎは逆に皮脂を呼びます",
"冬の晴れの日。脂性肌こそ、洗いすぎ注意でやさしく落として",
"皮脂が気になる日でも、乾燥する日は保湿を抜かないで",
], 4));
}
}
if (lines.length < 2 && profile.skin === "乾燥肌" && /皮脂|あぶらとり|テカリ/.test(adviceNamesKey)) {
lines.push(pick([
"今日のセットは皮脂対策寄り。乾燥肌なので、あぶらとりのあとは保湿ミストを",
"皮脂ケアの日でも、乾燥肌は仕上げのうるおいを忘れずに",
], 5));
}
if (lines.length < 2 && profile.skin === "敏感肌" && /スクラブ|ピーリング/.test(adviceNamesKey)) {
lines.push(pick([
"今日のセットに強いケアが入っています。敏感肌の日は、お休みしても大丈夫",
"敏感肌の日は攻めのケアは控えめに。やさしい保湿を中心に",
], 6));
}
try {
window.localStorage.setItem("enaema.advice.v1", JSON.stringify(lines.slice(0, 2)));
} catch {
// 保存できなくても表示はそのまま
}
}, [loaded, profile, adviceNamesKey, weatherNow]);

return (
<>
{/* 舞台: シーンが主役。字幕とストーリーバーだけを重ね、操作は下の細い帯とパネルに沈める */}
<section className="flex h-full flex-col pt-2">
{view === "cover"? (
<>
{/* 表紙 v13: フルブリード＋表紙の組版（天気ボックス／特大カバーライン／ステータス）を画像の上に組む。表紙はハブ：全面タップで再生、カバーラインのタップでそのシーンへ */}
<div className="relative -mx-4 min-h-0 flex-1 overflow-hidden">
<button
type="button"
aria-label="ルーチンを再生"
onClick={() => {
setView("stage");
playFromTop();
}}
className="absolute inset-0 h-full w-full"
/>
{heroUrl? (
<img
src={heroUrl}
alt=""
className="absolute inset-0 h-full w-full object-cover object-top"
style={{ transform: "translateY(48px)" }}
/>
): null}
<span className="pointer-events-none absolute inset-x-0 top-0 block h-44 bg-gradient-to-b from-[#F7EEDD]/95 via-[#F7EEDD]/45 to-transparent" />
<span className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-3">
{showWeatherBox && weatherNow? (
<span
className="flex items-start gap-2 px-1 py-1 text-[11px] leading-snug"
style={{ color: "var(--text)" }}
>
<span className="mt-0.5 shrink-0">
<WeatherIcon name={weatherNow.icon} />
</span>
<span>
<span className="block font-bold tracking-wider">
{currentRegion.en} {weatherNow.max}° / {weatherNow.min}°
{weatherNow.now !== null && (
<span className="font-medium">（いま{weatherNow.now}°）</span>
)}
</span>
<span className="block" style={{ color: "var(--muted)" }}>
{weatherNow.label}・{weatherNow.conditionShort}
</span>
</span>
</span>
): (
<span />
)}
<span
className="block px-1 py-1 text-right"
style={{ color: "var(--text)" }}
>
<span className="block whitespace-nowrap text-[10px] tracking-widest">
{coverMeta.todayLabel}
</span>
<span
className="my-1 block border-t"
style={{ borderColor: "rgba(43,35,32,0.35)" }}
/>
<span
className="block text-[30px] font-semibold leading-tight"
style={{ fontFamily: "var(--font-display)" }}
>
Enaema
</span>
<span
className="block text-[10px] leading-[1.7] tracking-[0.14em]"
style={{ color: "rgba(43,35,32,0.85)", maxWidth: "34vw", marginLeft: "auto", textAlign: "right" }}
>
今日の私を、
<br />
もっと好きになる。
</span>
</span>
</span>
<span className="pointer-events-none absolute inset-x-0 bottom-0 block bg-gradient-to-t from-[#F7EEDD]/95 via-[#F7EEDD]/70 to-transparent px-4 pb-14 pt-20" style={{ color: "var(--text)" }}>
<span className="flex items-end justify-between gap-3">
<span className="block">
<span
className="mb-2 block text-[16px] italic leading-none"
style={{
fontFamily: "var(--font-display)",
color: "#B76E79",
textShadow: "0 0 8px rgba(247,238,221,0.9)",
transform: "rotate(-5deg)",
transformOrigin: "left center",
}}
>
Today's Tasks
</span>
{coverTasks.length > 0? (
<span className="pointer-events-auto block space-y-1">
{coverTasks.map((t, i) => (
<button
key={t.task_id}
type="button"
onClick={() => {
startedRef.current = true;
setView("stage");
setSlide(i);
setCycle((c) => c + 1);
}}
className={
i === 0
? "block text-left text-[30px] font-bold leading-snug [text-shadow:0_0_10px_rgba(247,238,221,0.95),0_0_3px_rgba(247,238,221,0.95)]"
: "block text-left text-[25px] font-bold leading-snug [text-shadow:0_0_10px_rgba(247,238,221,0.95),0_0_3px_rgba(247,238,221,0.95)]"
}
style={{ fontFamily: "var(--font-display-jp)", letterSpacing: "0.04em" }}
>
{t.task_name}
</button>
))}
</span>
): (
<span
className="block text-[27px] font-bold leading-tight"
style={{ fontFamily: "var(--font-display-jp)", letterSpacing: "0.04em" }}
>
今日のルーチン
</span>
)}
<span
className="mt-3 block border-b-2 pb-1 text-[15px] font-medium"
style={{ borderColor: "#B76E79", fontFamily: "var(--font-display-jp)", letterSpacing: "0.03em" }}
>
{currentSituation
? coverCatch(weatherNow, currentSituation.name)
: coverCatch(weatherNow, null)}
</span>
<span
className="mt-2 block text-[15px] italic leading-none"
style={{
fontFamily: "var(--font-display)",
color: "#B76E79",
textShadow: "0 0 8px rgba(247,238,221,0.9)",
transform: "rotate(-5deg)",
transformOrigin: "left center",
}}
>
Make today the best day
</span>
</span>
{(baseStatus || extraStatus) && (
<button type="button" onClick={() => setEditingProfile(true)} className="pointer-events-auto block shrink-0 text-right text-[11px] leading-relaxed [text-shadow:0_0_6px_rgba(247,238,221,0.95)]">
{statusRows.map((r, i) => (
<span
key={r.value}
className="flex items-center justify-end gap-1.5 tracking-[0.2em]"
style={
i > 0
? { borderTop: "1px solid rgba(43,35,32,0.18)", marginTop: 3, paddingTop: 3 }
: undefined
}
>
<StatusIcon name={r.icon} />
{r.value}
</span>
))}
{baseStatus && (
<span className="mt-1 block font-medium">骨格{baseStatus}</span>
)}
</button>
)}
</span>
</span>
<span className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 px-4 pb-3.5">
{currentSituation && (
<GlassPill
label="タスクを選ぶ"
icon="check"
onClick={() => setEditing(currentSituation.situation_id)}
/>
)}
<GlassPill label="セット一覧" icon="list" onClick={() => setPanelOpen(true)} />
<GlassPill label="ステータス" icon="sliders" onClick={() => setEditingProfile(true)} />
</span>
</div>
</>
): (
<>
{/* 舞台 v14.1: 画面そのものが舞台（全面画像／バーと字幕と操作は画像の中） */}
{current && (
<div className="relative -mx-4 min-h-0 flex-1 overflow-hidden">
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
key={current.key}
src={current.imageUrl}
alt={current.task? current.task.task_name: characterName}
className="absolute inset-0 h-full w-full object-cover"
/>
<button
type="button"
onClick={advance}
className="absolute inset-0 h-full w-full"
aria-label="次のシーンへ"
/>
<span className="pointer-events-none absolute inset-x-0 bottom-0 block bg-[linear-gradient(to_top,rgba(247,238,221,0.97),rgba(247,238,221,0.6)_55%,rgba(247,238,221,0))] px-4 pb-3 pt-16 text-left" style={{ color: "var(--text)" }}>
<span className="mb-2 flex gap-1">
{slides.map((s, i) => (
<span
key={s.key}
className="h-[3px] flex-1 rounded-full"
style={{
background:
i <= Math.min(slide, slides.length - 1)
? "var(--text)"
: "rgba(43,35,32,0.25)",
}}
/>
))}
</span>
{currentSituation && (
<span
className="block text-[10px] tracking-widest"
style={{ color: "rgba(43,35,32,0.6)" }}
>
{currentSituation.name}のルーチン
</span>
)}
{current.task && (
<>
<span
className="mt-0.5 block text-[17px] font-bold"
style={{ fontFamily: "var(--font-display-jp)" }}
>
{current.task.task_name}
</span>
{current.task.dialogue && (
<span
className="mt-0.5 block text-xs leading-relaxed"
style={{ color: "rgba(43,35,32,0.75)" }}
>
{current.task.dialogue}
</span>
)}
</>
)}
<span className="pointer-events-auto mt-2.5 flex justify-end gap-2">
<GlassPill label="表紙" icon="home" onClick={() => setView("cover")} />
<GlassPill label="一覧" icon="list" onClick={() => setPanelOpen(true)} />
{currentSituation && (
<GlassPill
label="タスクを選ぶ"
icon="check"
onClick={() => setEditing(currentSituation.situation_id)}
/>
)}
<GlassPill label="ステータス" icon="sliders" onClick={() => setEditingProfile(true)} />
</span>
</span>
</div>
)}
{!current && (
<div
className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm"
style={{ color: "var(--muted)"}}
>
いまの時間帯のセットがまだありません。「セット一覧」から作れます。
</div>
)}
</>
)}
</section>

{/* 中身: 時間帯ごとの記事リストは「一覧」パネル内（ホーム自体は1画面に収める） */}
<div
className={panelOpen? "fixed inset-0 z-40 overflow-y-auto": "hidden"}
style={panelOpen? { background: "var(--bg)" }: undefined}
>
<div className="mx-auto w-full max-w-md px-4 pb-12">
<div className="flex items-baseline justify-between pt-6">
<p className="text-base font-bold">今日のセット一覧</p>
<button
type="button"
onClick={() => setPanelOpen(false)}
className="text-xs"
style={{ color: "var(--muted)" }}
>
閉じる
</button>
</div>
<div
className="mt-3 flex items-center gap-2 text-[11px]"
style={{ color: "var(--muted)" }}
>
<span>アカウント</span>
<LoginButton />
{consentNeeded && (
<button
type="button"
onClick={() => setConsentOpen(true)}
className="underline"
style={{ color: "var(--accent)" }}
>
利用規約への同意が必要です
</button>
)}
</div>
<button
type="button"
onClick={openOnboarding}
className="mt-2 block text-[11px] underline"
style={{ color: "var(--muted)" }}
>
使い方を見る
</button>
<div
className="mt-4 flex gap-2 border-b pb-4"
style={{ borderColor: "var(--line)" }}
>
<button
type="button"
onClick={startNewSet}
className="rounded-full border bg-white/70 px-3 py-1.5 text-[11px]"
style={{ borderColor: "var(--line)", color: "var(--text)" }}
>
新規セット
</button>
<button
type="button"
onClick={() => {
setPanelOpen(false);
playFromTop();
}}
className="rounded-full border bg-white/70 px-3 py-1.5 text-[11px]"
style={{ borderColor: "var(--line)", color: "var(--text)" }}
>
前回の続き
</button>
<button
type="button"
onClick={() => {
setPanelOpen(false);
playFromTop();
}}
className="rounded-full border bg-white/70 px-3 py-1.5 text-[11px]"
style={{ borderColor: "var(--line)", color: "var(--text)" }}
>
やり直し
</button>
</div>
{visibleSituations.map((situation) => {
const items = selectedTasks(situation.situation_id);
const isCurrent = currentSituation?.situation_id === situation.situation_id;
return (
<section
key={situation.situation_id}
id={`situation-${situation.situation_id}`}
className="mt-10 scroll-mt-4"
>
<div
className="flex items-baseline justify-between border-b-2 pb-2"
style={{ borderColor: "var(--text)"}}
>
<h2 className="text-lg font-bold">{situation.name}</h2>
<span className="text-[11px]" style={{ color: "var(--muted)"}}>
{isCurrent && "いまの時間帯・"}
{items.length}つのタスク
{"　"}
<button
type="button"
onClick={() => setEditing(situation.situation_id)}
className="rounded-full border bg-white/70 px-2.5 py-0.5 text-[11px]"
style={{ borderColor: "var(--line)", color: "var(--text)" }}
>
セットを変える
</button>
</span>
</div>
{items.length === 0? (
<p className="py-4 text-xs" style={{ color: "var(--muted)"}}>
この時間帯のタスクは未セットです。「セットを変える」から選んでください。
</p>
): (
<ul>
{items.map((task) => (
<li
key={task.task_id}
className="flex gap-3 border-b py-3"
style={{ borderColor: "var(--line)"}}
>
<span
className="w-6 shrink-0 pt-1 text-right text-sm"
style={{
color: "var(--accent-gold)",
fontFamily: "var(--font-display)",
}}
>
{String(task.order_index).padStart(2, "0")}
</span>
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
src={`${imageBase}${task.image_path}`}
alt={task.task_name}
className="h-[84px] w-[68px] shrink-0 rounded-md object-cover"
loading="lazy"
/>
<div className="min-w-0 pt-1">
<p className="text-[15px] font-medium">{task.task_name}</p>
{task.task_id === playingTaskId && (
<p className="mt-0.5 text-[10px]" style={{ color: "var(--accent)"}}>
いま流れています
</p>
)}
{task.dialogue && (
<p
className="mt-1 text-xs leading-relaxed"
style={{ color: "var(--muted)"}}
>
{task.dialogue}
</p>
)}
</div>
</li>
))}
</ul>
)}
</section>
);
})}
</div>
</div>

{/* セット編集ポップアップ（README: デフォルト項目をポップアップから選択） */}
{editingSituation && (
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
<div
className="max-h-[85vh] w-full max-w-md overflow-y-auto border-t-2 bg-[var(--surface)] p-4"
style={{ borderColor: "var(--text)"}}
>
<div className="flex items-baseline justify-between">
<h3 className="text-base font-bold">
{editingSituation.name}のセット
</h3>
<button
type="button"
onClick={() => setEditing(null)}
className="text-xs"
style={{ color: "var(--muted)"}}
>
閉じる
</button>
</div>
<nav className="mt-3 text-xs">
{visibleSituations.map((s, i) => (
<span key={s.situation_id}>
{i > 0 && <span style={{ color: "var(--muted)"}}>｜</span>}
<button
type="button"
onClick={() => setEditing(s.situation_id)}
className={s.situation_id === editing? "font-bold": ""}
style={
s.situation_id === editing
? { color: "var(--accent)"}
: { color: "var(--muted)"}
}
>
{s.name}
</button>
</span>
))}
</nav>
<ul className="mt-3">
{(selectableBySituation[editingSituation.situation_id]?? []).map(
(task) => {
const selected = (
selection[editingSituation.situation_id]?? []
).includes(task.task_id);
return (
<li
key={task.task_id}
className="border-b"
style={{ borderColor: "var(--line)"}}
>
<button
type="button"
onClick={() =>
toggleSelected(editingSituation.situation_id, task.task_id)
}
className="flex w-full items-center gap-3 py-3 text-left"
>
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
src={`${imageBase}${task.image_path}`}
alt={task.task_name}
className="h-[52px] w-[42px] shrink-0 rounded-md object-cover"
loading="lazy"
/>
<span
className="text-[15px]"
style={
selected
? { fontWeight: 700}
: { color: "var(--muted)"}
}
>
{task.task_name}
</span>
<span
className={
selected
? "ml-auto shrink-0 text-xs font-bold"
: "ml-auto shrink-0 rounded-full border px-3 py-1 text-xs"
}
style={
selected
? { color: "var(--accent)"}
: { borderColor: "var(--accent)", color: "var(--accent)" }
}
>
{selected? "✓ セット中": "追加する"}
</span>
</button>
</li>
);
}
)}
</ul>
<button
type="button"
onClick={() => setEditing(null)}
className="mt-4 w-full rounded-full border py-3 text-sm font-bold"
style={{ borderColor: "var(--text)"}}
>
この内容でセットする
</button>
</div>
</div>
)}
{/* ステータス入力ポップアップ */}
{editingProfile && (
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
<div
className="max-h-[85vh] w-full max-w-md overflow-y-auto border-t-2 bg-[var(--surface)] p-4"
style={{ borderColor: "var(--text)"}}
>
<div className="flex items-baseline justify-between">
<h3 className="text-base font-bold">あなたのステータス</h3>
<button
type="button"
onClick={() => setEditingProfile(false)}
className="text-xs"
style={{ color: "var(--muted)"}}
>
閉じる
</button>
</div>
{PROFILE_FIELDS.map((field) => (
<div key={field.key} className="mt-4">
<p className="text-sm font-bold">{field.label}</p>
{field.loginOnly && tier === "no_login" && (
<p className="mt-0.5 text-[11px]" style={{ color: "var(--muted)"}}>
ログインすると表紙に出ます（入力は今できます）
</p>
)}
<div className="mt-2 flex flex-wrap gap-2">
{field.options.map((opt) => {
const selected = profile[field.key] === opt;
return (
<button
key={opt}
type="button"
onClick={() => toggleProfileOption(field.key, opt)}
className="rounded-full border px-3.5 py-1.5 text-[13px]"
style={
selected
? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 700, background: "rgba(166,39,43,0.06)" }
: { borderColor: "var(--line)", color: "var(--muted)" }
}
>
{opt}
</button>
);
})}
</div>
</div>
))}
<div className="mt-4">
<p className="text-sm font-bold">天気の地域</p>
<div className="mt-2 flex flex-wrap gap-2">
{REGIONS.map((r) => {
const selected = regionId === r.id;
return (
<button
key={r.id}
type="button"
onClick={() => setRegionId(r.id)}
className="rounded-full border px-3.5 py-1.5 text-[13px]"
style={
selected
? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 700, background: "rgba(166,39,43,0.06)" }
: { borderColor: "var(--line)", color: "var(--muted)" }
}
>
{r.name}
</button>
);
})}
</div>
</div>
<div className="mt-4">
<p className="text-sm font-bold">天気ボックス</p>
<div className="mt-2 flex flex-wrap gap-2">
{([true, false] as const).map((v) => {
const selected = showWeatherBox === v;
return (
<button
key={String(v)}
type="button"
onClick={() => setShowWeatherBox(v)}
className="rounded-full border px-3.5 py-1.5 text-[13px]"
style={
selected
? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 700, background: "rgba(166,39,43,0.06)" }
: { borderColor: "var(--line)", color: "var(--muted)" }
}
>
{v? "表示": "非表示"}
</button>
);
})}
</div>
</div>
<button
type="button"
onClick={() => setEditingProfile(false)}
className="mt-5 w-full rounded-full border py-3 text-sm font-bold"
style={{ borderColor: "var(--text)"}}
>
この内容で表紙に出す
</button>
</div>
</div>
)}
{consentOpen && session && (
<ConsentSheet
onAgree={agreeConsent}
onLater={() => setConsentOpen(false)}
/>
)}
{onboardOpen && (
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
<div
className="w-full max-w-md border-t-2 bg-[var(--surface)] p-5"
style={{ borderColor: "var(--text)" }}
>
<p
className="text-[11px] tracking-[0.3em]"
style={{ color: "var(--muted)" }}
>
{onboardStep + 1} / 3
</p>
<h3
className="mt-1 text-base font-bold"
style={{ fontFamily: "var(--font-display-jp)" }}
>
{ONBOARD_STEPS[onboardStep].title}
</h3>
<p
className="mt-2 text-[13px] leading-relaxed [word-break:auto-phrase]"
style={{ color: "var(--muted)" }}
>
{ONBOARD_STEPS[onboardStep].body}
</p>
{onboardStep < 2 ? (
<>
<button
type="button"
onClick={() => setOnboardStep(onboardStep + 1)}
className="mt-4 w-full rounded-full border py-3 text-sm font-bold"
style={{ borderColor: "var(--text)" }}
>
つぎへ
</button>
<button
type="button"
onClick={closeOnboarding}
className="mt-2 w-full py-2 text-xs"
style={{ color: "var(--muted)" }}
>
スキップ
</button>
</>
) : (
<>
<button
type="button"
onClick={() => {
closeOnboarding();
setEditingProfile(true);
}}
className="mt-4 w-full rounded-full border py-3 text-sm font-bold"
style={{ borderColor: "var(--text)" }}
>
ステータスを入れる
</button>
<button
type="button"
onClick={closeOnboarding}
className="mt-2 w-full py-2 text-xs"
style={{ color: "var(--muted)" }}
>
あとで
</button>
</>
)}
</div>
</div>
)}
</>
);
}
