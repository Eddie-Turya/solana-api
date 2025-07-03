require('dotenv').config();
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const {
  Token,
  TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const bs58 = require('bs58');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const connection = new Connection('https://api.mainnet-beta.solana.com');

const base58Secret = process.env.ADMIN_PRIVATE_KEY_BASE58;
const secretKey = bs58.decode(base58Secret);
const admin = Keypair.fromSecretKey(secretKey);

// Replace with your BEEMX token mint address
const BEEMX_MINT_ADDRESS = new PublicKey('ACMk9h76WrHaLFy7GYZB4yCea62KruCyj9jFQGq15P6o');

async function sendBeemx(toPubkey, amountTokens) {
  const token = new Token(connection, BEEMX_MINT_ADDRESS, TOKEN_PROGRAM_ID, admin);

  // Get or create associated token account for admin (sender)
  const fromTokenAccount = await token.getOrCreateAssociatedAccountInfo(admin.publicKey);

  // Get or create associated token account for receiver
  const toTokenAccount = await token.getOrCreateAssociatedAccountInfo(toPubkey);

  // BEEMX decimals (confirm decimals, usually 6)
  const decimals = 6;
  const amount = amountTokens * Math.pow(10, decimals);

  const transaction = new Transaction().add(
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      fromTokenAccount.address,
      toTokenAccount.address,
      admin.publicKey,
      [],
      amount
    )
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [admin]);
  return signature;
}

app.post('/withdraw', async (req, res) => {
  const { to, amount } = req.body;

  if (!to || !amount) {
    return res.status(400).json({ success: false, error: 'Missing "to" or "amount" in request' });
  }

  try {
    const toPubkey = new PublicKey(to);
    const txSignature = await sendBeemx(toPubkey, amount);
    res.json({ success: true, tx: txSignature });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
