/**
 * What the catalog's functions do in the renderer. The catalog document only declares them; without these a
 * `formatString`, a validation check or a `calc` would resolve to nothing.
 */
import { createFunctionImplementation } from "@a2ui/web_core";
import { basicCatalog } from "@a2ui/web_core/catalogs/basic/v1";
import { evaluate, series } from "../expression.js";
import { STANDARD } from "./core.js";

const own: Record<string, (args: Record<string, unknown>) => unknown> = {
  // An expression that cannot be evaluated shows as nothing rather than breaking the surface.
  calc: ({ expression, ...variables }) => { try { return evaluate(String(expression ?? ""), variables); } catch { return null; } },
  series: (args) => { try { return series(args); } catch { return []; } },
};

/** One implementation per function the catalog declares: A2UI's own for the basic ones, ours for the rest. */
export const functionImplementations = [...STANDARD.functions.values()].flatMap((api) => {
  const basic = basicCatalog.functions.get(api.name) as { execute?: (...a: unknown[]) => unknown } | undefined;
  const execute = own[api.name] ?? basic?.execute;
  return execute ? [createFunctionImplementation(api as never, execute as never)] : [];
});
