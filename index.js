const express = require('express');
const dotenv = require('dotenv');
const bs58 = require('bs58');
const {
  Connection,
  PublicKey,
  clusterApiUrl,
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getMint,
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');

// Load env variables
dotenv.config();

// Create Express app
const app = express();
app.use(express.json());

// Setup Solana connection
const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

// Load admin wallet
const secretKey = bs58.decode(process.env.ADMIN_PRIVATE_KEY_BASE58);
const adminKeypair = Keypair.fromSecretKey(secretKey);

// Mint address of BEEMX token
const mintAddress = new PublicKey(process.env.MINT_ADDRESS);

app.post('/withdraw', async (req, res) => {
  try {
    const { to, amount } = req.body;

    if (!to || !amount) {
      return res.status(400).json({ success: false, error: 'Missing "to" or "amount" in request' });
    }

    const toPublicKey = new PublicKey(to);

    // ✅ Check admin SOL balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient SOL in admin wallet to pay for fees / ATA creation',
      });
    }

    // ✅ Get mint decimals dynamically
    const mintInfo = await getMint(connection, mintAddress);
    const decimals = mintInfo.decimals;
    const amountInBaseUnits = BigInt(Math.floor(amount * 10 ** decimals));

    // ✅ Ensure admin has token account (sender)
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      mintAddress,
      adminKeypair.publicKey
    );

    // ✅ Ensure recipient has token account (create if needed)
    let toTokenAccount;
    try {
      toTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        adminKeypair, // payer (covers ATA creation rent if needed)
        mintAddress,
        toPublicKey
      );
    } catch (err) {
      console.error("❌ Failed to create recipient ATA:", err);
      return res.status(500).json({ success: false, error: "Failed to create recipient token account" });
    }

    // ✅ Create token transfer instruction
    const transferInstruction = createTransferInstruction(
      fromTokenAccount.address,
      toTokenAccount.address,
      adminKeypair.publicKey,
      amountInBaseUnits,
      [],
      TOKEN_PROGRAM_ID
    );

    // ✅ Build and send transaction
    const transaction = new Transaction().add(transferInstruction);
    transaction.feePayer = adminKeypair.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const signature = await sendAndConfirmTransaction(connection, transaction, [adminKeypair]);

    return res.json({ success: true, signature });
  } catch (error) {
    console.error("❌ Withdrawal error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unexpected error",
    });
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
