import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Load .env.local from the project root (one level up)
dotenv.config({ path: "../.env.local" });

const DEPLOY_PRIVATE_KEY = process.env.PLATFORM_WALLET_PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    // XRPL EVM Sidechain Testnet
    "xrpl-evm-testnet": {
      url: process.env.EVM_RPC_URL ?? "https://rpc.testnet.xrplevm.org",
      chainId: 1449000,
      accounts: DEPLOY_PRIVATE_KEY ? [DEPLOY_PRIVATE_KEY] : [],
    },
    // Local Hardhat node for development
    hardhat: {},
  },
};

export default config;
