// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SeismicQuiz
 * @notice Community testnet experiment — on-chain quiz for Seismic network
 * @dev Deploys on Seismic Devnet (Chain ID: 5124)
 *
 * BUILT-IN FAUCET:
 * New players with low balance automatically receive 0.05 ETH
 * so they can participate without needing to claim from a faucet.
 *
 * SEISMIC PRIVACY NOTE:
 * _passingThreshold is private in standard Solidity.
 * On Seismic-native compiler, swap uint8 → suint8 to make
 * it fully encrypted and invisible on-chain.
 */
contract SeismicQuiz {

    // ─── Constants ────────────────────────────────────────
    uint8   public constant MAX_SCORE   = 10;
    uint256 public constant DRIP_AMOUNT = 0.05 ether;
    uint256 public constant MIN_BALANCE = 0.01 ether;

    uint8 private _passingThreshold = 6;

    // ─── Owner ────────────────────────────────────────────
    address public owner;

    // ─── Structs ──────────────────────────────────────────
    struct Submission {
        address player;
        uint8   score;
        uint8   attempts;
        uint256 lastSubmitted;
        bool    passed;
    }

    // ─── State ────────────────────────────────────────────
    mapping(address => Submission) public submissions;
    mapping(address => bool)       public hasClaimed;
    address[] public players;
    uint256 public totalParticipants;
    uint256 public totalSubmissions;
    uint256 public totalDrips;

    // ─── Events ───────────────────────────────────────────
    event QuizSubmitted(address indexed player, uint8 score, bool passed, uint256 timestamp);
    event PerfectScore(address indexed player, uint256 timestamp);
    event FirstTimer(address indexed player, uint256 timestamp);
    event FaucetDrip(address indexed player, uint256 amount, uint256 timestamp);
    event FaucetFunded(address indexed funder, uint256 amount);

    // ─── Modifier ─────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ─── Constructor ──────────────────────────────────────
    constructor() payable {
        owner = msg.sender;
    }

    receive() external payable {
        emit FaucetFunded(msg.sender, msg.value);
    }

    // ─── FAUCET ───────────────────────────────────────────
    function requestDrip() external {
        require(!hasClaimed[msg.sender], "Already claimed faucet");
        require(address(this).balance >= DRIP_AMOUNT, "Faucet empty");
        require(msg.sender.balance < MIN_BALANCE, "Balance sufficient");

        hasClaimed[msg.sender] = true;
        totalDrips++;

        (bool sent, ) = payable(msg.sender).call{value: DRIP_AMOUNT}("");
        require(sent, "Drip failed");

        emit FaucetDrip(msg.sender, DRIP_AMOUNT, block.timestamp);
    }

    function canClaimDrip(address player) external view returns (bool) {
        return (
            !hasClaimed[player] &&
            player.balance < MIN_BALANCE &&
            address(this).balance >= DRIP_AMOUNT
        );
    }

    function faucetBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─── QUIZ ─────────────────────────────────────────────
    function submitQuiz(uint8 score) external {
        require(score <= MAX_SCORE, "Score exceeds maximum");

        bool isNew  = submissions[msg.sender].player == address(0);
        bool passed = score >= _passingThreshold;

        if (isNew) {
            players.push(msg.sender);
            totalParticipants++;
            emit FirstTimer(msg.sender, block.timestamp);
        }

        submissions[msg.sender] = Submission({
            player:        msg.sender,
            score:         score,
            attempts:      isNew ? 1 : submissions[msg.sender].attempts + 1,
            lastSubmitted: block.timestamp,
            passed:        passed
        });

        totalSubmissions++;
        emit QuizSubmitted(msg.sender, score, passed, block.timestamp);

        if (score == MAX_SCORE) {
            emit PerfectScore(msg.sender, block.timestamp);
        }
    }

    // ─── VIEWS ────────────────────────────────────────────
    function getMySubmission() external view returns (Submission memory) {
        return submissions[msg.sender];
    }

    function getLeaderboard(uint256 limit)
        external view
        returns (address[] memory addrs, uint8[] memory scores, bool[] memory passed)
    {
        uint256 count = limit < players.length ? limit : players.length;
        addrs  = new address[](count);
        scores = new uint8[](count);
        passed = new bool[](count);

        for (uint256 i = 0; i < count; i++) {
            address p = players[i];
            addrs[i]  = p;
            scores[i] = submissions[p].score;
            passed[i] = submissions[p].passed;
        }
    }

    function getStats()
        external view
        returns (uint256 participants, uint256 submissions_, uint256 drips, uint256 faucetBal)
    {
        return (totalParticipants, totalSubmissions, totalDrips, address(this).balance);
    }

    // ─── OWNER ────────────────────────────────────────────
    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient");
        (bool sent, ) = payable(owner).call{value: amount}("");
        require(sent, "Withdraw failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}