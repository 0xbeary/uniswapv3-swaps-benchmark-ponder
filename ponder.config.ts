import { createConfig } from "ponder";
import { SwapContractAbi } from "./abis/SwapContract";

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      rpc: process.env.PONDER_RPC_URL_1,
    },
  },
  contracts: {
    SwapContract: {
      abi: SwapContractAbi,
      chain: "mainnet", 
      address: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
      startBlock: 12376729,
      endBlock: 22797000
    },
  },
});
