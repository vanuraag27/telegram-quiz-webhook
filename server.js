// server.js
import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();  // Load BOT_TOKEN from .env / Render env

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is not set! Exiting.');
  process.exit(1);
}
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Debug helper
async function sendMessage(chatId, text) {
  console.log(`➡️ Sending to ${chatId}: ${text}`);
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text });
  } catch (err) {
    console.error('❌ sendMessage error:', err.response?.data || err.message);
  }
}

app.post('/webhook', async (req, res) => {
  // 1) Log the full update so we can inspect it in Render logs
  console.log('📩 Incoming update:', JSON.stringify(req.body, null, 2));

  const message = req.body.message;
  if (!message || !message.chat || !message.text) {
    return res.sendStatus(200);
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  // 2) Handle /start
  if (text === '/start') {
    await sendMessage(
      chatId,
      '👋 Welcome to QuickQuiz!\nType /quiz to begin or choose a category:\n• history\n• science\n• movies\n• general knowledge'
    );
    return res.sendStatus(200);
  }

  // 3) /quiz command
  if (text === '/quiz') {
    await sendMessage(chatId, 'Please type one of these categories:\nhistory | science | movies | general knowledge');
    return res.sendStatus(200);
  }

  // 4) Category selection (lowercased)
  const category = text.toLowerCase();
  const valid = ['history', 'science', 'movies', 'general knowledge'];
  if (valid.includes(category)) {
    // For brevity, just echo back
    await sendMessage(chatId, `You selected *${category}*. (Quiz logic goes here.)`);
    return res.sendStatus(200);
  }

  // 5) Fallback
  await sendMessage(chatId, `❓ I didn't understand that. Send /start to begin.`);
  return res.sendStatus(200);
});

// Health‑check endpoint
app.get('/', (req, res) => res.send('🤖 Quiz Bot is Live'));

// Listen
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
