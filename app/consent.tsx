"use client";

// Enaema 同意フロー（利用規約・プライバシーポリシー）
// - ログイン済みユーザーの同意を public.users に記録する（ASSETS.md の users 定義）
// - バージョンは docs/legal の制定日に一致させる。文書を改定したらここを上げる
// - 未同意の間はログイン特典（free 階層）を使えない（CONVENTIONS: 未同意ユーザーは機能利用不可）
// - 読み取りに失敗した場合はログイン自体を妨げない（unknown は素通し）

import { useState } from "react";
import type { Session } from "./auth-client";

export const TERMS_VERSION = "2026-08-31";
export const PRIVACY_VERSION = "2026-08-31";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function authHeaders(session: Session) {
  const key = SUPABASE_ANON_KEY;
  const token = session.accessToken;
  return { apikey: key, Authorization: "Bearer " + token };
}

async function fetchUserId(session: Session): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: authHeaders(session),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j?.id === "string" ? j.id : null;
  } catch {
    return null;
  }
}

export type ConsentState = "ok" | "needed" | "unknown";

export async function checkConsent(session: Session): Promise<ConsentState> {
  const id = await fetchUserId(session);
  if (!id) return "unknown";
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?user_id=eq.${id}&select=terms_agreed_version,privacy_agreed_version`,
      { headers: authHeaders(session) }
    );
    if (!res.ok) return "unknown";
    const rows = (await res.json()) as {
      terms_agreed_version: string | null;
      privacy_agreed_version: string | null;
    }[];
    const row = rows[0];
    if (!row) return "needed";
    return row.terms_agreed_version === TERMS_VERSION &&
      row.privacy_agreed_version === PRIVACY_VERSION
      ? "ok"
      : "needed";
  } catch {
    return "unknown";
  }
}

export async function recordConsent(session: Session): Promise<boolean> {
  const id = await fetchUserId(session);
  if (!id) return false;
  const now = new Date().toISOString();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: "POST",
      headers: {
        ...authHeaders(session),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        user_id: id,
        tier: "free",
        terms_agreed_version: TERMS_VERSION,
        terms_agreed_at: now,
        privacy_agreed_version: PRIVACY_VERSION,
        privacy_agreed_at: now,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function ConsentSheet(props: {
  onAgree: () => Promise<boolean>;
  onLater: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const agree = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await props.onAgree();
    setBusy(false);
    if (!ok) setFailed(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div
        className="w-full max-w-md border-t-2 bg-[var(--surface)] p-5"
        style={{ borderColor: "var(--text)" }}
      >
        <h3 className="text-base font-bold">はじめる前に</h3>
        <p
          className="mt-2 text-[13px] leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          エナエマの全機能を使うには、利用規約とプライバシーポリシーへの同意が必要です。内容を確認のうえ、同意してお進みください。
        </p>
        <p className="mt-3 flex gap-5 text-[13px]">
          <a
            href="/legal#terms"
            target="_blank"
            rel="noreferrer"
            className="underline"
            style={{ color: "var(--accent)" }}
          >
            利用規約
          </a>
          <a
            href="/legal#privacy"
            target="_blank"
            rel="noreferrer"
            className="underline"
            style={{ color: "var(--accent)" }}
          >
            プライバシーポリシー
          </a>
        </p>
        {failed && (
          <p className="mt-3 text-xs" style={{ color: "var(--accent)" }}>
            記録できませんでした。通信環境を確認して、もう一度お試しください。
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={agree}
          className="mt-4 w-full rounded-full border py-3 text-sm font-bold disabled:opacity-50"
          style={{ borderColor: "var(--text)" }}
        >
          {busy ? "記録しています…" : "同意してはじめる"}
        </button>
        <button
          type="button"
          onClick={props.onLater}
          className="mt-2 w-full py-2 text-xs"
          style={{ color: "var(--muted)" }}
        >
          あとで決める（同意するまでログイン特典は使えません）
        </button>
      </div>
    </div>
  );
}
