"use client";

// Enaema ホームクライアント部品 v12.3（カバーラインの項目名を Task.task_name に修正：型エラーの解消）
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
import { getSession } from "./auth-client";

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
task: Task | null; // 舞台はタスクシーンのみ（表紙はホーム側で heroUrl を直接使う）
};

export default function HomeClient({
situations,
tasks,
heroUrl,
characterName,
imageBase,
tier: initialTier,
currentKey,
}: Props) {
const [tier, setTier] = useState<Tier>(initialTier);
const [tierReady, setTierReady] = useState(false);
const loadStartedRef = useRef(false);

// セッション確認（クライアント側）: 有効なセッションがあれば free に上げる
useEffect(() => {
let cancelled = false;
getSession()
.then((s) => {
if (cancelled) return;
setTier(s? "free": "no_login");
setTierReady(true);
})
.catch(() => {
if (!cancelled) setTierReady(true);
});
return () => {
cancelled = true;
};
}, []);

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

const coverTasks = slides.flatMap((s) => (s.task? [s.task]: []));

return (
<>
{/* 舞台: シーンが主役。字幕とストーリーバーだけを重ね、操作は下の細い帯とパネルに沈める */}
<section className="flex h-full flex-col pt-2">
{view === "cover"? (
<>
{/* 表紙（メインホーム）: ヒーロー＋カバーライン。タップで舞台へ */}
<button
type="button"
onClick={() => {
setView("stage");
playFromTop();
}}
className="relative block min-h-0 w-full flex-1 overflow-hidden rounded-md text-left"
>
{heroUrl? (
<img
src={heroUrl}
alt=""
className="absolute inset-0 h-full w-full object-cover"
/>
): null}
<span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/60 via-black/25 to-transparent px-4 pb-4 pt-14 text-white">
<span className="block text-[11px] tracking-[0.25em] opacity-90">
今日の表紙
</span>
<span className="mt-1 block text-[22px] font-bold leading-snug">
{currentSituation
? `${currentSituation.name}のルーチン、今日も整える。`
: "今日のルーチン"}
</span>
{coverTasks.length > 0 && (
<span className="mt-3 block space-y-1">
{coverTasks.map((t) => (
<span key={t.task_id} className="block text-[13px]">
<span style={{ color: "#EBCB8B"}}>◆</span> {t.task_name}
</span>
))}
</span>
)}
</span>
</button>
<div
className="shrink-0 px-1 pb-1 pt-2 text-[11px]"
style={{ color: "var(--muted)"}}
>
<p>
{baseStatus
? `骨格${baseStatus}${extraStatus? ` ・ ${extraStatus}`: ""}`
: "ステータスを入れると、あなたの表紙になります"}
</p>
<div className="mt-1 flex justify-end gap-3">
<button
type="button"
onClick={() => {
setView("stage");
playFromTop();
}}
className="underline"
>
ルーチンを再生
</button>
<button type="button" onClick={() => setPanelOpen(true)} className="underline">
セット一覧
</button>
<button type="button" onClick={() => setEditingProfile(true)} className="underline">
ステータスを入力
</button>
</div>
</div>
</>
): (
<>
{/* ストーリーバー: 画像の外（上の帯）に置き、キャラに線を重ねない */}
<div className="flex shrink-0 gap-1 px-1 pb-2">
{slides.map((s, i) => (
<span
key={s.key}
className="h-[3px] flex-1 rounded-full"
style={{
background:
i <= Math.min(slide, slides.length - 1)
? "var(--accent)"
: "rgba(43,35,32,0.18)",
}}
/>
))}
</div>
{current && (
<button
type="button"
onClick={advance}
className="relative block min-h-0 w-full flex-1"
aria-label="次のシーンへ"
>
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
key={current.key}
src={current.imageUrl}
alt={current.task? current.task.task_name: characterName}
className="absolute inset-0 h-full w-full rounded-md object-cover"
/>
{/* 字幕: シーンの言葉だけを下部に重ねる（セリフはDBの dialogue、入れば自動で出る） */}
<span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/55 via-black/25 to-transparent px-3 pb-3 pt-10 text-left">
{currentSituation && (
<span className="block text-[10px] tracking-widest text-white/75">
{currentSituation.name}のルーチン
</span>
)}
{current.task && (
<>
<span className="mt-0.5 block text-base font-bold text-white">
{current.task.task_name}
</span>
{current.task.dialogue && (
<span className="mt-0.5 block text-xs leading-relaxed text-white/85">
{current.task.dialogue}
</span>
)}
</>
)}
</span>
</button>
)}
{!current && (
<div
className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm"
style={{ color: "var(--muted)"}}
>
いまの時間帯のセットがまだありません。「セット一覧」から作れます。
</div>
)}
{/* 操作の帯: 静かなリンクとステータスだけ（本体の操作はパネル／ポップアップ） */}
<div
className="shrink-0 px-1 pb-1 pt-2 text-[11px]"
style={{ color: "var(--muted)"}}
>
<p>
{baseStatus
? `骨格${baseStatus}${extraStatus? ` ・ ${extraStatus}`: ""}`
: "ステータスを入れると、あなたの表紙になります"}
</p>
<div className="mt-1 flex justify-end gap-3">
<button type="button" onClick={() => setView("cover")} className="underline">
表紙へ
</button>
<button type="button" onClick={() => setPanelOpen(true)} className="underline">
セット一覧
</button>
{currentSituation && (
<button
type="button"
onClick={() => setEditing(currentSituation.situation_id)}
className="underline"
>
タスクを編集
</button>
)}
<button type="button" onClick={() => setEditingProfile(true)} className="underline">
ステータスを入力
</button>
</div>
</div>
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
className="text-xs underline"
style={{ color: "var(--muted)" }}
>
閉じる
</button>
</div>
<div
className="mt-4 flex gap-4 border-b pb-4 text-[11px]"
style={{ borderColor: "var(--line)", color: "var(--muted)"}}
>
<button type="button" onClick={startNewSet} className="underline">
新規セット
</button>
<button
type="button"
onClick={() => {
setPanelOpen(false);
playFromTop();
}}
className="underline"
>
前回の続き
</button>
<button
type="button"
onClick={() => {
setPanelOpen(false);
playFromTop();
}}
className="underline"
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
