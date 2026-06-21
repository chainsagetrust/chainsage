/**
 * Input validation (zod). Malformed input throws HttpError(400) — never reaches
 * the chain, never becomes a 500. Addresses are validated with viem's isAddress
 * and normalized to checksum form.
 */
import { z } from "zod";
import { isAddress, getAddress } from "viem";
import { HttpError } from "./http";

export const addressSchema = z
  .string()
  .refine((s) => isAddress(s), { message: "must be a valid 0x-prefixed address" })
  .transform((s) => getAddress(s as `0x${string}`));

export const scoreSchema = z.object({
  address: addressSchema,
});

export const classifySchema = z.object({
  address: addressSchema,
});

// amount is a human-readable token amount (e.g. "100.5") or the literal
// "unlimited" / "max" / "infinite". See lib/simulate.ts for interpretation.
const amountSchema = z
  .string()
  .min(1, { message: "amount is required" })
  .max(80, { message: "amount is too long" });

export const simulateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("approve"),
    token: addressSchema,
    spender: addressSchema,
    amount: amountSchema,
  }),
  z.object({
    type: z.literal("transfer"),
    token: addressSchema,
    to: addressSchema,
    amount: amountSchema,
  }),
]);

// /guard accepts the same intent shape as /simulate (approve | transfer). The
// difference is the response: /guard runs the Guardian signal-combiner (decide)
// and returns { verdict, reasons, simulated, verdictId }.
export const guardSchema = simulateSchema;

export type ScoreInput = z.infer<typeof scoreSchema>;
export type ClassifyInput = z.infer<typeof classifySchema>;
export type SimulateInput = z.infer<typeof simulateSchema>;
export type GuardInput = z.infer<typeof guardSchema>;

/** Parse `body` with `schema`, or throw HttpError(400) with a precise message. */
export function parseOr400<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.length ? first.path.join(".") : "body";
    const message = first?.message ?? "invalid input";
    throw new HttpError(400, "invalid_input", `${path}: ${message}`);
  }
  return result.data;
}
