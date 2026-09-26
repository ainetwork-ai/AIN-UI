import { x402Client } from "@x402/core/client";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import type { ClientEvmSigner } from "@x402/evm";

/** Sign only after a host has shown the quote and the user has clicked Pay.
 * The official x402 SDK owns authorization construction and header encoding.
 * Permit2 approval is a separate host flow, so this helper admits EIP-3009 only. */
export async function signX402Payment(paymentRequired: string, signer: ClientEvmSigner) {
  const required = decodePaymentRequiredHeader(paymentRequired);
  const accepts = required.accepts.filter((r) => r.scheme === "exact" && r.network.startsWith("eip155:") && r.extra?.assetTransferMethod !== "permit2");
  if (!accepts.length) throw new Error("This payment requires a different wallet approval flow");
  const client = new x402Client();
  client.register("eip155:*", new ExactEvmScheme(signer));
  const payload = await client.createPaymentPayload({ ...required, accepts });
  return { header: encodePaymentSignatureHeader(payload), from: signer.address };
}
