import type { Metadata } from "next";
import { Providers } from "./providers";

/**
 * /app — ChainSage Guardian. The wagmi + react-query providers are scoped HERE
 * (this nested layout) so only the interactive product route is wrapped in web3
 * client context; the marketing landing at / stays server-rendered.
 */
export const metadata: Metadata = {
  title: { absolute: "ChainSage Guardian — is your wallet safe?" },
  description:
    "Read-only wallet safety scan on Base. Live on-chain approval & drainer analysis — keys never touched.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
