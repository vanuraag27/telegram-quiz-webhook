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

const userSessions = {};
const leaderboard = {};
const countries = ['India', 'USA', 'UK', 'Canada'];

const categories = ['General Knowledge', 'History', 'Science', 'Movies'];

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
  } catch (error) {
    console.error('❌ Error fetching questions:', error);
    return [];
  }
}

// Format question text
function formatQuestion(questionObj, index) {
  const { question, correctAnswer, incorrectAnswers } = questionObj;
  const allAnswers = [...incorrectAnswers, correctAnswer].sort(() => Math.random() - 0.5);
  questionObj.shuffledAnswers = allAnswers;

  const options = allAnswers.map((ans, i) => `${String.fromCharCode(65 + i)}. ${ans}`).join('\n');
  return `Q${index + 1}: ${question.text}\n\n${options}`;
}

// Send plain message
async function sendMessage(chatId, text) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
  });
}

// Category keyboard
async function sendCategoryKeyboard(chatId) {
  const keyboard = categories.map((cat) => [{ text: cat }]);
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: '🧠 Choose a quiz category:',
    reply_markup: {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

// Country keyboard
async function sendCountryKeyboard(chatId) {
  const keyboard = countries.map((country) => [{ text: country }]);
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: '🌍 Select a country for your quiz:',
    reply_markup: {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

// Handle incoming Telegram messages
app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (!message || !message.chat || !message.text) return res.sendStatus(200);

  const chatId = message.chat.id;
  const text = message.text.trim();
  const userName = message.from.username || `User_${chatId}`;

  if (!userSessions[chatId]) {
    userSessions[chatId] = {
      stage: 'start',
      category: '',
      country: '',
      questions: [],
      currentQuestionIndex: 0,
      score: 0,
    };
  }

  const session = userSessions[chatId];

  if (text === '/start') {
    session.stage = 'category';
    await sendMessage(chatId, '👋 Welcome to Quick Quiz Bot!\nChoose a category and then your country to start!');
    return await sendCategoryKeyboard(chatId);
  }

  if (text === '/leaderboard') {
    const sorted = Object.entries(leaderboard)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, score], i) => `${i + 1}. ${name}: ${score} pts`)
      .join('\n') || '📭 No scores yet!';
    return await sendMessage(chatId, `🏆 Top Players:\n${sorted}`);
  }

  // Category selected
  if (session.stage === 'category' && categories.includes(text)) {
    session.category = text;
    session.stage = 'country';
    return await sendCountryKeyboard(chatId);
  }

  // Country selected
  if (session.stage === 'country' && countries.includes(text)) {
    session.country = text;
    session.questions = await fetchQuestions(session.category, 5);
    session.score = 0;
    session.currentQuestionIndex = 0;
    session.stage = 'quiz';

    if (!session.questions.length) {
      session.stage = 'start';
      return await sendMessage(chatId, '⚠️ Failed to fetch questions. Try again.');
    }

    const qText = formatQuestion(session.questions[0], 0);
    return await sendMessage(chatId, `🎯 Starting ${session.category} quiz for ${session.country}!\n\n${qText}`);
  }

  // Answering
  if (session.stage === 'quiz' && session.questions.length) {
    const currentQ = session.questions[session.currentQuestionIndex];
    const letter = text.toUpperCase();
    const index = letter.charCodeAt(0) - 65;
    const selectedAnswer = currentQ.shuffledAnswers?.[index];

    if (!selectedAnswer) {
      return await sendMessage(chatId, '❗ Answer with A, B, C, or D.');
    }

    if (selectedAnswer.toLowerCase() === currentQ.correctAnswer.toLowerCase()) {
      session.score++;
      await sendMessage(chatId, '✅ Correct!');
    } else {
      await sendMessage(chatId, `❌ Incorrect. Correct answer: ${currentQ.correctAnswer}`);
    }

    session.currentQuestionIndex++;

    if (session.currentQuestionIndex < session.questions.length) {
      const nextQ = formatQuestion(session.questions[session.currentQuestionIndex], session.currentQuestionIndex);
      return await sendMessage(chatId, nextQ);
    } else {
      await sendMessage(chatId, `🎉 Quiz complete!\nScore: ${session.score}/${session.questions.length}`);
      leaderboard[userName] = Math.max(session.score, leaderboard[userName] || 0);
      delete userSessions[chatId];
      return;
    }
  }

  return await sendMessage(chatId, '❓ Please type /start to begin or /leaderboard to view top players.');
});

// Health check
app.get('/', (req, res) => {
  res.send('✅ Quick Quiz Bot is live with category and country selection!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
