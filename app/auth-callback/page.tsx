"use client";

// Enaema 認証コールバック（/auth/callback）
// Google → Supabase から #フラグメント付きで戻ってくる。トークンを localStorage に保存し、
// ホームへ replace する。失敗時はメッセージとホームへのリンクを出す。

import { useEffect, useState } from "react";
import { saveSessionFromHash } from "../auth-client";

export default function AuthCallback() {
const [failed, setFailed] = useState(false);

useEffect(() => {
saveSessionFromHash()
.then((ok) => {
if (ok) {
window.location.replace("/");
} else {
setFailed(true);
}
})
.catch(() => setFailed(true));
}, []);

return (
<main
className="min-h-screen"
style={{ background: "var(--bg)", color: "var(--text)" }}
>
<div className="mx-auto w-full max-w-md px-4 py-24 text-center">
{failed? (
<>
<p className="text-sm">ログインできませんでした。</p>
<p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
<a href="/" className="underline">
ホームへ戻る
</a>
</p>
</>
): (
<p className="text-sm" style={{ color: "var(--muted)" }}>
ログインしています…
</p>
)}
</div>
</main>
);
}
