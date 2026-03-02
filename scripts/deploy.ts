import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🌊 Seismic Quiz — Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Deployer : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance  : ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error("\n  ❌ Balance is 0!");
    console.error("  Get devnet ETH at: https://faucet-2.seismicdev.net");
    process.exit(1);
  }

  // Fund the built-in faucet with 1 ETH on deploy (≈ 20 free players)
  const FAUCET_SEED = ethers.parseEther("1.0");

  console.log("\n  Deploying SeismicQuiz...");
  console.log(`  Funding built-in faucet with 1 ETH...`);

  const Quiz = await ethers.getContractFactory("SeismicQuiz");
  const quiz = await Quiz.deploy({ value: FAUCET_SEED });
  await quiz.waitForDeployment();

  const address  = await quiz.getAddress();
  const deployTx = quiz.deploymentTransaction();
  const faucetBal = await quiz.faucetBalance();

  console.log("\n  ✅ Deployed successfully!");
  console.log(`  Contract    : ${address}`);
  console.log(`  Tx hash     : ${deployTx?.hash}`);
  console.log(`  Faucet ETH  : ${ethers.formatEther(faucetBal)} ETH`);
  console.log(`  Free plays  : ~${Math.floor(Number(ethers.formatEther(faucetBal)) / 0.05)} players`);

  // Auto-write contract address + config to frontend/config.js
  const configPath    = path.join("frontend", "config.js");
  const configContent = `const CONFIG = {
  contractAddress: "${address}",
  chainId: 5124,
  rpc: "https://node-2.seismicdev.net/rpc",
  explorer: "https://explorer-2.seismicdev.net",
  faucet: "https://faucet-2.seismicdev.net",
  deployedAt: "${new Date().toISOString()}",
  deployTxHash: "${deployTx?.hash}",
};
`;

  fs.writeFileSync(configPath, configContent);
  console.log(`\n  📝 Config written to frontend/config.js`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});