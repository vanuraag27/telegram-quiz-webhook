// server.js
import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

app.use(bodyParser.json());

// Quiz questions by category
const quizCategories = {
  General: [
    { question: 'Capital of France?', options: ['Paris', 'London', 'Berlin'], answer: 'Paris' },
    { question: 'Red Planet?', options: ['Earth', 'Mars', 'Venus'], answer: 'Mars' },
  ],
  History: [
    { question: 'Who was the first US President?', options: ['Lincoln', 'Washington', 'Adams'], answer: 'Washington' },
    { question: 'When did WWII end?', options: ['1945', '1940', '1950'], answer: '1945' },
  ],
  Tech: [
    { question: 'HTML stands for?', options: ['HyperText Markup Language', 'HighText Machine Language', 'Hot Mail'], answer: 'HyperText Markup Language' },
    { question: 'Founder of Microsoft?', options: ['Jobs', 'Gates', 'Musk'], answer: 'Gates' },
  ],
  Movies: [
    { question: 'Titanic director?', options: ['Cameron', 'Spielberg', 'Nolan'], answer: 'Cameron' },
    { question: 'Which movie has "I am your father"?', options: ['Star Wars', 'Harry Potter', 'Matrix'], answer: 'Star Wars' },
  ]
};

const userStates = {};
const leaderboard = {};

app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (!message || !message.chat) return res.sendStatus(200);
  const chatId = message.chat.id;
  const text = message.text;

  if (!userStates[chatId]) {
    userStates[chatId] = {};
  }

  const state = userStates[chatId];

  if (text === '/start') {
    await sendMessage(chatId, '🎉 Welcome to Quick Quiz!\nType /quiz to begin or /leaderboard to view top players.');
  } else if (text === '/quiz') {
    await sendCategorySelection(chatId);
  } else if (quizCategories[text]) {
    state.category = text;
    state.questions = [...quizCategories[text]];
    state.current = 0;
    state.score = 0;
    sendQuestion(chatId);
  } else if (text === '/leaderboard') {
    const sorted = Object.entries(leaderboard)
      .sort(([, a], [, b]) => b - a)
      .map(([user, score], i) => `${i + 1}. ${user} - ${score} pts`)
      .slice(0, 5)
      .join('\n') || '🏆 No scores yet!';
    await sendMessage(chatId, `🏆 Leaderboard:\n${sorted}`);
  } else if (state.questions && state.questions[state.current]) {
    clearTimeout(state.timer); // clear timer if answered in time
    checkAnswer(chatId, text);
  }

  res.sendStatus(200);
});

async function sendCategorySelection(chatId) {
  const categories = Object.keys(quizCategories).map(c => [{ text: c }]);
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: '🧠 Choose a quiz category:',
    reply_markup: {
      keyboard: categories,
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });
}

async function sendQuestion(chatId) {
  const state = userStates[chatId];
  if (state.current < state.questions.length) {
    const q = state.questions[state.current];
    const options = q.options.map(opt => [{ text: opt }]);

    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `Q${state.current + 1}: ${q.question}`,
      reply_markup: {
        keyboard: options,
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });

    // Set 10s timer
    state.timer = setTimeout(() => {
      sendMessage(chatId, '⏱ Time up!');
      state.current++;
      sendQuestion(chatId);
    }, 10000);

  } else {
    await sendMessage(chatId, `✅ Quiz complete! You scored ${state.score}/${state.questions.length}`);
    const username = `User_${chatId}`;
    leaderboard[username] = Math.max(state.score, leaderboard[username] || 0);
    delete userStates[chatId];
  }
}

async function checkAnswer(chatId, text) {
  const state = userStates[chatId];
  const q = state.questions[state.current];

  if (text === q.answer) {
    state.score++;
    await sendMessage(chatId, '✅ Correct!');
  } else {
    await sendMessage(chatId, `❌ Wrong. Answer: ${q.answer}`);
  }
  state.current++;
  sendQuestion(chatId);
}

async function sendMessage(chatId, text) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text
  });
}

app.get('/', (req, res) => {
  res.send('Quick Quiz Bot is running!');
});

app.listen(PORT, () => {
  console.log(`✅ Webhook listening on port ${PORT}`);
});
