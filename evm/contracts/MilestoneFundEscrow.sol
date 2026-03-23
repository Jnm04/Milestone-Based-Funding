// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MilestoneFundEscrow
 * @notice Holds RLUSD (ERC-20) in escrow per milestone.
 *
 * Flow:
 *   1. Investor calls fundMilestone() — locks RLUSD for a specific milestone.
 *   2. Startup submits work proof off-chain; AI verifies it.
 *   3. Platform calls releaseMilestone() — transfers RLUSD to startup.
 *      OR
 *   3. After deadline, platform calls cancelMilestone() — returns RLUSD to investor.
 *
 * Access control:
 *   - fundMilestone  → any address (must be the investor who holds RLUSD)
 *   - releaseMilestone / cancelMilestone → platform wallet only
 *   - setPlatform → contract owner only
 */
contract MilestoneFundEscrow is Ownable, ReentrancyGuard {
    IERC20 public immutable rlusd;
    address public platform;

    struct MilestoneEscrow {
        address investor;   // who funded (gets refund on cancel)
        address startup;    // who receives funds on release
        uint256 amount;     // in RLUSD units (6 decimals)
        uint256 deadline;   // unix timestamp — cancel allowed after this
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

    modifier onlyPlatform() {
        require(msg.sender == platform, "Only platform");
        _;
    }

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
     * @param contractId  keccak256 of the off-chain contract DB id
     * @param milestoneOrder  0-indexed milestone position
     * @param startup   EVM address of the startup receiving funds on approval
     * @param amount    RLUSD amount in token units (6 decimals)
     * @param deadline  Unix timestamp after which cancel is allowed
     */
    function fundMilestone(
        bytes32 contractId,
        uint256 milestoneOrder,
        address startup,
        uint256 amount,
        uint256 deadline
    ) external nonReentrant {
        MilestoneEscrow storage e = escrows[contractId][milestoneOrder];
        require(!e.funded, "Already funded");
        require(amount > 0, "Amount must be > 0");
        require(startup != address(0), "Invalid startup address");
        require(deadline > block.timestamp, "Deadline must be in the future");

        require(
            rlusd.transferFrom(msg.sender, address(this), amount),
            "RLUSD transfer failed - check approval"
        );

        e.investor = msg.sender;
        e.startup = startup;
        e.amount = amount;
        e.deadline = deadline;
        e.funded = true;

        emit MilestoneFunded(contractId, milestoneOrder, msg.sender, amount);
    }

    /**
     * @notice Platform releases escrowed RLUSD to the startup after AI approval.
     */
    function releaseMilestone(
        bytes32 contractId,
        uint256 milestoneOrder
    ) external onlyPlatform nonReentrant {
        MilestoneEscrow storage e = escrows[contractId][milestoneOrder];
        require(e.funded, "Not funded");
        require(!e.completed, "Already completed");
        require(!e.cancelled, "Already cancelled");

        e.completed = true;
        require(rlusd.transfer(e.startup, e.amount), "RLUSD release failed");

        emit MilestoneReleased(contractId, milestoneOrder, e.startup, e.amount);
    }

    /**
     * @notice Platform cancels an expired escrow, returning RLUSD to the investor.
     */
    function cancelMilestone(
        bytes32 contractId,
        uint256 milestoneOrder
    ) external onlyPlatform nonReentrant {
        MilestoneEscrow storage e = escrows[contractId][milestoneOrder];
        require(e.funded, "Not funded");
        require(!e.completed, "Already completed");
        require(!e.cancelled, "Already cancelled");
        require(block.timestamp > e.deadline, "Deadline not yet passed");

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
