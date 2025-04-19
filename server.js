// server.js
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PORT = process.env.PORT || 10000;

const sessions = {};
const leaderboard = {};

const categories = {
  General: 'general_knowledge',
  History: 'history',
  Science: 'science',
  Movies: 'film_and_tv'
};

// Fetch quiz questions from The Trivia API
async function fetchQuestions(categoryKey, limit = 5) {
  try {
    const response = await axios.get('https://the-trivia-api.com/v2/questions', {
      params: {
        categories: categoryKey,
        limit
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching questions:', error.message);
    return [];
  }
}

// Format the question for Telegram with inline buttons
function createQuestionMessage(question, index) {
  const allAnswers = [...question.incorrectAnswers, question.correctAnswer];
  const shuffled = allAnswers.sort(() => Math.random() - 0.5);
  const options = shuffled.map((opt, i) => ({
    text: String.fromCharCode(65 + i),
    callback_data: opt
  }));
  return {
    text: `Q${index + 1}: ${question.question.text}`,
    reply_markup: {
      inline_keyboard: [options]
    }
  };
}

// Handle category selection
async function handleCategory(chatId, categoryName) {
  const categoryKey = categories[categoryName];
  if (!categoryKey) return;

  const questions = await fetchQuestions(categoryKey, 5);
  if (questions.length === 0) {
    return sendMessage(chatId, '❌ Could not load questions. Try again later.');
  }

  sessions[chatId] = {
    questions,
    current: 0,
    score: 0,
    correctAnswer: questions[0].correctAnswer
  };

  const q = createQuestionMessage(questions[0], 0);
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: q.text,
    reply_markup: q.reply_markup
  });
}

// Send message
async function sendMessage(chatId, text) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text
  });
}

// Handle answer selection
async function handleAnswer(chatId, answer, user) {
  const session = sessions[chatId];
  if (!session) return;

  const correct = session.questions[session.current].correctAnswer;
  let reply = '';

  if (answer === correct) {
    session.score++;
    reply = '✅ Correct!';
  } else {
    reply = `❌ Wrong! Correct answer: ${correct}`;
  }

  session.current++;

  if (session.current < session.questions.length) {
    session.correctAnswer = session.questions[session.current].correctAnswer;
    const nextQ = createQuestionMessage(session.questions[session.current], session.current);
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `${reply}\n\n${nextQ.text}`,
      reply_markup: nextQ.reply_markup
    });
  } else {
    const finalScore = session.score;
    leaderboard[user] = Math.max(finalScore, leaderboard[user] || 0);
    await sendMessage(chatId, `🎉 Quiz Over! Your score: ${finalScore}/${session.questions.length}`);
    delete sessions[chatId];
  }
}

// Show leaderboard
async function showLeaderboard(chatId) {
  const sorted = Object.entries(leaderboard)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, score], i) => `${i + 1}. ${name}: ${score} pts`)
    .join('\n') || 'No scores yet.';

  await sendMessage(chatId, `🏆 Leaderboard:\n${sorted}`);
}

// Handle commands and messages
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.message) {
    const chatId = body.message.chat.id;
    const text = body.message.text?.trim();
    const user = body.message.from.username || `User_${chatId}`;

    if (text === '/start') {
      await sendMessage(chatId, `👋 Welcome to Quick Quiz!\nChoose a category:\n- General\n- History\n- Science\n- Movies`);
    } else if (text === '/leaderboard') {
      await showLeaderboard(chatId);
    } else if (Object.keys(categories).includes(text)) {
      await handleCategory(chatId, text);
    } else {
      await sendMessage(chatId, '❓ Please use /start to begin or type a valid category name.');
    }
  } else if (body.callback_query) {
    const chatId = body.callback_query.message.chat.id;
    const answer = body.callback_query.data;
    const user = body.callback_query.from.username || `User_${chatId}`;

    await handleAnswer(chatId, answer, user);

    // Acknowledge the callback to prevent loading animation
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
      callback_query_id: body.callback_query.id
    });
  }

  res.sendStatus(200);
});

app.get('/', (req, res) => res.send('Quick Quiz Bot is running!'));
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
