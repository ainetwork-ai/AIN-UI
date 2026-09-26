/** Browser-wallet payment surface. The host executes the action locally;
 * signatures are submitted to the same authorized share resource via x402. */
import type { PaymentRequired } from "@x402/core/types";
import { AINUI_CATALOG } from "./ainui.js";
import { A2UI_VERSION, type A2uiMessage } from "./basic.js";

export const X402_PAY_ACTION = "aindrive.x402.pay";

export function ainuiPayment(input: {
  shareToken: string;
  title: string;
  required: PaymentRequired;
  paymentRequired: string;
  symbol: string;
  decimals: number;
}): A2uiMessage[] {
  const surfaceId = `aindrive-payment-${input.shareToken}`;
  const req = input.required.accepts[0];
  const digits = req.amount.padStart(input.decimals + 1, "0");
  const amount = input.decimals ? `${digits.slice(0, -input.decimals)}.${digits.slice(-input.decimals)}`.replace(/\.?0+$/, "") : digits;
  return [
    { version: A2UI_VERSION, createSurface: { surfaceId, catalogId: AINUI_CATALOG } },
    { version: A2UI_VERSION, updateComponents: { surfaceId, components: [
      { id: "root", component: "Column", children: ["title", "payment"] },
      { id: "title", component: "Text", variant: "h3", text: { path: "/title" } },
      { id: "payment", component: "X402Payment", amount: { path: "/amount" }, currency: { path: "/currency" },
        network: { path: "/network" }, payTo: { path: "/payTo" },
        action: { event: { name: X402_PAY_ACTION, context: { share_token: { path: "/share_token" }, paymentRequired: { path: "/paymentRequired" } } } } },
    ] } },
    { version: A2UI_VERSION, updateDataModel: { surfaceId, path: "/", value: {
      title: input.title, share_token: input.shareToken, paymentRequired: input.paymentRequired,
      amount, currency: input.symbol, network: req.network, payTo: req.payTo,
    } } },
  ];
}
