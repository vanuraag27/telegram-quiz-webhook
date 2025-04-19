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

// Send keyboard for category selection
async function sendCategoryKeyboard(chatId) {
  const categories = ['General Knowledge', 'History', 'Science', 'Movies'];
  const keyboard = categories.map((cat) => [{ text: cat }]);

  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: '🧠 Choose a quiz category below:',
    reply_markup: {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (!message || !message.chat || !message.text) return res.sendStatus(200);

  const chatId = message.chat.id;
  const text = message.text.trim();
  const userName = message.from.username || `User_${chatId}`;

  if (!userSessions[chatId]) {
    userSessions[chatId] = {
      score: 0,
      currentQuestionIndex: 0,
      questions: [],
      category: '',
    };
  }

  const session = userSessions[chatId];

  // Start
  if (text === '/start') {
    await sendMessage(chatId, '👋 Welcome to Quick Quiz Bot!\nTap a category to begin your quiz. Answer with A, B, C, or D.');
    await sendCategoryKeyboard(chatId);
  }

  // Leaderboard
  else if (text === '/leaderboard') {
    const sorted = Object.entries(leaderboard)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, score], i) => `${i + 1}. ${name}: ${score} pts`)
      .join('\n') || '📭 No scores yet!';
    await sendMessage(chatId, `🏆 Top Players:\n${sorted}`);
  }

  // Category selected
  else if (['General Knowledge', 'History', 'Science', 'Movies'].includes(text)) {
    session.category = text;
    session.questions = await fetchQuestions(text, 5);
    session.currentQuestionIndex = 0;
    session.score = 0;

    if (!session.questions.length) {
      return sendMessage(chatId, '⚠️ Could not load questions. Try again later.');
    }

    const qText = formatQuestion(session.questions[0], 0);
    await sendMessage(chatId, `🎯 Starting "${text}" quiz...\n\n${qText}`);
  }

  // Answering a question
  else if (session.questions.length && session.currentQuestionIndex < session.questions.length) {
    const currentQ = session.questions[session.currentQuestionIndex];
    const letter = text.toUpperCase();
    const index = letter.charCodeAt(0) - 65;
    const selectedAnswer = currentQ.shuffledAnswers?.[index];

    if (!selectedAnswer) {
      return sendMessage(chatId, '❗ Please answer with A, B, C, or D.');
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
      await sendMessage(chatId, nextQ);
    } else {
      await sendMessage(chatId, `🎉 Quiz complete!\nYour Score: ${session.score}/${session.questions.length}`);
      leaderboard[userName] = Math.max(leaderboard[userName] || 0, session.score);
      delete userSessions[chatId];
    }
  }

  // Unrecognized input
  else {
    await sendMessage(chatId, '❓ Unrecognized input. Type /start to begin or /leaderboard to view top players.');
  }

  res.sendStatus(200);
});

// Health check route
app.get('/', (req, res) => {
  res.send('✅ Quick Quiz Bot is live!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
