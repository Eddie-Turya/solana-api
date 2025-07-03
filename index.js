const express = require('express');
const bodyParser = require('body-parser');
const {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');

require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const connection = new Connection('https://api.mainnet-beta.solana.com');

const secret = JSON.parse(process.env.ADMIN_PRIVATE_KEY);
const admin = Keypair.fromSecretKey(new Uint8Array(secret));

app.post('/withdraw', async (req, res) => {
  const { to, amount } = req.body;

  if (!to || !amount) {
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }

  try {
    const toPubkey = new PublicKey(to);
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey,
        lamports: amount * LAMPORTS_PER_SOL
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [admin]);

    return res.json({ success: true, tx: signature });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
