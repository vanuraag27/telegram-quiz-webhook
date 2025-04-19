// server.js
import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();  // Load environment variables

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is not set! Exiting.');
  process.exit(1);
}
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// In-memory user sessions
const userSessions = {};
// Valid quiz categories
const VALID_CATEGORIES = ['history', 'science', 'movies', 'general knowledge'];

// Fetch dynamic questions
async function fetchQuestions(category, limit = 5) {
  try {
    const response = await axios.get('https://the-trivia-api.com/v2/questions', {
      params: { categories: category.toLowerCase(), limit },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching questions:', error?.response?.data || error.message);
    return [];
  }
}

// Format a question for Telegram
function formatQuestion(q, index) {
  const { question, correctAnswer, incorrectAnswers } = q;
  const all = [...incorrectAnswers, correctAnswer].sort(() => Math.random() - 0.5);
  const options = all.map((ans, i) => `${String.fromCharCode(65 + i)}. ${ans}`).join('\n');
  return `Q${index + 1}: ${question.text}\n${options}`;
}

// Send message via Telegram API
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text });
  } catch (err) {
    console.error('❌ sendMessage error:', err?.response?.data || err.message);
  }
}

// Telegram webhook handler
app.post('/webhook', (req, res) => {
  // Immediate 200 to avoid Telegram timeouts
  res.sendStatus(200);

  // Process update
  console.log('📩 Incoming update:', JSON.stringify(req.body));
  const msg = req.body.message;
  if (!msg || !msg.chat || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim().toLowerCase();

  // Initialize session
  if (!userSessions[chatId]) {
    userSessions[chatId] = { questions: [], currentQuestionIndex: 0, score: 0, answersMap: [] };
  }
  const session = userSessions[chatId];

  (async () => {
    if (text === '/start') {
      await sendMessage(chatId,
        '👋 Welcome to QuickQuiz!\nType /quiz to begin or choose a category:\n• history\n• science\n• movies\n• general knowledge'
      );
      return;
    }

    if (text === '/quiz') {
      await sendMessage(chatId, 'Please type a category: history | science | movies | general knowledge');
      return;
    }

    if (VALID_CATEGORIES.includes(text)) {
      session.questions = await fetchQuestions(text, 5);
      session.currentQuestionIndex = 0;
      session.score = 0;

      if (!session.questions.length) {
        await sendMessage(chatId, '⚠️ Could not fetch questions. Try again later.');
        return;
      }

      const q = session.questions[0];
      session.answersMap = [...q.incorrectAnswers, q.correctAnswer].sort(() => Math.random() - 0.5);
      await sendMessage(chatId, `🎯 Let's start!\n\n${formatQuestion(q, 0)}`);
      return;
    }

    // Answer handling
    if (session.questions.length && session.currentQuestionIndex < session.questions.length) {
      const idx = text.charCodeAt(0) - 65; // 'A'=65
      const selected = session.answersMap[idx];
      const correct = session.questions[session.currentQuestionIndex].correctAnswer;

      if (!selected) {
        await sendMessage(chatId, '❗ Please answer with A, B, C, or D.');
        return;
      }

      if (selected.toLowerCase() === correct.toLowerCase()) {
        session.score++;
        await sendMessage(chatId, '✅ Correct!');
      } else {
        await sendMessage(chatId, `❌ Wrong. Answer: ${correct}`);
      }

      session.currentQuestionIndex++;
      if (session.currentQuestionIndex < session.questions.length) {
        const next = session.questions[session.currentQuestionIndex];
        session.answersMap = [...next.incorrectAnswers, next.correctAnswer].sort(() => Math.random() - 0.5);
        await sendMessage(chatId, formatQuestion(next, session.currentQuestionIndex));
      } else {
        await sendMessage(chatId, `🎉 Quiz Over! Score: ${session.score}/${session.questions.length}`);
        session.questions = [];
      }
      return;
    }

    // Fallback prompt
    await sendMessage(chatId, '🤔 I did not understand. Type /start to begin.');
  })();
});

// Health check
app.get('/', (req, res) => res.send('🤖 Quiz Bot is live!'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
