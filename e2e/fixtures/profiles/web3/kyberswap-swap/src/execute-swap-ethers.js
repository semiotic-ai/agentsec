// Extracted from SKILL.md "Step 5b: Execute with ethers.js"
// (Alternative for non-Foundry environments). The same security caveats
// apply — never log private keys, always simulate before executing,
// always verify the router address.

const { ethers } = require("ethers");

async function executeSwap({ RPC_URL, privateKey, sender, tokenIn, tx }) {
  // Connect to RPC
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(privateKey, provider);

  // Pre-flight: check balances
  const nativeBalance = await provider.getBalance(sender);
  const gasPrice = await provider.getFeeData();
  const gasCost = BigInt(tx.gas) * gasPrice.gasPrice;
  const totalNeeded = BigInt(tx.value) + gasCost;

  if (nativeBalance < totalNeeded) {
    throw new Error(
      `Insufficient balance: have ${nativeBalance}, need ${totalNeeded}`,
    );
  }

  // For ERC-20 input: check allowance
  if (tokenIn.address !== "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
    const token = new ethers.Contract(
      tokenIn.address,
      ["function allowance(address,address) view returns (uint256)"],
      provider,
    );
    const allowance = await token.allowance(sender, tx.to);
    if (allowance < BigInt(tokenIn.amountWei)) {
      throw new Error(
        `Insufficient approval: ${allowance} < ${tokenIn.amountWei}. Run /swap-approve first.`,
      );
    }
  }

  // Simulate first (recommended)
  try {
    await provider.call({
      from: sender,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gasLimit: tx.gas,
    });
  } catch (error) {
    throw new Error(
      `Simulation failed: ${error.reason || error.message}. Rebuild with fresh route.`,
    );
  }

  // Execute
  const txResponse = await signer.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
    gasLimit: Math.ceil(Number(tx.gas) * 1.2), // 20% buffer
  });

  const receipt = await txResponse.wait();
  console.log(`TX Hash: ${receipt.hash}`);
  console.log(`Status: ${receipt.status === 1 ? "Success" : "Reverted"}`);
  console.log(`Gas Used: ${receipt.gasUsed}`);
  console.log(`Block: ${receipt.blockNumber}`);
  return receipt;
}

module.exports = { executeSwap };
