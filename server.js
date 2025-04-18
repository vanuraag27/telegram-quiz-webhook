import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

app.use(bodyParser.json());

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  const message = req.body.message;

  if (message && message.text) {
    const chatId = message.chat.id;
    const userMessage = message.text.toLowerCase();

    console.log(`Message from @${message.from.username}: ${userMessage}`);

    // Example response
    if (userMessage === '/start') {
      await sendMessage(chatId, "🎉 Welcome to Quick Quiz!\nType `/quiz` to begin.");
    } else if (userMessage === '/quiz') {
      await sendMessage(chatId, "🧠 Quiz coming soon! Stay tuned...");
    } else {
      await sendMessage(chatId, "❓ I don't understand. Type `/quiz` to begin!");
    }
  }

  res.sendStatus(200);
});

// Send message to Telegram user
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error("Error sending message:", err.message);
  }
}

app.listen(PORT, () => {
  console.log(`✅ Webhook listening on port ${PORT}`);
});
