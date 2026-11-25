/**
 * The UI door for agents that are not this playground: an agent host sends what its caller's renderer draws and
 * gets back what to tell its model (`author`), then sends what the model wrote and gets back checked A2UI 1.0
 * messages (`render`). No model is called here and nothing is stored; it is the catalog and the checker as a service.
 */
import { createHash } from "node:crypto";
import { catalogsFor, createUiAuthor, UiError } from "ain-ui/agent";
import { AINUI_CATALOG } from "ain-ui";
import { AINUI_MACROS } from "ain-ui/macros";

const authors = new Map();
const LIMIT = 32;

function authorFor(capabilities, format) {
  const docs = catalogsFor(capabilities);
  if (!docs.length) return null;
  const kind = format === "express" ? "express" : "json";
  const key = createHash("sha256").update(kind).update(JSON.stringify(docs)).digest("hex");
  let author = authors.get(key);
  if (author) { authors.delete(key); authors.set(key, author); return author; }
  // Macros expand into AIN-UI's own components, so they are offered only for AIN-UI's catalog.
  const own = docs.length === 1 && docs[0].catalogId === AINUI_CATALOG;
  author = createUiAuthor({ format: kind, catalogs: docs, macros: own ? AINUI_MACROS : [] });
  authors.set(key, author);
  if (authors.size > LIMIT) authors.delete(authors.keys().next().value);
  return author;
}

/** What to tell the model, or null when none of the renderer's catalogs can be written for. */
export function describeUi({ capabilities, format }) {
  const author = authorFor(capabilities, format);
  if (!author) return null;
  return { format: author.format, catalogIds: author.catalogIds, prompt: author.prompt, tool: { name: author.tool.function.name, description: author.tool.function.description, parameters: author.tool.function.parameters } };
}

/** Checked messages for what the model passed to `render_ui`. Throws `UiError` with a message for the model. */
export function renderUi({ capabilities, format, args }) {
  const author = authorFor(capabilities, format);
  if (!author) throw new UiError("None of the catalogs this renderer draws can be written for.");
  const notes = [];
  return { messages: author.fromToolCall(args ?? {}, notes), notes: notes.slice(0, 12) };
}

export { UiError };
