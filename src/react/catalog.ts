/**
 * The AINUI catalog for A2UI 1.0: the 69 standard components and the AIN ones, each with its React view.
 */
import type { ReactComponentImplementation } from "@a2ui/react";
import { createComponentImplementation } from "@a2ui/react";
import React from "react";
import { AINUI_CATALOG } from "../protocol.js";
import { Kids, STANDARD, kid, type ViewProps } from "./core.js";
import { ain } from "./ain.js";
import { functionImplementations } from "./functions.js";
import { layout } from "./standard/layout.js";
import { text } from "./standard/text.js";
import { inputs } from "./standard/inputs.js";
import { data } from "./standard/data.js";
import { media } from "./standard/media.js";
import { feedback } from "./standard/feedback.js";
import { composites } from "./standard/composites.js";
import { rich } from "./standard/rich.js";

export const AINUI_INSTRUCTIONS: string = STANDARD.instructions ?? "";

const views = [...layout, ...text, ...inputs, ...data, ...media, ...feedback, ...composites, ...rich, ...ain];
const byName = new Map(views.map((v) => [v.name, v]));

/** A component whose view is not written yet still shows its text and children instead of nothing. */
const fallback = (name: string) => createComponentImplementation(STANDARD.components.get(name) as never, (({ props, buildChild }: ViewProps) =>
  React.createElement("div", { "data-ainui-fallback": name }, typeof props.text === "string" || typeof props.label === "string" ? props.text ?? props.label : null,
    kid(buildChild, props.child), React.createElement(Kids, { of: props.children, buildChild }))) as never);

export const standardComponents: ReactComponentImplementation[] = [...STANDARD.components.keys()].map((name) => byName.get(name) ?? fallback(name));
/** Names of standard components that have no view of their own yet. */
export const missingStandardViews = [...STANDARD.components.keys()].filter((name) => !byName.has(name));

export const ainuiCatalog = STANDARD.copyWith({ catalogId: AINUI_CATALOG, components: standardComponents as never, functions: functionImplementations as never });
