import React from "react";

const Code = ({ children }: { children: string }) => <pre className="doc-code"><code>{children}</code></pre>;

export function Start() {
  return <main className="doc">
    <h1>Get started</h1>
    <p>AIN-UI is an npm package with three parts: a renderer for your app, the catalog that tells a model what it can draw, and the agent tools that check what the model wrote. This playground is those three parts and nothing else.</p>

    <h2>1. Draw surfaces in your app</h2>
    <Code>{`npm install ain-ui react react-dom`}</Code>
    <Code>{`"use client";
import { AinuiSurface } from "ain-ui/react";
import "ain-ui/styles.css";

<AinuiSurface
  messages={messages}                 // A2UI 1.0 (v0.9 is upgraded on the way in)
  onAction={(action) => sendToAgent(action)}   // { name, surfaceId, sourceComponentId, context }
  sendMessage={(text) => sendUserMessage(text)} // FollowUp pills
  theme="ain"                         // or "plain", "material", "terminal", or your own tokens
/>`}</Code>
    <p>Append messages to the same array and the surface updates in place. Tell the agent what you can draw by sending <code>ainuiCapabilities()</code> with each request.</p>

    <h2>2. Let a model write for it</h2>
    <Code>{`import { createUiAuthor } from "ain-ui/agent";

const author = createUiAuthor({ format: "json" });       // or "express"
const reply = await openai.chat.completions.create({
  model, tools: [author.tool],
  messages: [{ role: "system", content: systemPrompt + "\\n\\n" + author.prompt }, ...history],
});
const call = reply.choices[0].message.tool_calls?.[0];
const messages = author.fromToolCall(call.function.arguments); // validated A2UI 1.0, or a UiError to hand back`}</Code>
    <p>The catalog this renderer draws is at <a href="/catalog.json">/catalog.json</a>. Give it to any A2UI 1.0 agent SDK.</p>

    <h2>3. Or hand your coding agent a skill</h2>
    <p>A skill is a pair of Markdown files that teach an agent the format and this catalog.</p>
    <p><a className="pg-button" href="/api/skills?format=express&download=1" download>Download the Express skill</a> <a className="pg-button" href="/api/skills?format=json&download=1" download>Download the JSON skill</a></p>

    <h2>4. Bring your own design system</h2>
    <p>Every colour, radius and font in AIN-UI is a CSS variable on <code>.ain-ui</code>. Set them, or pick a theme:</p>
    <Code>{`.ain-ui[data-ainui-theme="mine"] {
  --ainui-primary: #0f766e; --ainui-primary-fg: #fff;
  --ainui-radius: 6px; --ainui-font: "Inter", sans-serif;
}`}</Code>

    <h2>Embed this playground</h2>
    <Code>{`<iframe src="https://ainui.ainetwork.xyz/?embed=1&ds=material&format=json" title="AIN-UI playground"></iframe>`}</Code>
  </main>;
}
