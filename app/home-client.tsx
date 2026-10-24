"use client";

// Enaema ホーム（表紙＋スライド）クライアント部品 v7
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
task: Task | null; // null = 表紙スライド
};

export default function HomeClient({
situations,
tasks,
heroUrl,
characterName,
imageBase,
tier,
currentKey,
}: Props) {
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
const [slide, setSlide] = useState(0);
const [cycle, setCycle] = useState(0); // タップでタイマーを仕切り直すための世代カウンタ
const startedRef = useRef(false);

useEffect(() => {
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
}, []);

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
if (heroUrl) list.push({ key: "cover", imageUrl: heroUrl, task: null});
for (const t of deck) {
list.push({ key: `task-${t.task_id}`, imageUrl: `${imageBase}${t.image_path}`, task: t});
}
return list;
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [heroUrl, imageBase, deck.map((t) => t.task_id).join(",")]);

// 初回だけ、開始位置を時刻に合わせる（表紙の次＝いまのシーン）
useEffect(() => {
if (startedRef.current || slides.length <= 1 ||!currentSituation) return;
startedRef.current = true;
const sceneIdx = timeSceneIndex(currentSituation.situation_id, deck.length);
setSlide(heroUrl? sceneIdx + 1: sceneIdx);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [slides.length]);

// 自動再生（6秒ごと）。タップで次へ＋タイマー仕切り直し
useEffect(() => {
if (slides.length <= 1) return;
const id = window.setInterval(() => {
setSlide((prev) => (prev + 1) % slides.length);
}, 6000);
return () => window.clearInterval(id);
}, [slides.length, cycle]);

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

const editingSituation = editing
? visibleSituations.find((s) => s.situation_id === editing)?? null
: null;

return (
<>
{/* 表紙＋スライド: メインビジュアルが時間とともに流れる */}
<section className="mt-4">
{current && (
<button
type="button"
onClick={advance}
className="relative block w-full"
aria-label="次のシーンへ"
>
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
key={current.key}
src={current.imageUrl}
alt={current.task? current.task.task_name: characterName}
className="aspect-[3/4] w-full rounded-md object-cover"
/>
<span
className="absolute right-2 top-2 bg-[var(--surface)] px-2 py-0.5 text-[10px]"
style={{ color: "var(--muted)"}}
>
{Math.min(slide + 1, slides.length)} / {slides.length}
</span>
</button>
)}
<div
className="relative mx-3 -mt-8 border bg-[var(--surface)] p-4"
style={{ borderColor: "var(--text)"}}
>
{currentSituation && (
<h2 className="text-lg font-bold">

</h2>
)}
{current?.task? (
<p className="mt-1 text-[15px] font-medium">
いま：{current.task.task_name}
{current.task.dialogue && (
<span
className="mt-0.5 block text-xs font-normal leading-relaxed"
style={{ color: "var(--muted)"}}
>
{current.task.dialogue}
</span>
)}
</p>
): (
<p
className="mt-1 text-[13px] leading-relaxed"
style={{ color: "var(--muted)"}}
>
朝から寝る前まで、今日の美容ルーチン。
</p>
)}
<ul className="mt-3 space-y-2">
{deck.map((task) => {
const isPlaying = task.task_id === playingTaskId;
return (
<li key={task.task_id} className="flex items-baseline gap-2">
<span
className="shrink-0 text-sm"
style={{
color: "var(--accent-gold)",
fontFamily: "var(--font-display)",
}}
>
{String(task.order_index).padStart(2, "0")}
</span>
<span
className="text-[15px] leading-snug"
style={
isPlaying
? { fontWeight: 700, color: "var(--accent)"}
: { fontWeight: 500}
}
>
{task.task_name}
</span>
{isPlaying && (
<span className="text-[10px]" style={{ color: "var(--muted)"}}>
― いま流れています
</span>
)}
</li>
);
})}
</ul>
{/* ステータス（表紙に刷られる属性） */}
<div
className="mt-4 flex items-baseline justify-between gap-2 border-t pt-3 text-[11px]"
style={{ borderColor: "var(--line)", color: "var(--muted)"}}
>
<span>{baseStatus? `骨格${baseStatus}`: "ステータスを入れると、あなたの表紙になります"}</span>
<span className="flex items-baseline gap-2">
{extraStatus && <span>{extraStatus}</span>}
<button type="button" onClick={() => setEditingProfile(true)} className="underline">
ステータスを入力
</button>
</span>
</div>
{/* 3ボタン＋編集導線 */}
<div
className="mt-4 flex items-center justify-between border-t pt-3 text-[11px]"
style={{ borderColor: "var(--line)", color: "var(--muted)"}}
>
<div className="flex gap-3">
<button type="button" onClick={startNewSet} className="underline">
新規セット
</button>
<button type="button" onClick={playFromTop} className="underline">
前回の続き
</button>
<button type="button" onClick={playFromTop} className="underline">
やり直し
</button>
</div>
{currentSituation && (
<button
type="button"
onClick={() => setEditing(currentSituation.situation_id)}
className="underline"
>
タスクを編集
</button>
)}
</div>
</div>
</section>

{/* 中身: 時間帯ごとに、選んだタスクだけ（記事風リスト・眺める用） */}
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
<h2 className="text-lg font-bold"></h2>
<span className="text-[11px]" style={{ color: "var(--muted)"}}>
{isCurrent && "いまの時間帯・"}
{items.length}つのタスク
{"　"}
<button
type="button"
onClick={() => setEditing(situation.situation_id)}
className="underline"
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

{/* セット編集ポップアップ（README: デフォルト項目をポップアップから選択） */}
{editingSituation && (
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
<div
className="max-h-[85vh] w-full max-w-md overflow-y-auto border-t-2 bg-[var(--surface)] p-4"
style={{ borderColor: "var(--text)"}}
>
<div className="flex items-baseline justify-between">
<h3 className="text-base font-bold">

</h3>
<button
type="button"
onClick={() => setEditing(null)}
className="text-xs underline"
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
className="ml-auto shrink-0 text-xs"
style={
selected
? { color: "var(--accent)"}
: { color: "var(--muted)"}
}
>
{selected? "セット中": "追加する"}
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
className="mt-4 w-full border py-3 text-sm font-bold"
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
<h3 className="text-base font-bold">【あなたのステータス】</h3>
<button
type="button"
onClick={() => setEditingProfile(false)}
className="text-xs underline"
style={{ color: "var(--muted)"}}
>
閉じる
</button>
</div>
{PROFILE_FIELDS.map((field) => (
<div key={field.key} className="mt-4">
<p className="text-sm font-bold">【{field.label}】</p>
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
className="border px-3 py-1.5 text-[13px]"
style={
selected
? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 700 }
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
<button
type="button"
onClick={() => setEditingProfile(false)}
className="mt-5 w-full border py-3 text-sm font-bold"
style={{ borderColor: "var(--text)"}}
>
この内容で表紙に出す
</button>
</div>
</div>
)}
</>
);
}
