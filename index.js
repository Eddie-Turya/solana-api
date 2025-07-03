require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');

const bs58 = require('bs58');
const nacl = require('tweetnacl');

const app = express();
app.use(bodyParser.json());

const connection = new Connection('https://api.mainnet-beta.solana.com');

// Decode Base58 private key from env and derive full Keypair
const base58Secret = process.env.ADMIN_PRIVATE_KEY_BASE58;
if (!base58Secret) {
  throw new Error('ADMIN_PRIVATE_KEY_BASE58 is not set');
}
const privateKeyBytes = bs58.decode(base58Secret);
const admin = Keypair.fromSecretKey(nacl.sign.keyPair.fromSeed(privateKeyBytes).secretKey);

app.post('/withdraw', async (req, res) => {
  const { to, amount } = req.body;

  if (!to || !amount) {
    return res.status(400).json({ success: false, error: 'Missing "to" or "amount" in request' });
  }

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

    return res.json({ success: true, tx: signature });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
