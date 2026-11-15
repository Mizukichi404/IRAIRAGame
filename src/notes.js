/** 採点官の声。丁寧で、責任は受験者に返す。 */

export function gradeFor(deaths) {
  if (deaths <= 4) return { id: "A", line: "評価A。手順どおりです。誤採点を疑ってください。" };
  if (deaths <= 10) return { id: "B", line: "評価B。平均には届いていません。" };
  if (deaths <= 20) return { id: "C", line: "評価C。合格と評価は別の制度です。" };
  if (deaths <= 35) return { id: "D", line: "評価D。記録は残します。褒めは残しません。" };
  return { id: "E", line: "評価E。合格は取り消していません。それだけです。" };
}

const RANK = { A: 5, B: 4, C: 3, D: 2, E: 1 };

export function betterGrade(next, prev) {
  if (!next) return prev || null;
  if (!prev) return next;
  return RANK[next] > RANK[prev] ? next : prev;
}

/**
 * @param {object} ctx
 * @returns {{ text: string, tone: "ink" | "red" }}
 */
export function pickNote(ctx) {
  const n = ctx.deaths;
  const px = ctx.shortfall;
  const early = ctx.takeoffGap;
  const parts = [];

  if (px != null && px <= 40) {
    parts.push(px <= 8 ? `あと ${px}px。ミリではありません。` : `あと ${px}px でした。`);
  }
  if (early != null && early >= 12 && early <= 72) {
    parts.push(`踏み切りが端より ${Math.round(early)}px 手前です。`);
  } else if (early != null && early > 72) {
    parts.push("踏み切りが早いです。端まで走ってください。");
  } else if (ctx.cutJump) {
    parts.push("ジャンプを途中で離しています。押し切ってください。");
  }
  if (ctx.streak >= 4 && parts.length) {
    parts.push(`${ctx.streak}回目です。`);
  }
  if (parts.length) {
    return { text: parts.slice(0, 2).join(""), tone: "red" };
  }

  if (ctx.streak >= 8) {
    return { text: "学習は、まだ検出されていません。", tone: "red" };
  }
  if (ctx.streak >= 4) {
    return { text: `同じ場所が ${ctx.streak}回です。偶然ではありません。`, tone: "red" };
  }
  if (ctx.record) {
    return { text: "自己記録です。不合格のまま残します。", tone: "ink" };
  }
  if (ctx.cause === "wind") {
    return { text: "風の影響はゼロです。", tone: "red" };
  }
  if (n <= 1) return { text: "1回目です。想定の範囲です。", tone: "ink" };
  if (n === 6) return { text: "平均は6回です。いま、平均です。", tone: "ink" };
  if (n === 7) return { text: "平均を超えました。", tone: "red" };
  if (n === 15) return { text: "操作遅延は 0ms です。", tone: "ink" };
  if (n >= 30 && n % 10 === 0) return { text: "制限時間はありません。", tone: "ink" };

  const pool = [
    "手元を見てください。画面ではなく。",
    "採点基準は公開済みです。",
    "もう一回で十分です。",
    "高さは一定です。位置が違います。",
    "落ちた原因は、入力に残っています。",
    "平静を保ってください。",
  ];
  const text = pool[(n + (ctx.streak || 0)) % pool.length];
  return { text, tone: n > 6 ? "red" : "ink" };
}

export function checkpointLine(cp) {
  if (cp.real && cp.style === "shiny") return "（記録）";
  if (cp.real) return "記録しました。";
  if (cp.official) return "正式な記録地点です。これより前の記録は無効です。";
  return "セーブしました。この先で落ちても、ここからです。";
}

export function applyCheckpoint(spawn, cp) {
  if (!cp.real) return spawn;
  return { x: cp.spawn.x, y: cp.spawn.y };
}
