// ════════════════════════════════════════════════════════════
//  Seismic Quiz — app.js
//  Community Testnet Experiment
//  AI-powered daily questions via Groq API
// ════════════════════════════════════════════════════════════

// ── CONFIG ───────────────────────────────────────────────────
// Paste your Groq API key here (keep this file out of git!
const GROQ_KEY = "YOUR_GROQ_KEY_HERE";

const QUESTIONS_PER_SESSION = 10;
const PASSING_SCORE         = 6;
const SECONDS_PER_QUESTION  = 20;

// ── CONTRACT ABI ─────────────────────────────────────────────
const ABI = [
  "function submitQuiz(uint8 score) external",
  "function requestDrip() external",
  "function canClaimDrip(address player) external view returns (bool)",
  "function faucetBalance() external view returns (uint256)",
  "function getStats() external view returns (uint256 participants, uint256 submissions_, uint256 drips, uint256 faucetBal)",
  "function getLeaderboard(uint256 limit) external view returns (address[] memory addrs, uint8[] memory scores, bool[] memory passed)",
  "function getMySubmission() external view returns (tuple(address player, uint8 score, uint8 attempts, uint256 lastSubmitted, bool passed))",
  "event QuizSubmitted(address indexed player, uint8 score, bool passed, uint256 timestamp)",
  "event FaucetDrip(address indexed player, uint256 amount, uint256 timestamp)",
];

// ── QUESTION TOPICS ───────────────────────────────────────────
const TOPICS = [
  "Seismic network architecture and encrypted state using Trusted Execution Environments (TEE) via Intel TDX",
  "Seismic suint, sbool, saddress native encrypted types and how they differ from standard Solidity",
  "Privacy in fintech and blockchain — why on-chain privacy matters for real-world finance",
  "EVM compatibility — how Seismic supports Solidity contracts with minimal changes",
  "Zero-knowledge proofs vs TEE-based privacy — differences, tradeoffs, and use cases",
  "Smart contract security — reentrancy, overflow, access control vulnerabilities",
  "DeFi security — oracle manipulation, flash loan attacks, and MEV",
  "Blockchain fundamentals — consensus mechanisms, validators, finality",
  "Private transactions — how shielded state differs from public on-chain data",
  "Testnet concepts — why testnets exist, faucets, gas, chain IDs, RPC endpoints",
  "Seismic vision for confidential smart contracts and private DeFi applications",
  "Key management and wallet security best practices for Web3 users",
  "Cryptographic primitives — hashing, digital signatures, public/private keys",
  "Layer 1 vs Layer 2 — rollups, bridges, and settlement",
  "Gas optimization — how to write efficient Solidity code",
  "How Seismic uses reth (Rust Ethereum) as its execution layer base",
  "What makes a blockchain privacy-preserving vs pseudonymous",
  "Wallet types — EOA vs smart contract wallets, multisig, hardware wallets",
  "Solidity visibility modifiers — public, private, internal, external",
  "Event logs in Solidity — what they store, why they are gas-efficient",
];

// ── STATE ─────────────────────────────────────────────────────
let provider      = null;
let signer        = null;
let contract      = null;
let allQuestions  = [];
let questions     = [];
let userAnswers   = [];
let answeredCount = 0;
let toastTimer    = null;

// ── TIMER STATE ───────────────────────────────────────────────
let currentQuestion = 0;
let timeLeft        = SECONDS_PER_QUESTION;
let timerInterval   = null;
let quizFinished    = false;

// ── HELPERS ───────────────────────────────────────────────────
function getDaySeed() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-US", {
    month:"short", day:"numeric", year:"numeric", timeZone:"UTC"
  });
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Per-player randomization: same player gets same order, different players get different order
function shuffleForPlayer(arr, playerAddr) {
  const seed = playerAddr.toLowerCase() + getDaySeed();
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = simpleHash(seed + i) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("statDate").textContent = getTodayLabel();
  if (window.ethereum && window.ethereum.selectedAddress) await connectWallet();
});


// ── AUTO FAUCET DRIP ─────────────────────────────────────────
async function checkAndDrip() {
  if (!contract || !signer) return;
  try {
    const addr = await signer.getAddress();
    const eligible = await contract.canClaimDrip(addr);
    if (!eligible) return;

    showToast("🪙 Low balance detected — requesting free devnet ETH...");
    const tx = await contract.requestDrip();
    await tx.wait();

    // Refresh balance display
    await updateWalletUI();
    showToast("✅ 0.05 ETH sent to your wallet! You can now play the quiz.", "success");
  } catch (err) {
    console.warn("Faucet drip skipped:", err.reason || err.message);
  }
}

// ── WALLET CONNECTION ─────────────────────────────────────────
async function connectWallet() {
  if (!window.ethereum) {
    showToast("No EVM wallet found. Install MetaMask, Rabby, or Coinbase Wallet.", "error");
    return;
  }
  try {
    showToast("Connecting wallet...");
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await switchToSeismic();

    provider = new ethers.BrowserProvider(window.ethereum);
    signer   = await provider.getSigner();
    contract = new ethers.Contract(CONFIG.contractAddress, ABI, signer);

    await updateWalletUI();
    await checkAndDrip();  // auto-send ETH if balance is low

    document.getElementById("connectPrompt").style.display = "none";
    document.getElementById("quizSection").classList.add("visible");
    document.getElementById("walletBar").classList.add("visible");
    document.getElementById("connectBtn").textContent = "Connected ✓";
    document.getElementById("connectBtn").classList.add("connected");

    await Promise.all([loadStats(), loadLeaderboard(), loadQuestions()]);
    setInterval(() => Promise.all([loadStats(), loadLeaderboard()]), 20000);

  } catch (err) {
    console.error(err);
    showToast(err.code === 4001 ? "Wallet rejected." : (err.message || "Connection failed."), "error");
  }
}

// ── SWITCH TO SEISMIC DEVNET ──────────────────────────────────
async function switchToSeismic() {
  const chainHex = "0x" + CONFIG.chainId.toString(16);
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: chainHex,
          chainName: "Seismic Devnet",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: [CONFIG.rpc],
          blockExplorerUrls: [CONFIG.explorer],
        }],
      });
    } else throw err;
  }
}

async function updateWalletUI() {
  const addr = await signer.getAddress();
  const bal  = await provider.getBalance(addr);
  const net  = await provider.getNetwork();
  document.getElementById("walletAddr").textContent = addr.slice(0,6) + "..." + addr.slice(-4);
  document.getElementById("walletBal").textContent  = parseFloat(ethers.formatEther(bal)).toFixed(4) + " ETH";
  document.getElementById("walletNet").textContent  = `Seismic Devnet (${net.chainId})`;
}

// ════════════════════════════════════════════════════════════
//  AI QUESTION GENERATION (GROQ)
// ════════════════════════════════════════════════════════════

async function loadQuestions() {
  document.getElementById("questionsLoading").style.display = "block";
  document.getElementById("questionsContainer").style.display = "none";

  const cacheKey = `seismic_pool_${getDaySeed()}`;
  const cached   = sessionStorage.getItem(cacheKey);

  try {
    if (cached) {
      allQuestions = JSON.parse(cached);
    } else {
      allQuestions = await generateQuestionsWithAI();
      sessionStorage.setItem(cacheKey, JSON.stringify(allQuestions));
    }

    // Each player gets a unique random order based on their wallet address
    const addr = await signer.getAddress();
    questions  = shuffleForPlayer(allQuestions, addr).slice(0, QUESTIONS_PER_SESSION);

    userAnswers   = new Array(questions.length).fill(null);
    answeredCount = 0;
    renderQuestions();

  } catch (err) {
    console.error("Question load failed:", err);
    document.getElementById("questionsLoading").innerHTML =
      `<span style="color:var(--rust)">Failed to load questions. Check GROQ_KEY in app.js<br/><small>${err.message}</small></span>`;
  }
}

async function generateQuestionsWithAI() {
  const seed        = getDaySeed();
  const shuffled    = [...TOPICS].sort((a, b) => simpleHash(a+seed) - simpleHash(b+seed));
  const todayTopics = shuffled.slice(0, 7).join("; ");

  const prompt = `You are generating quiz questions for the Seismic blockchain community quiz.
Date seed: ${seed}
Topics: ${todayTopics}

Generate exactly 20 multiple choice questions.
Rules:
- Each question has exactly 4 options
- Only one is correct
- Be specific and educational
- Mix easy, medium, and hard
- Focus on Seismic, privacy tech, crypto security, and blockchain

Respond ONLY with a JSON array. No markdown, no preamble.
[{"question":"...","options":["A","B","C","D"],"correct":0}]
"correct" is 0-based index of the right answer.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 4000,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.error?.message || `Groq error ${res.status}`);
  }

  const data    = await res.json();
  const raw     = data.choices[0].message.content.trim();
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed  = JSON.parse(cleaned);

  if (!Array.isArray(parsed) || parsed.length < 10) throw new Error("Bad question format");
  return parsed;
}

// ════════════════════════════════════════════════════════════
//  QUIZ UI — ONE QUESTION AT A TIME WITH COUNTDOWN TIMER
// ════════════════════════════════════════════════════════════

function renderQuestions() {
  document.getElementById("questionsLoading").style.display = "none";
  document.getElementById("questionsContainer").style.display = "block";
  document.getElementById("progressWrap").style.display = "block";
  document.getElementById("submitBtn").style.display = "none";
  currentQuestion = 0;
  quizFinished    = false;
  showQuestion(0);
}

function showQuestion(qi) {
  const q       = questions[qi];
  const letters = ["A", "B", "C", "D"];

  document.getElementById("questionsContainer").innerHTML = `
    <div class="question-card active-question">
      <div class="q-meta">
        <div class="q-number">Question ${qi+1} of ${questions.length}</div>
        <div class="q-timer">
          <svg viewBox="0 0 36 36" width="52" height="52">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#ddd0bc" stroke-width="2.5"/>
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--sienna)" stroke-width="2.5"
              stroke-dasharray="94.2" stroke-dashoffset="0" id="timerArc"
              stroke-linecap="round" transform="rotate(-90 18 18)"/>
          </svg>
          <span id="timerNum" class="timer-num">${SECONDS_PER_QUESTION}</span>
        </div>
      </div>
      <div class="q-text">${q.question}</div>
      <div class="options" id="opts-${qi}">
        ${q.options.map((opt, oi) => `
          <label class="option${userAnswers[qi] === oi ? " selected" : ""}" id="opt-${qi}-${oi}">
            <span class="option-letter">${letters[oi]}</span>
            <span>${opt}</span>
          </label>
        `).join("")}
      </div>
      <div class="q-nav">
        ${qi > 0
          ? `<button class="nav-btn" onclick="goTo(${qi-1})">← Back</button>`
          : `<span></span>`}
        ${qi < questions.length - 1
          ? `<button class="nav-btn primary" onclick="goTo(${qi+1})">Next →</button>`
          : `<button class="nav-btn primary" onclick="finishQuiz()">Finish →</button>`}
      </div>
    </div>
  `;

  q.options.forEach((_, oi) => {
    const el = document.getElementById(`opt-${qi}-${oi}`);
    if (el) el.addEventListener("click", () => selectAnswer(qi, oi));
  });

  updateProgress();
  startTimer(qi);
}

function goTo(qi) {
  clearTimer();
  currentQuestion = qi;
  showQuestion(qi);
}

function selectAnswer(qi, oi) {
  const wasNew = userAnswers[qi] === null;
  userAnswers[qi] = oi;
  questions[qi].options.forEach((_, idx) => {
    const el = document.getElementById(`opt-${qi}-${idx}`);
    if (el) el.classList.toggle("selected", idx === oi);
  });
  if (wasNew) { answeredCount++; updateProgress(); }
}

function updateProgress() {
  const total = questions.length;
  const pct   = total > 0 ? (answeredCount / total) * 100 : 0;
  const t     = document.getElementById("progressText");
  const f     = document.getElementById("progressFill");
  if (t) t.textContent  = `${answeredCount} / ${total} answered`;
  if (f) f.style.width  = pct + "%";
}

// ── TIMER ─────────────────────────────────────────────────────
function startTimer(qi) {
  clearTimer();
  timeLeft = SECONDS_PER_QUESTION;
  updateTimerUI();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 0) {
      clearTimer();
      if (qi < questions.length - 1) {
        showToast("⏱ Time's up! Next question.");
        setTimeout(() => goTo(qi + 1), 700);
      } else {
        showToast("⏱ Time's up! Quiz complete.");
        setTimeout(() => finishQuiz(), 700);
      }
    }
  }, 1000);
}

function clearTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerUI() {
  const num = document.getElementById("timerNum");
  const arc = document.getElementById("timerArc");
  if (!num || !arc) return;

  num.textContent = timeLeft;
  arc.style.strokeDashoffset = 94.2 * (1 - timeLeft / SECONDS_PER_QUESTION);

  const danger = timeLeft <= 5;
  arc.style.stroke  = danger ? "var(--rust)"   : "var(--sienna)";
  num.style.color   = danger ? "var(--rust)"   : "var(--text)";
  num.style.fontWeight = danger ? "700" : "400";
}

// ── FINISH ────────────────────────────────────────────────────
function finishQuiz() {
  if (quizFinished) return;
  clearTimer();
  quizFinished = true;

  document.getElementById("questionsContainer").innerHTML = `
    <div class="question-card" style="text-align:center;padding:44px 28px">
      <div style="font-family:var(--font-head);font-size:32px;color:var(--espresso);margin-bottom:10px">Quiz Complete!</div>
      <div style="font-family:var(--font-mono);font-size:12px;color:var(--muted);margin-bottom:20px;letter-spacing:2px">
        ${answeredCount} OF ${questions.length} QUESTIONS ANSWERED
      </div>
      <div style="font-family:var(--font-body);font-size:15px;color:var(--mid-brown)">
        Submit your score on-chain to Seismic Devnet below.
      </div>
    </div>
  `;

  document.getElementById("submitBtn").style.display   = "block";
  document.getElementById("submitBtn").disabled        = false;
  document.getElementById("submitNote").style.display  = "block";
  document.getElementById("submitBtn").scrollIntoView({ behavior:"smooth", block:"center" });
}

// ════════════════════════════════════════════════════════════
//  ON-CHAIN SUBMISSION
// ════════════════════════════════════════════════════════════

async function submitQuiz() {
  let correct = 0;
  questions.forEach((q, i) => { if (userAnswers[i] === q.correct) correct++; });
  const score = Math.min(correct, 10);

  const btn = document.getElementById("submitBtn");
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    showToast("Sending transaction to Seismic Devnet...");
    const tx      = await contract.submitQuiz(score);
    showToast("Confirmed! Waiting for receipt...");
    const receipt = await tx.wait();
    console.log("Receipt:", receipt);
    showResult(score, correct, tx.hash);
    await Promise.all([loadStats(), loadLeaderboard()]);
    showToast(score >= PASSING_SCORE ? `🎉 Passed with ${score}/10!` : `Score: ${score}/10 — try again tomorrow!`,
      score >= PASSING_SCORE ? "success" : "error");
  } catch (err) {
    console.error(err);
    showToast(err.code === 4001 ? "Transaction rejected." : (err.reason || err.message || "Transaction failed."), "error");
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

function showResult(score, correct, txHash) {
  const passed = score >= PASSING_SCORE;
  document.getElementById("resultScore").textContent = score;
  document.getElementById("resultScore").className   = "result-score" + (passed ? "" : " fail");

  const b = document.getElementById("resultBadge");
  b.textContent = passed ? `✓ PASSED — ${correct}/${questions.length} correct` : `✗ FAILED — ${correct}/${questions.length} correct`;
  b.className   = "result-badge " + (passed ? "pass" : "fail");

  document.getElementById("txInfo").innerHTML = `
    <strong>TX Hash:</strong><br/>
    <a href="${CONFIG.explorer}/tx/${txHash}" target="_blank">${txHash}</a><br/><br/>
    <strong>Contract:</strong><br/>
    <a href="${CONFIG.explorer}/address/${CONFIG.contractAddress}" target="_blank">${CONFIG.contractAddress}</a>
  `;

  // Build answer review
  const letters = ["A", "B", "C", "D"];
  const reviewHTML = questions.map((q, i) => {
    const userAns    = userAnswers[i];
    const correctAns = q.correct;
    const isCorrect  = userAns === correctAns;
    const skipped    = userAns === null;

    const optionsHTML = q.options.map((opt, oi) => {
      let style = "";
      let icon  = "";
      if (oi === correctAns) {
        style = "background:#e8f5e0;border-color:var(--moss);";
        icon  = "✅";
      } else if (oi === userAns && !isCorrect) {
        style = "background:#fde8e0;border-color:var(--rust);";
        icon  = "❌";
      }
      return `
        <div class="review-option" style="${style}">
          <span class="option-letter" style="color:${oi===correctAns?"var(--moss)":oi===userAns?"var(--rust)":"var(--muted)"}">${letters[oi]}</span>
          <span>${opt}</span>
          ${icon ? `<span style="margin-left:auto">${icon}</span>` : ""}
        </div>`;
    }).join("");

    return `
      <div class="review-card">
        <div class="review-qnum">Q${String(i+1).padStart(2,"0")} — ${isCorrect ? '<span style="color:var(--moss)">CORRECT</span>' : skipped ? '<span style="color:var(--muted)">SKIPPED</span>' : '<span style="color:var(--rust)">WRONG</span>'}</div>
        <div class="review-qtext">${q.question}</div>
        <div class="review-options">${optionsHTML}</div>
        ${!isCorrect ? `<div class="review-explanation">✏️ Correct answer: <strong>${letters[correctAns]}. ${q.options[correctAns]}</strong></div>` : ""}
      </div>`;
  }).join("");

  document.getElementById("answerReview").innerHTML = `
    <div class="section-head" style="margin-top:40px"><h2>Answer Review</h2></div>
    ${reviewHTML}
  `;
  document.getElementById("answerReview").style.display = "block";

  const r = document.getElementById("resultSection");
  r.classList.add("visible");
  r.scrollIntoView({ behavior:"smooth", block:"center" });
}

// ── STATS + LEADERBOARD ───────────────────────────────────────
async function loadStats() {
  if (!contract) return;
  try {
    const [p, s, d, bal] = await contract.getStats();
    document.getElementById("statParticipants").textContent = p.toString();
    document.getElementById("statSubmissions").textContent  = s.toString();
    const faucetEl = document.getElementById("statFaucet");
    if (faucetEl) faucetEl.textContent = parseFloat(ethers.formatEther(bal)).toFixed(2) + " ETH";
  } catch (e) { console.warn("Stats:", e); }
}

async function loadLeaderboard() {
  if (!contract) return;
  try {
    const [addrs, scores, passed] = await contract.getLeaderboard(20);
    const tbody = document.getElementById("leaderBody");
    if (!addrs || addrs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:32px;font-style:italic">No submissions yet — be the first!</td></tr>`;
      return;
    }
    const rows   = Array.from(addrs).map((a,i) => ({ addr:a, score:Number(scores[i]), passed:passed[i] })).sort((a,b) => b.score - a.score);
    const medals = ["🥇","🥈","🥉"];
    tbody.innerHTML = rows.map((r,i) => `
      <tr>
        <td><span class="rank-num ${i<3?"rank-"+(i+1):""}">${medals[i]||"#"+(i+1)}</span></td>
        <td class="addr-cell">${r.addr.slice(0,8)}…${r.addr.slice(-6)}</td>
        <td class="score-cell" style="color:${r.score>=PASSING_SCORE?"var(--moss)":"var(--rust)"}">${r.score}/10</td>
        <td style="color:var(--muted);font-size:11px">—</td>
        <td><span class="pass-pill ${r.passed?"y":"n"}">${r.passed?"PASS":"FAIL"}</span></td>
      </tr>`).join("");
  } catch (e) { console.warn("Leaderboard:", e); }
}

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = `show ${type}`.trim();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ""; }, 4500);
}

// ── WALLET EVENTS ─────────────────────────────────────────────
if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => location.reload());
  window.ethereum.on("chainChanged",    () => location.reload());
}