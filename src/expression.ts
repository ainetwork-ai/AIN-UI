/**
 * The arithmetic behind the catalog's `calc` and `series` functions: a small expression language evaluated by a
 * parser, never by `eval`.
 *
 *   + - * / %  ( )   x ^ y   < <= > >= == !=   && || !   cond ? a : b
 *   min max round floor ceil abs pow sqrt exp ln log10   pi e   'text' + name
 *
 * Names are looked up in the variables passed in; an unknown name is an error, not undefined.
 */
type Value = number | string | boolean | null;
type Token = { t: "num"; v: number } | { t: "str"; v: string } | { t: "id"; v: string } | { t: "op"; v: string };

const OPS = ["&&", "||", "<=", ">=", "==", "!=", "+", "-", "*", "/", "%", "^", "(", ")", "<", ">", "!", "?", ":", ","];
const MAX_LENGTH = 2000;

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    const num = /^(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)/.exec(src.slice(i));
    if (num) { out.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    if (ch === "'" || ch === '"') {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== ch) { if (src[j] === "\\" && j + 1 < src.length) j++; s += src[j++]; }
      if (j >= src.length) throw new Error("unterminated string");
      out.push({ t: "str", v: s }); i = j + 1; continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
    if (id) { out.push({ t: "id", v: id[0] }); i += id[0].length; continue; }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new Error(`unexpected "${ch}"`);
    out.push({ t: "op", v: op }); i += op.length;
  }
  return out;
}

const FUNCTIONS: Record<string, (...a: number[]) => number> = {
  min: Math.min, max: Math.max, round: (x, digits = 0) => { const f = 10 ** digits; return Math.round(x * f) / f; },
  floor: Math.floor, ceil: Math.ceil, abs: Math.abs, pow: Math.pow, sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, log10: Math.log10,
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

const num = (v: Value): number => { const n = typeof v === "number" ? v : typeof v === "boolean" ? Number(v) : Number(v); if (Number.isNaN(n)) throw new Error(`"${String(v)}" is not a number`); return n; };
const truthy = (v: Value) => !!v;

/** Evaluates `expression` with the given variables. Throws with a short reason when it cannot. */
export function evaluate(expression: string, variables: Record<string, unknown> = {}): Value {
  if (typeof expression !== "string") throw new Error("expression must be a string");
  if (expression.length > MAX_LENGTH) throw new Error("expression too long");
  const tokens = tokenize(expression);
  let pos = 0;
  const peek = (v?: string) => { const t = tokens[pos]; return t && t.t === "op" && (v === undefined || t.v === v) ? t : undefined; };
  const take = (v: string) => { if (!peek(v)) throw new Error(`expected "${v}"`); pos++; };

  const lookup = (name: string): Value => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) { const v = variables[name]; return v === undefined ? null : (v as Value); }
    // a.b reads a property of a variable that is an object
    if (name.includes(".")) {
      let cur: unknown = variables;
      for (const part of name.split(".")) {
        if (cur && typeof cur === "object" && Object.prototype.hasOwnProperty.call(cur, part)) cur = (cur as Record<string, unknown>)[part];
        else throw new Error(`unknown name "${name}"`);
      }
      return cur as Value;
    }
    if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) return CONSTANTS[name];
    if (name === "true") return true; if (name === "false") return false; if (name === "null") return null;
    throw new Error(`unknown name "${name}"`);
  };

  const primary = (): Value => {
    const t = tokens[pos];
    if (!t) throw new Error("unexpected end");
    if (t.t === "num") { pos++; return t.v; }
    if (t.t === "str") { pos++; return t.v; }
    if (t.t === "id") {
      pos++;
      if (peek("(")) {
        const fn = Object.prototype.hasOwnProperty.call(FUNCTIONS, t.v) ? FUNCTIONS[t.v] : undefined;
        if (!fn) throw new Error(`unknown function "${t.v}"`);
        pos++;
        const args: number[] = [];
        if (!peek(")")) { do { args.push(num(ternary())); } while (peek(",") && ++pos); }
        take(")");
        return fn(...args);
      }
      return lookup(t.v);
    }
    if (t.v === "(") { pos++; const v = ternary(); take(")"); return v; }
    throw new Error(`unexpected "${t.v}"`);
  };
  const unary = (): Value => {
    if (peek("-")) { pos++; return -num(unary()); }
    if (peek("+")) { pos++; return num(unary()); }
    if (peek("!")) { pos++; return !truthy(unary()); }
    return primary();
  };
  const power = (): Value => { const base = unary(); if (peek("^")) { pos++; return num(base) ** num(power()); } return base; };
  const product = (): Value => {
    let v = power();
    for (let op = peek(); op && ["*", "/", "%"].includes(op.v); op = peek()) {
      pos++; const r = num(power());
      v = op.v === "*" ? num(v) * r : op.v === "/" ? num(v) / r : num(v) % r;
    }
    return v;
  };
  const sum = (): Value => {
    let v = product();
    for (let op = peek(); op && ["+", "-"].includes(op.v); op = peek()) {
      pos++; const r = product();
      v = op.v === "-" ? num(v) - num(r) : typeof v === "string" || typeof r === "string" ? `${v ?? ""}${r ?? ""}` : num(v) + num(r);
    }
    return v;
  };
  const compare = (): Value => {
    let v = sum();
    for (let op = peek(); op && ["<", "<=", ">", ">=", "==", "!="].includes(op.v); op = peek()) {
      pos++; const r = sum();
      v = op.v === "==" ? v === r : op.v === "!=" ? v !== r : op.v === "<" ? num(v) < num(r) : op.v === "<=" ? num(v) <= num(r) : op.v === ">" ? num(v) > num(r) : num(v) >= num(r);
    }
    return v;
  };
  const and = (): Value => { let v = compare(); while (peek("&&")) { pos++; const r = compare(); v = truthy(v) && truthy(r); } return v; };
  const or = (): Value => { let v = and(); while (peek("||")) { pos++; const r = and(); v = truthy(v) || truthy(r); } return v; };
  function ternary(): Value {
    const c = or();
    if (!peek("?")) return c;
    pos++; const a = ternary(); take(":"); const b = ternary();
    return truthy(c) ? a : b;
  }

  const value = ternary();
  if (pos < tokens.length) throw new Error("unexpected input after the expression");
  return value;
}

const WHOLE = /^\$\{([^}]*)\}$/;

/** Fills `${expression}` pieces in a value. A string that is one whole expression keeps the result's type. */
export function fill(template: unknown, variables: Record<string, unknown>): unknown {
  if (typeof template === "string") {
    const whole = WHOLE.exec(template);
    if (whole) return evaluate(whole[1], variables);
    return template.replace(/\$\{([^}]*)\}/g, (_, expr) => String(evaluate(expr, variables) ?? ""));
  }
  if (Array.isArray(template)) return template.map((x) => fill(x, variables));
  if (template && typeof template === "object") return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, fill(v, variables)]));
  return template;
}

export const SERIES_LIMIT = 1000;

/** `count` copies of `item`, with the loop variable (default `i`, from `start`, default 1) filled in. */
export function series(args: { count?: unknown; item?: unknown; variable?: unknown; start?: unknown } & Record<string, unknown>): unknown[] {
  const { count, item, variable, start, ...rest } = args;
  const n = Math.max(0, Math.min(SERIES_LIMIT, Math.floor(Number(count) || 0)));
  const name = typeof variable === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(variable) ? variable : "i";
  const first = Number.isFinite(Number(start)) && start !== undefined && start !== null ? Number(start) : 1;
  return Array.from({ length: n }, (_, k) => fill(item, { ...rest, [name]: first + k }));
}
