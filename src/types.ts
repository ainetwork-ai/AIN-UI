export type SkillResult = { kind: "ok"; text: string; structured: unknown } | { kind: "err"; code: "invalid_params" | "forbidden" | "internal" | "not_found"; message: string };
