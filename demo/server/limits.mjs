/** Run budgets per caller: an hourly and a daily cap, kept in memory (one instance; a restart forgives). */
export function createBudget({ perHour = 30, perDay = 120, now = () => Date.now() } = {}) {
  const seen = new Map();
  return {
    /** @returns {{ ok: true } | { ok: false, retryAfterSeconds: number, window: "hour" | "day" }} */
    take(key) {
      const t = now();
      const hits = (seen.get(key) ?? []).filter((x) => t - x < 86_400_000);
      const hour = hits.filter((x) => t - x < 3_600_000);
      if (hour.length >= perHour) return { ok: false, window: "hour", retryAfterSeconds: Math.ceil((hour[0] + 3_600_000 - t) / 1000) };
      if (hits.length >= perDay) return { ok: false, window: "day", retryAfterSeconds: Math.ceil((hits[0] + 86_400_000 - t) / 1000) };
      hits.push(t); seen.set(key, hits);
      if (seen.size > 20_000) for (const [k, v] of seen) if (!v.some((x) => t - x < 86_400_000)) seen.delete(k);
      return { ok: true };
    },
  };
}
