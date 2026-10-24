// Enaema ホーム画面 v3（2026-10-24）
// 仕様準拠: DESIGN.md（elegantテーマ／誌面レイアウト）、CONVENTIONS.md（DBフェッチ、ベタ書き禁止）
// データは Supabase のマスタテーブル（situations / tasks / characters）から取得する

type Situation = {
situation_id: string;
name: string;
display_order: number;
is_default: boolean;
access_tier: string;
};

type Task = {
task_id: number;
situation_id: string;
order_index: number;
task_name: string;
image_path: string;
dialogue: string;
dialogue_variation: number;
};

type Character = {
character_id: string;
name: string;
tier: string;
home_main_image_path: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function fetchTable<T>(path: string): Promise<T[]> {
const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
headers: {
apikey: SUPABASE_ANON_KEY?? "",
Authorization: `Bearer ${SUPABASE_ANON_KEY?? ""}`,
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
new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo"})
);
const w = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${w}）`;
}

export default async function Home() {
let situations: Situation[] = [];
let tasks: Task[] = [];
let character: Character | null = null;
let loadError = false;

if (!SUPABASE_URL ||!SUPABASE_ANON_KEY) {
loadError = true;
} else {
try {
const [s, t, c] = await Promise.all([
fetchTable<Situation>("situations?select=*&order=display_order.asc"),
fetchTable<Task>(
"tasks?select=*&order=situation_id.asc,order_index.asc"
),
fetchTable<Character>("characters?select=*&character_id=eq.neko"),
]);
situations = s;
tasks = t;
character = c[0]?? null;
} catch {
loadError = true;
}
}

const total = tasks.length;

return (
<main className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)"}}>
<div className="mx-auto w-full max-w-md px-4 pb-12">
{/* マストヘッド（雑誌の題字） */}
<header className="pt-6 text-center">
<div
className="border-y-4 border-double py-4"
style={{ borderColor: "var(--text)"}}
>
<p
className="text-[10px] tracking-[0.35em]"
style={{ color: "var(--muted)", fontFamily: "var(--font-display)"}}
>
DAILY BEAUTY MAGAZINE
</p>
<h1
className="mt-1 text-5xl font-semibold tracking-wide"
style={{ fontFamily: "var(--font-display)"}}
>
Enaema
</h1>
<p className="mt-2 text-xs" style={{ color: "var(--muted)"}}>
今日の私を、もっと好きになる。
</p>
</div>
<div
className="flex items-center justify-between border-b py-2 text-[11px]"
style={{ borderColor: "var(--line)", color: "var(--muted)"}}
>
<span>{todayLabelJST()}</span>
<span>
{situations.map((s) => s.name).join("｜")}
</span>
<span>全{total}タスク</span>
</div>
</header>

{loadError? (
<p className="py-16 text-center text-sm" style={{ color: "var(--muted)"}}>
マスタデータを読み込めませんでした。時間をおいて再度お試しください。
</p>
): (
<>
{/* メインビジュアル＋見出しボックス */}
<section className="mt-6">
{character && (
// eslint-disable-next-line @next/next/no-img-element
<img
src={storageUrl(character.home_main_image_path)}
alt={character.name}
className="w-full rounded-md object-cover"
/>
)}
<div
className="mt-4 border bg-[var(--surface)] p-4"
style={{ borderColor: "var(--text)"}}
>
<h2 className="text-base font-bold"></h2>
<p
className="mt-2 text-[13px] leading-relaxed"
style={{ color: "var(--muted)"}}
>
猫巫女と一緒にめぐる、朝から寝る前までの小さな美容習慣。
雑誌をめくるように眺めて、今日の自分に合うものから取り入れてみてください。
</p>
</div>
</section>

{/* シチュエーション別タスク（記事風リスト） */}
{situations.map((situation) => {
const items = tasks
.filter((t) => t.situation_id === situation.situation_id)
.sort((a, b) => a.order_index - b.order_index);
if (items.length === 0) return null;
return (
<section key={situation.situation_id} className="mt-8">
<div
className="flex items-baseline justify-between border-b-2 pb-2"
style={{ borderColor: "var(--text)"}}
>
<h2 className="text-lg font-bold">

</h2>
<span className="text-[11px]" style={{ color: "var(--muted)"}}>
{items.length}つのタスク
</span>
</div>
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
src={storageUrl(task.image_path)}
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
</section>
);
})}
</>
)}

{/* フッター（3タブ構成・テキスト） */}
<footer
className="mt-12 border-t pt-4 text-center"
style={{ borderColor: "var(--line)"}}
>
<p className="text-xs" style={{ color: "var(--muted)"}}>
ホーム｜タイムライン｜マイページ
</p>
<p className="mt-2 text-[10px]" style={{ color: "var(--muted)"}}>
Enaema — Buffly プロトタイプ
</p>
</footer>
</div>
</main>
);
}
