"use client";

// 段階1: 全ページ共通のフッターメニュー（交際クラブ式の固定3タブ）。
// DESIGN.md 案A: ガラス風・大きな角丸を使わない、誌面型のフラットな帯。
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", en: "COVER", ja: "表紙" },
  { href: "/tasks", en: "TASKS", ja: "タスク" },
  { href: "/me", en: "ME", ja: "自分" },
] as const;

export default function SiteFooter() {
  const pathname = usePathname();
  return (
    <nav
      className="shrink-0 border-t"
      style={{ borderColor: "var(--line)", background: "var(--bg)" }}
      aria-label="メインメニュー"
    >
      <div className="flex">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => {
                if (t.href === "/") {
                  try {
                    window.sessionStorage.setItem("enaema.cover.ok", "1");
                  } catch {
                    // 保存できなくても遷移はする
                  }
                }
              }}
              className="relative flex flex-1 flex-col items-center pb-[max(8px,env(safe-area-inset-bottom))] pt-2"
              style={{ color: active ? "var(--accent)" : "var(--muted)" }}
            >
              {active && (
                <span
                  className="absolute inset-x-6 top-0 h-[2px]"
                  style={{ background: "var(--accent)" }}
                />
              )}
              <span className="text-[9px] font-bold tracking-[0.28em]">{t.en}</span>
              <span className={`mt-0.5 text-xs ${active ? "font-bold" : ""}`}>{t.ja}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
