// 段階1: 3ページ共通の枠（データ取得→ HomeClient → 帯 → フッター）。
import HomeClient from "./home-client";
import SiteFooter from "./site-footer";
import { loadHomeData } from "./data";

export default async function Frame({
  page,
}: {
  page: "cover" | "tasks" | "me";
}) {
  const d = await loadHomeData();
  return (
    <main
      className="h-svh overflow-hidden"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-4">
        {d.loadError ? (
          <p
            className="py-16 text-center text-sm"
            style={{ color: "var(--muted)" }}
          >
            マスタデータを読み込めませんでした。時間をおいて再度お試しください。
          </p>
        ) : (
          <div className="min-h-0 flex-1">
            <HomeClient
              page={page}
              situations={d.situations}
              tasks={d.tasks}
              heroUrl={d.heroUrl}
              characterName={d.characterName}
              imageBase={d.imageBase}
              tier={d.tier}
              currentKey={d.currentKey}
              coverMeta={d.coverMeta}
              tickerItems={d.tickerLines}
              weatherLines={d.weatherLines}
            />
          </div>
        )}
        <SiteFooter />
      </div>
    </main>
  );
}
