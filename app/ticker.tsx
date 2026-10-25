"use client";

// Enaema Bot テキストロール（細い帯）
// - ファッションの小ネタ・予告・天気などを、表紙の外（ホーム下部）で静かに流す
// - 細く・遅く・薄く。オンオフ可能（設定は端末内に保存、既定はオン）
// - 文言はサーバ側で用意した lines をそのまま流す（天気＝実データ、 editorial＝DB の ticker_items）

import { useEffect, useState } from "react";

const TICKER_KEY = "enaema.ticker.v1";

export default function Ticker({ lines }: { lines: string[] }) {
const [enabled, setEnabled] = useState(true);
const [ready, setReady] = useState(false);

useEffect(() => {
try {
if (window.localStorage.getItem(TICKER_KEY) === "off") setEnabled(false);
} catch {
// 読めなければオンのまま
}
setReady(true);
}, []);

const toggle = (next: boolean) => {
setEnabled(next);
try {
window.localStorage.setItem(TICKER_KEY, next? "on": "off");
} catch {
// 保存できなくても表示は切り替える
}
};

if (!ready || lines.length === 0) return null;

if (!enabled) {
return (
<div className="text-right">
<button
type="button"
onClick={() => toggle(true)}
className="text-[10px] underline"
style={{ color: "var(--muted)"}}
>
ニュースロールを出す
</button>
</div>
);
}

const joined = lines.join("　／　");
const duration = Math.max(24, joined.length * 0.45);

return (
<div>
<style>{`@keyframes enaema-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
<div
className="overflow-hidden border-y py-1.5"
style={{ borderColor: "var(--line)"}}
>
<div
className="flex whitespace-nowrap text-[11px]"
style={{
color: "var(--muted)",
width: "max-content",
animation: `enaema-ticker ${duration}s linear infinite`,
}}
>
<span className="pr-8">{joined}</span>
<span className="pr-8" aria-hidden="true">{joined}</span>
</div>
</div>
<div className="mt-1 text-right">
<button
type="button"
onClick={() => toggle(false)}
className="text-[10px] underline"
style={{ color: "var(--muted)"}}
>
ロールを隠す
</button>
</div>
</div>
);
}
