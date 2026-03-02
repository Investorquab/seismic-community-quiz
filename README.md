# 🌊 Seismic Community Quiz

> An on-chain quiz experiment built for the Seismic Devnet community.
> Answer questions, submit your score as a real blockchain transaction, and climb the leaderboard.

![Seismic Quiz](https://img.shields.io/badge/Network-Seismic%20Devnet-brown?style=flat-square)
![Chain ID](https://img.shields.io/badge/Chain%20ID-5124-sienna?style=flat-square)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## 🧭 What Is This?

This is a **community-driven testnet experiment** for [Seismic](https://seismic.systems) — a privacy-focused EVM-compatible blockchain that uses encrypted state via Intel TDX (Trusted Execution Environments).

The idea is simple:
- Connect your EVM wallet
- Answer 10 AI-generated questions about Seismic, crypto privacy, and blockchain security
- Submit your score **as a real on-chain transaction** to Seismic Devnet
- Compete on a live leaderboard

Every interaction drives real testnet activity and helps the community learn about what Seismic is building.

---

## ✨ Features

- **AI-generated questions** — powered by Groq (Llama 3.3 70B), fresh questions every 24 hours
- **Per-player randomization** — each wallet address sees questions in a unique order
- **20-second countdown timer** per question — no sitting idle
- **On-chain submission** — your score is stored permanently on Seismic Devnet
- **Live leaderboard** — pulled directly from the smart contract, refreshes every 20 seconds
- **Any EVM wallet** — MetaMask, Rabby, Coinbase Wallet, Trust Wallet, or any EIP-1193 wallet
- **Built-in faucet** — No need to claim devnet tokens separately! The contract automatically sends you 0.05 ETH when you connect with a low balance — enough to play daily for ~30 days
- **Auto network switch** — automatically adds Seismic Devnet to your wallet on connect
- **Encrypted state ready** — contract is written with Seismic's `suint` privacy types in mind

---

## 🏗️ The Build Journey

This project was built from scratch as a public community experiment, documenting every step.

### Stack
| Layer | Tech |
|-------|------|
| Smart Contract | Solidity 0.8.20 |
| Dev Environment | Hardhat 3 (hh2 beta) |
| Frontend | Plain HTML + Vanilla JS + ethers.js v6 |
| AI Questions | Groq API (Llama 3.3 70B) |
| Network | Seismic Devnet (Chain ID: 5124) |
| Wallet | Any EIP-1193 injected wallet |

### Why Seismic?
Seismic is building something genuinely different — encrypted on-chain state using Intel TDX, native privacy types (`suint`, `sbool`, `saddress`) that make private variables truly private, not just hidden. The quiz contract uses a private `_passingThreshold` variable that would become fully encrypted on Seismic's native compiler.

### Why a Quiz?
The goal was to:
1. Drive real testnet transactions from the community
2. Teach people about Seismic's tech while they interact with it
3. Keep it simple enough to deploy and document publicly
4. Build something others can fork and extend

---

## 📁 Project Structure

```
seismic-community-quiz/
├── contracts/
│   └── SeismicQuiz.sol          # Main quiz contract
├── scripts/
│   └── deploy.ts                # Deployment script (auto-writes config.js)
├── frontend/
│   ├── index.html               # Full UI — warm parchment theme
│   ├── app.js                   # Wallet, AI questions, timer, leaderboard
│   └── config.js                # Auto-generated on deploy (contract address etc)
├── hardhat.config.ts            # Hardhat config with Seismic network
├── .env                         # PRIVATE_KEY + SEISMIC_RPC (never commit this)
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Groq API key (free at [console.groq.com](https://console.groq.com))
- An EVM wallet with Seismic Devnet ETH

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/seismic-community-quiz.git
cd seismic-community-quiz
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file in the root:
```env
PRIVATE_KEY=0xyour_wallet_private_key
SEISMIC_RPC=https://node-2.seismicdev.net/rpc
```

> ⚠️ Never commit your `.env` file. It's already in `.gitignore`.

### 4. Add your Groq API key
Open `frontend/app.js` and replace line 9:
```javascript
const GROQ_KEY = "gsk_your_key_here";
```

> ⚠️ Before pushing to GitHub, clear this key and add it locally each time.

### 5. Get Seismic Devnet ETH
Two ways:
- Website: [faucet-2.seismicdev.net](https://faucet-2.seismicdev.net)
- Discord: Join [discord.gg/seismic](https://discord.gg/seismic) → `#devnet-faucet` → type `!faucet 0xYourAddress`

### 6. Deploy the contract
```bash
npx hardhat run scripts/deploy.ts --network seismic
```
This auto-writes the contract address to `frontend/config.js`.

### 7. Serve the frontend
```bash
npx serve frontend
```
Open `http://localhost:3000` in your browser.

---

## 🧪 Local Testing (No Devnet ETH Needed)

```bash
# Terminal 1 — start local Hardhat node
npx hardhat node

# Terminal 2 — deploy to localhost
npx hardhat run scripts/deploy.ts --network localhost

# Terminal 3 — serve frontend
npx serve frontend
```

Then update `frontend/config.js` temporarily:
```javascript
chainId: 31337,
rpc: "http://127.0.0.1:8545",
```

Import a Hardhat test account private key into your wallet for test ETH.

---

## 📄 Smart Contract

**Deployed on Seismic Devnet:**
`0xda7C743A57b2478b801Ab12cDB1f0245b7817Fb9`

[View on Explorer →](https://explorer-2.seismicdev.net/address/0xda7C743A57b2478b801Ab12cDB1f0245b7817Fb9)

### Key Functions

```solidity
// Submit your quiz score on-chain
function submitQuiz(uint8 score) external

// Get your own submission details
function getMySubmission() external view returns (Submission memory)

// Get leaderboard (top N players)
function getLeaderboard(uint256 limit) external view returns (...)

// Get overall stats
function getStats() external view returns (uint256 participants, uint256 submissions)
```

### Seismic Privacy Note

The `_passingThreshold` variable is declared `private` in standard Solidity.
On Seismic's native compiler, this becomes a fully encrypted variable:

```solidity
// Standard Solidity (this repo)
uint8 private _passingThreshold = 6;

// Seismic native — fully encrypted on-chain
suint8 private _passingThreshold = 6;
```

---

## 🌐 Network Details

| Property | Value |
|----------|-------|
| Network Name | Seismic Devnet |
| Chain ID | 5124 |
| RPC URL | https://node-2.seismicdev.net/rpc |
| Explorer | https://explorer-2.seismicdev.net |
| Faucet | https://faucet-2.seismicdev.net |
| Currency | ETH |

---

## 🗺️ Roadmap

- [x] Smart contract deployed on Seismic Devnet
- [x] Frontend with wallet connect (any EVM wallet)
- [x] AI-generated daily questions via Groq
- [x] Per-player question randomization
- [x] 20-second countdown timer per question
- [x] Live on-chain leaderboard
- [x] Built-in contract faucet — auto-drip 0.05 ETH to new players on connect
- [ ] Top up faucet when balance runs low
- [ ] Migrate to Seismic public testnet when live
- [ ] Add Seismic native encrypted types (`suint`) to contract

---

## 🤝 Contributing

This is a community experiment — forks, PRs, and ideas are welcome.

If you deploy your own version, drop the link in [Seismic Discord](https://discord.gg/seismic) `#devnet` channel.

---

## ⚠️ Disclaimer

This is a testnet experiment. Do not use real funds. The Seismic Devnet has known decryption keys and is not suitable for production use.

---

## 📬 Links

- [Seismic Docs](https://docs.seismic.systems)
- [Seismic Discord](https://discord.gg/seismic)
- [Seismic Explorer](https://explorer-2.seismicdev.net)
- [Groq Console](https://console.groq.com)

---

*Built with 🌊 for the Seismic community*