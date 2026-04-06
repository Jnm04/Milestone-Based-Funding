// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MilestoneFundEscrow
 * @notice Holds RLUSD (ERC-20) in escrow per milestone.
 *
 * TRUSTLESS DESIGN — no party needs to trust the platform:
 *
 *   Release: Anyone who knows the fulfillment key can release funds to the startup.
 *            The platform reveals the key to the startup upon AI approval.
 *            Even if the platform disappears, the startup can self-execute.
 *
 *   Cancel:  The investor can cancel directly after the deadline without
 *            requiring any action from the platform.
 *
 * Flow:
 *   1. Investor calls fundMilestone() with a condition (keccak256 of a secret).
 *   2. Startup submits work proof off-chain; AI verifies it.
 *   3a. AI approves → platform reveals fulfillment key to startup.
 *       Anyone (startup or platform) calls releaseMilestone(fulfillment).
 *   3b. Deadline passes without approval → investor calls cancelMilestone() directly.
 *
 * Access control:
 *   - fundMilestone         → any address (must be the investor who holds RLUSD)
 *   - releaseMilestone      → anyone who knows the fulfillment key
 *   - cancelMilestone       → investor directly (after deadline) OR platform (emergency)
 *   - setPlatform           → contract owner only
 */
contract MilestoneFundEscrow is Ownable, ReentrancyGuard {
    IERC20 public immutable rlusd;
    address public platform;

    struct MilestoneEscrow {
        address investor;   // who funded (gets refund on cancel)
        address startup;    // who receives funds on release
        uint256 amount;     // in RLUSD units (6 decimals)
        uint256 deadline;   // unix timestamp — cancel allowed after this
        bytes32 condition;  // keccak256(fulfillment) — release requires the preimage
        bool funded;
        bool completed;
        bool cancelled;
    }

    // contractIdHash (keccak256 of DB id) → milestoneOrder → escrow
    mapping(bytes32 => mapping(uint256 => MilestoneEscrow)) public escrows;

    event MilestoneFunded(
        bytes32 indexed contractId,
        uint256 indexed milestoneOrder,
        address indexed investor,
        uint256 amount
    );
    event MilestoneReleased(
        bytes32 indexed contractId,
        uint256 indexed milestoneOrder,
        address startup,
        uint256 amount
    );
    event MilestoneCancelled(
        bytes32 indexed contractId,
        uint256 indexed milestoneOrder,
        address investor,
        uint256 amount
    );

    constructor(address _rlusd, address _platform) Ownable(msg.sender) {
        require(_rlusd != address(0), "Invalid RLUSD address");
        require(_platform != address(0), "Invalid platform address");
        rlusd = IERC20(_rlusd);
        platform = _platform;
    }

    /// @notice Update the platform wallet (owner only).
    function setPlatform(address _platform) external onlyOwner {
        require(_platform != address(0), "Invalid address");
        platform = _platform;
    }

    /**
     * @notice Investor locks RLUSD for a milestone.
     * @dev Caller must first call rlusd.approve(escrowContract, amount).
     * @param contractId      keccak256 of the off-chain contract DB id
     * @param milestoneOrder  0-indexed milestone position
     * @param startup         EVM address of the startup receiving funds on approval
     * @param amount          RLUSD amount in token units (6 decimals)
     * @param deadline        Unix timestamp after which cancel is allowed
     * @param condition       keccak256(fulfillment) — the platform generates this
     */
    function fundMilestone(
        bytes32 contractId,
        uint256 milestoneOrder,
        address startup,
        uint256 amount,
        uint256 deadline,
        bytes32 condition
    ) external nonReentrant {
        MilestoneEscrow storage e = escrows[contractId][milestoneOrder];
        require(!e.funded, "Already funded");
        require(amount > 0, "Amount must be > 0");
        require(startup != address(0), "Invalid startup address");
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(condition != bytes32(0), "Condition must not be empty");

        require(
            rlusd.transferFrom(msg.sender, address(this), amount),
            "RLUSD transfer failed - check approval"
        );

        e.investor = msg.sender;
        e.startup = startup;
        e.amount = amount;
        e.deadline = deadline;
        e.condition = condition;
        e.funded = true;

        emit MilestoneFunded(contractId, milestoneOrder, msg.sender, amount);
    }

    /**
     * @notice Releases escrowed RLUSD to the startup.
     * @dev Anyone who knows the fulfillment key can call this — no platform trust needed.
     *      The platform reveals the fulfillment to the startup upon AI approval.
     *      If the platform disappears, the startup can still self-execute.
     * @param fulfillment  The secret preimage: keccak256(fulfillment) must equal the stored condition.
     */
    function releaseMilestone(
        bytes32 contractId,
        uint256 milestoneOrder,
        bytes32 fulfillment
    ) external nonReentrant {
        MilestoneEscrow storage e = escrows[contractId][milestoneOrder];
        require(e.funded, "Not funded");
        require(!e.completed, "Already completed");
        require(!e.cancelled, "Already cancelled");
        require(keccak256(abi.encode(fulfillment)) == e.condition, "Invalid fulfillment key");

        e.completed = true;
        require(rlusd.transfer(e.startup, e.amount), "RLUSD release failed");

        emit MilestoneReleased(contractId, milestoneOrder, e.startup, e.amount);
    }

    /**
     * @notice Cancels an expired escrow and returns RLUSD to the investor.
     * @dev The investor can call this directly after the deadline — no platform needed.
     *      The platform can also call it as a fallback (e.g. automated cron job).
     */
    function cancelMilestone(
        bytes32 contractId,
        uint256 milestoneOrder
    ) external nonReentrant {
        MilestoneEscrow storage e = escrows[contractId][milestoneOrder];
        require(e.funded, "Not funded");
        require(!e.completed, "Already completed");
        require(!e.cancelled, "Already cancelled");
        require(block.timestamp > e.deadline, "Deadline not yet passed");
        require(
            msg.sender == e.investor || msg.sender == platform,
            "Only investor or platform"
        );

        e.cancelled = true;
        require(rlusd.transfer(e.investor, e.amount), "RLUSD refund failed");

        emit MilestoneCancelled(contractId, milestoneOrder, e.investor, e.amount);
    }

    /// @notice Read escrow state for a milestone (for off-chain verification).
    function getMilestoneEscrow(
        bytes32 contractId,
        uint256 milestoneOrder
    ) external view returns (MilestoneEscrow memory) {
        return escrows[contractId][milestoneOrder];
    }
}
