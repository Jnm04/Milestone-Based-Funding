/**
 * Deploy MilestoneFundEscrow + MockRLUSD to XRPL EVM Sidechain.
 *
 * Usage (from the /evm directory):
 *   npm run deploy:testnet
 *   # or: npx hardhat run scripts/deploy-evm.ts --network xrpl-evm-testnet
 *
 * Prerequisites:
 *   - Set PLATFORM_WALLET_PRIVATE_KEY in ../.env.local
 *   - Fund the deployer address with XRP (for gas) from https://faucet.xrplevm.org
 *
 * On mainnet:
 *   - Skip MockRLUSD deployment — use the real RLUSD contract address
 *   - Set a separate hot-wallet for platform (not the deployer)
 */
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Deployer:        ", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "XRP");

  if (balance === 0n) {
    throw new Error(
      "Deployer has no XRP for gas. Fund it at: https://faucet.xrplevm.org"
    );
  }

  // 1. Deploy MockRLUSD (testnet only)
  console.log("\nDeploying MockRLUSD…");
  const MockRLUSD = await ethers.getContractFactory("MockRLUSD");
  const rlusd = await MockRLUSD.deploy();
  await rlusd.waitForDeployment();
  const rlusdAddress = await rlusd.getAddress();
  console.log("MockRLUSD:       ", rlusdAddress);

  // 2. Deploy MilestoneFundEscrow (platform = deployer for now)
  console.log("\nDeploying MilestoneFundEscrow…");
  const MilestoneFundEscrow = await ethers.getContractFactory("MilestoneFundEscrow");
  const escrow = await MilestoneFundEscrow.deploy(rlusdAddress, deployer.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("MilestoneFundEscrow:", escrowAddress);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add these to your ../.env.local:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVM_RPC_URL=https://rpc.testnet.xrplevm.org
NEXT_PUBLIC_EVM_CHAIN_ID=1449000
NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS=${rlusdAddress}
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=${escrowAddress}
PLATFORM_WALLET_PRIVATE_KEY=<keep your existing deployer key>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
