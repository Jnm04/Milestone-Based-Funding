// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockRLUSD
 * @notice Test ERC-20 token for local/testnet use only.
 *         Mimics RLUSD with 6 decimal places.
 *         NOT for mainnet — use the real RLUSD contract address there.
 */
contract MockRLUSD is ERC20 {
    constructor() ERC20("Mock RLUSD", "RLUSD") {
        // Mint 10M tokens to deployer for distribution
        _mint(msg.sender, 10_000_000 * 10 ** 6);
    }

    /// @dev RLUSD uses 6 decimals (like USDC).
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Testnet faucet — anyone can mint tokens for testing.
    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
