/**
 * wagmi config — READ-ONLY. Guardian connects wallets only to read an address.
 * It never builds, requests, or signs a transaction. See the connectors: we use
 * injected + Coinbase Wallet purely to learn the connected account.
 */
import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { RPC_URL } from "./chain";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "ChainSage Guardian" }),
  ],
  transports: {
    [base.id]: http(RPC_URL),
  },
  ssr: true,
});
