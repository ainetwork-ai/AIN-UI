/**
 * One turn of the playground agent: the model is told the catalog, calls `render_ui`, and what it wrote is checked
 * and compiled before anything is shown. The model is injected (`chat`), so the loop runs the same under test.
 */
import { createUiAuthor, UiError, RENDER_UI_TOOL } from "ain-ui/agent";
import { AINUI_MACROS } from "ain-ui/macros";

export const PERSONA = `You are the AIN-UI playground assistant. People ask for a user interface; you show it.

- Answer with UI whenever the request can be shown: call render_ui. One short sentence of text is enough around it.
- Use realistic, specific sample data. If numbers are illustrative, say so in a Caption.
- Keep a surface focused: 8 to 18 components. Prefer one rich component (Table, Chart, EntityCard) over many small ones.
- When the user acts on a surface you showed (a button, a form), answer by showing the updated surface.
- Reply in the language the user writes in.`;

const count = (messages) => messages.reduce((n, m) => n + (m.createSurface?.components?.length ?? m.updateComponents?.components?.length ?? 0), 0);

/** A new surface written in answer to an action becomes an update of the surface the action came from. */
export function inPlace(messages, surfaceId) {
  if (!surfaceId) return messages;
  return messages.flatMap((m) => {
    if (!m.createSurface) return [m];
    const { components, dataModel } = m.createSurface;
    return [
      ...(components ? [{ version: m.version, updateComponents: { surfaceId, components } }] : []),
      { version: m.version, updateDataModel: { surfaceId, path: "/", value: dataModel ?? {} } },
    ];
  });
}

/**
 * One model call. When the client streams, the tool call's arguments are reported as they grow (`writing`), so a
 * visitor watches the surface being written instead of a spinner; the last thing yielded is the whole message.
 */
async function* complete(chat, body) {
  const result = await chat({ ...body, stream: true });
  if (typeof result?.[Symbol.asyncIterator] !== "function") { yield { type: "message", message: result?.choices?.[0]?.message }; return; }
  let content = "", reported = 0;
  const calls = [];
  for await (const chunk of result) {
    const delta = chunk?.choices?.[0]?.delta;
    if (!delta) continue;
    if (typeof delta.content === "string") content += delta.content;
    for (const piece of delta.tool_calls ?? []) {
      const call = (calls[piece.index ?? 0] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
      if (piece.id) call.id = piece.id;
      if (piece.function?.name) call.function.name += piece.function.name;
      if (piece.function?.arguments) call.function.arguments += piece.function.arguments;
    }
    const written = calls.reduce((n, c) => n + c.function.arguments.length, 0);
    if (written - reported >= 240) { reported = written; yield { type: "writing", chars: written, source: calls.map((c) => c.function.arguments).join("\n") }; }
  }
  const made = calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}` }));
  yield { type: "message", message: { role: "assistant", content: content || null, ...(made.length ? { tool_calls: made } : {}) } };
}

const modelOptions = (model) => ({
  ...(model.startsWith("GLM-") ? { reasoning_effort: "low" } : {}),
  ...(model.startsWith("Qwen") ? { chat_template_kwargs: { enable_thinking: false } } : {}),
});

/**
 * @param {object} o
 * @param {(body: object) => Promise<{ choices: Array<{ message: any }> }>} o.chat  an OpenAI chat.completions.create
 * @param {string} o.model
 * @param {"express"|"json"} o.format
 * @param {Array<{role: "user"|"assistant", content: string}>} o.history  ends with the user's message (unless `action`)
 * @param {{ name: string, surfaceId?: string, context?: object }} [o.action]  the user acted on a surface
 * @param {object[]} [o.catalogs]  catalog documents the renderer sent; defaults to the AINUI catalog
 */
export async function* runTurn({ chat, model, format = "express", history, action, catalogs, maxCalls = 4, maxComponents = 1000, macros = AINUI_MACROS }) {
  const started = Date.now();
  let author = createUiAuthor({ format, catalogs, macros });
  const system = () => `${PERSONA}\n\n${author.prompt}`;
  const messages = [{ role: "system", content: system() }, ...history];
  if (action) {
    messages.push({ role: "user", content: `[The user acted on surface "${action.surfaceId ?? ""}": event "${action.name}" with context ${JSON.stringify(action.context ?? {})}. Show the updated surface.]` });
  }
  let calls = 0, expressFailures = 0, shown = 0;
  while (calls < maxCalls) {
    calls++;
    const t0 = Date.now();
    let reply;
    try {
      for await (const part of complete(chat, { model, messages: [...messages], tools: [author.tool], tool_choice: "auto", max_tokens: 6000, temperature: 0.3, ...modelOptions(model) })) {
        if (part.type === "message") reply = part.message;
        else yield { type: "writing", format: author.format, chars: part.chars, source: part.source };
      }
    } catch (e) {
      yield { type: "error", message: `The model did not answer (${String(e?.status ?? e?.code ?? e?.name ?? "error")}).` };
      break;
    }
    const ms = Date.now() - t0;
    if (!reply) { yield { type: "error", message: "The model returned no message." }; break; }
    const text = typeof reply.content === "string" ? reply.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim() : "";
    const toolCalls = (reply.tool_calls ?? []).filter((c) => c?.function?.name === RENDER_UI_TOOL);

    // A model without tool calling writes the fenced form in its text.
    if (!toolCalls.length) {
      let parts = text ? [{ type: "text", text }] : [];
      try { if (/<a2ui(-json)?>/.test(text)) parts = author.fromText(text); }
      catch (e) {
        if (e instanceof UiError && calls < maxCalls) { messages.push({ role: "assistant", content: text }, { role: "user", content: e.message }); continue; }
        yield { type: "error", message: e.message };
      }
      for (const part of parts) {
        if (part.type === "text") yield { type: "text", delta: part.text };
        else { shown++; yield { type: "surface", format: author.format, messages: inPlace(part.messages, action?.surfaceId), ms }; }
      }
      break;
    }

    if (text) yield { type: "text", delta: text };
    messages.push({ role: "assistant", content: reply.content ?? null, tool_calls: reply.tool_calls });
    let failed = false;
    for (const call of reply.tool_calls ?? []) {
      if (call.function?.name !== RENDER_UI_TOOL) { messages.push({ role: "tool", tool_call_id: call.id, content: `Unknown tool ${call.function?.name}.` }); continue; }
      let args;
      try { args = JSON.parse(call.function.arguments || "{}"); } catch { args = call.function.arguments; }
      const source = typeof args === "string" ? args : typeof args.express === "string" ? args.express : JSON.stringify(args.messages ?? args, null, 1);
      yield { type: "source", format: author.format, source, ms, attempt: calls };
      try {
        const forgiven = [];
        const ui = author.fromToolCall(args, forgiven);
        if (forgiven.length) yield { type: "forgiven", notes: forgiven.slice(0, 8) };
        if (count(ui) > maxComponents) throw new UiError(`That surface has ${count(ui)} components; the limit is ${maxComponents}. Show less.`);
        shown++;
        yield { type: "surface", format: author.format, messages: inPlace(ui, action?.surfaceId), ms };
        messages.push({ role: "tool", tool_call_id: call.id, content: "Shown to the user." });
      } catch (e) {
        failed = true;
        const message = e instanceof UiError ? e.message : `render_ui failed: ${String(e?.message ?? e)}`;
        yield { type: "rejected", format: author.format, message };
        messages.push({ role: "tool", tool_call_id: call.id, content: message });
        if (author.format === "express") expressFailures++;
      }
    }
    if (!failed) break;
    // Express that still fails after one retry is asked for again as JSON, which the models get right more often.
    if (author.format === "express" && expressFailures >= 2) {
      author = createUiAuthor({ format: "json", catalogs, macros });
      messages[0] = { role: "system", content: system() };
      messages.push({ role: "user", content: "Write the same UI again as JSON: call render_ui with `components` (and `data`)." });
      yield { type: "fallback", from: "express", to: "json" };
    }
  }
  yield { type: "done", calls, shown, ms: Date.now() - started };
}
