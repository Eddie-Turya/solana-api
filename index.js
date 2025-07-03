require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const bs58 = require('bs58');

const app = express();
app.use(bodyParser.json());

const connection = new Connection('https://api.mainnet-beta.solana.com');

// Use full 64-byte private key decoded from Base58
const base58Secret = process.env.ADMIN_PRIVATE_KEY_BASE58;
const secretKey = bs58.decode(base58Secret);
const admin = Keypair.fromSecretKey(secretKey);

app.post('/withdraw', async (req, res) => {
  const { to, amount } = req.body;
  if (!to || !amount) return res.status(400).json({ success: false, error: 'Missing wallet or amount.' });

  try {
    const toPubkey = new PublicKey(to);
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey,
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [admin]);
    res.json({ success: true, tx: signature });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
