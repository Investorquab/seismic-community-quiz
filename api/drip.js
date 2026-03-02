import { ethers } from "ethers";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.body;
  if (!address || !address.startsWith('0x')) {
    return res.status(400).json({ error: 'Valid address required' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.SEISMIC_RPC);
    const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Check if address already received a drip (check balance)
    const balance = await provider.getBalance(address);
    if (balance > ethers.parseEther("0.01")) {
      return res.json({ success: false, reason: "Balance sufficient" });
    }

    // Send 0.05 ETH directly
    const tx = await wallet.sendTransaction({
      to: address,
      value: ethers.parseEther("0.05"),
    });

    await tx.wait();
    res.json({ success: true, txHash: tx.hash });

  } catch (err) {
    console.error("Drip error:", err);
    res.status(500).json({ error: err.message });
  }
}
