// server.js
import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PORT = process.env.PORT || 10000;

const categories = ['General Knowledge', 'History', 'Science', 'Movies'];
const countries = ['India', 'USA', 'UK', 'Canada', 'Australia'];
const userSessions = {};
const leaderboard = {};

// Fetch questions from API
async function fetchQuestions(category, limit = 5) {
  try {
    const response = await axios.get('https://the-trivia-api.com/v2/questions', {
      params: {
        categories: category.toLowerCase().replace(/\s/g, '-'),
        limit,
      },
    });
    return response.data;
  } catch (err) {
    console.error('❌ Fetch error:', err);
    return [];
  }
}

// Format one question with A/B/C/D options
function formatQuestion(questionObj, index) {
  const { question, correctAnswer, incorrectAnswers } = questionObj;
  const allAnswers = [...incorrectAnswers, correctAnswer].sort(() => Math.random() - 0.5);
  questionObj.shuffledAnswers = allAnswers;

  const options = allAnswers.map((ans, i) => `${String.fromCharCode(65 + i)}. ${ans}`).join('\n');
  return `Q${index + 1}: ${question.text}\n\n${options}`;
}

// Helper to send plain text
async function sendMessage(chatId, text) {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
  });
}

// Send keyboard buttons
async function sendKeyboard(chatId, text, options) {
  const keyboard = options.map(opt => [{ text: opt }]);
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
    reply_markup: {
      keyboard,
      one_time_keyboard: true,
      resize_keyboard: true,
    },
  });
}

// Telegram webhook
app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (!message?.chat?.id || !message.text) return res.sendStatus(200);

  const chatId = message.chat.id;
  const userName = message.from?.username || `User_${chatId}`;
  const text = message.text.trim();

  if (!userSessions[chatId]) {
    userSessions[chatId] = { stage: 'start' };
  }

  const session = userSessions[chatId];

  if (text === '/start') {
    session.stage = 'category';
    await sendMessage(chatId, '👋 Welcome to Quick Quiz Bot!\nTap a category to begin your quiz. Then pick your country.');
    return sendKeyboard(chatId, '📚 Choose a quiz category:', categories);
  }

  if (text === '/leaderboard') {
    const sorted = Object.entries(leaderboard)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, score], i) => `${i + 1}. ${name}: ${score} pts`)
      .join('\n') || '🏆 No scores yet!';
    return sendMessage(chatId, `🏆 Leaderboard:\n${sorted}`);
  }

  // Category selection
  if (session.stage === 'category' && categories.includes(text)) {
    session.category = text;
    session.stage = 'country';
    return sendKeyboard(chatId, '🌍 Choose your country:', countries);
  }

  // Country selection
  if (session.stage === 'country' && countries.includes(text)) {
    session.country = text;
    session.stage = 'quiz';
    session.score = 0;
    session.currentQuestionIndex = 0;
    session.questions = await fetchQuestions(session.category, 5);

    if (!session.questions.length) {
      session.stage = 'start';
      return sendMessage(chatId, '⚠️ Could not load questions. Try again later.');
    }

    const intro = `🎯 Starting a ${session.category} quiz for ${session.country}...\n\n`;
    const qText = formatQuestion(session.questions[0], 0);
    return sendMessage(chatId, intro + qText);
  }

  // Answering
  if (session.stage === 'quiz' && session.questions?.length) {
    const currentQ = session.questions[session.currentQuestionIndex];
    const letter = text.toUpperCase();
    const index = letter.charCodeAt(0) - 65;
    const selected = currentQ.shuffledAnswers?.[index];

    if (!selected) {
      return sendMessage(chatId, '❗ Please answer with A, B, C, or D.');
    }

    if (selected.toLowerCase() === currentQ.correctAnswer.toLowerCase()) {
      session.score++;
      await sendMessage(chatId, '✅ Correct!');
    } else {
      await sendMessage(chatId, `❌ Wrong! Correct: ${currentQ.correctAnswer}`);
    }

    session.currentQuestionIndex++;

    if (session.currentQuestionIndex < session.questions.length) {
      const nextQ = formatQuestion(session.questions[session.currentQuestionIndex], session.currentQuestionIndex);
      return sendMessage(chatId, nextQ);
    } else {
      leaderboard[userName] = Math.max(session.score, leaderboard[userName] || 0);
      await sendMessage(chatId, `🎉 Quiz complete!\nScore: ${session.score}/${session.questions.length}`);
      delete userSessions[chatId];
      return;
    }
  }

  return sendMessage(chatId, 'ℹ️ Please type /start to begin or /leaderboard to view top players.');
});

// Health check
app.get('/', (req, res) => {
  res.send('✅ Quick Quiz Bot with country & category selection is live!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
