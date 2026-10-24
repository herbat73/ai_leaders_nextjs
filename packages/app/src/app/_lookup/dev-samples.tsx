import type { ReactElement } from "react";
import { listFakeOrderSamples, selectOrderSource } from "@easyrms/core";

/** Whether the fake order source is active outside production; the only case where sample credentials are shown. */
function fakeSourceActive(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    return selectOrderSource({ nodeEnv: process.env.NODE_ENV, source: process.env.EASYRMS_ORDER_SOURCE }) === "fake";
  } catch {
    return false;
  }
}

/** Server Component: lists the seeded example customers and orders so flows can be verified in development. */
export function DevSamples(): ReactElement | null {
  if (!fakeSourceActive()) return null;
  return (
    <section aria-labelledby="dev-samples-title" className="space-y-3 rounded-md border border-dashed border-amber-400 bg-amber-50 p-4 text-sm">
      <h2 id="dev-samples-title" className="font-semibold">
        Dane testowe (tylko środowisko deweloperskie)
      </h2>
      <ul className="space-y-3">
        {listFakeOrderSamples().map((sample) => (
          <li key={sample.orderNumber} className="space-y-1">
            <p>
              <code className="font-mono font-semibold">{sample.orderNumber}</code> ·{" "}
              <code className="font-mono">{sample.email}</code>
            </p>
            <p className="text-muted-foreground">{sample.scenario}</p>
            <p className="text-xs text-muted-foreground">
              {sample.lines.map((line) => `${line.quantity}× ${line.name}${line.returnable ? "" : " (bez zwrotu)"}`).join("; ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
