// Enaema 権限ロジック（一元管理）— CONVENTIONS.md「権限ロジックは単一ファイルで判定」
// 階層: no_login < free < paid。situations.access_tier / tasks.order_index の表示可否はここだけが決める。
// 認証導入後は、呼び出し側がセッションから Tier を渡すだけで画面側の変更は不要。

export type Tier = "no_login" | "free" | "paid";

const TIER_RANK: Record<string, number> = {
  no_login: 0,
  free: 1,
  paid: 2,
};

function rank(tier: string): number {
  return TIER_RANK[tier] ?? 0;
}

// その階層で見えるシチュエーションか（access_tier が自分の階層以下）
export function canSeeSituation(tier: Tier, accessTier: string): boolean {
  return rank(accessTier) <= rank(tier);
}

// その階層で選べるタスクの order_index 上限（ノーログイン=先頭3つ、ログイン=5つ）
export function maxOrderIndex(tier: Tier): number {
  return tier === "no_login" ? 3 : 5;
}

export function canSelectTask(tier: Tier, orderIndex: number): boolean {
  return orderIndex <= maxOrderIndex(tier);
}
