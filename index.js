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
} = require('@solana/web3.js');
const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
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

// API Endpoint
app.post('/withdraw', async (req, res) => {
  try {
    const { to, amount } = req.body;

    if (!to || !amount) {
      return res.status(400).json({ success: false, error: 'Missing "to" or "amount" in request' });
    }

    const toPublicKey = new PublicKey(to);

    // Get admin's token account (sender)
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      mintAddress,
      adminKeypair.publicKey
    );

    // Get recipient's token account (receiver)
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair, // payer
      mintAddress,
      toPublicKey
    );

    // Create token transfer instruction (adjust decimals to 6 for BEEMX)
    const transferInstruction = createTransferInstruction(
      fromTokenAccount.address,
      toTokenAccount.address,
      adminKeypair.publicKey,
      amount * 10 ** 6, // Adjust based on BEEMX decimals (usually 6)
      [],
      TOKEN_PROGRAM_ID
    );

    // Send transaction
    const transaction = new Transaction().add(transferInstruction);
    const signature = await sendAndConfirmTransaction(connection, transaction, [adminKeypair]);

    return res.json({ success: true, signature });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
