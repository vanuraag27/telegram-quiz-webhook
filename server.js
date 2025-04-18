import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
  const message = req.body.message;

  if (message && message.text) {
    console.log(`Received message from ${message.from.username}: ${message.text}`);
    // Add your quiz logic here
  }

  res.sendStatus(200); // Let Telegram know we received the message
});

app.listen(PORT, () => {
  console.log(`Webhook listening on port ${PORT}`);
});
