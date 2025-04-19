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

const userSessions = {};
const leaderboard = {};

// Fetch questions dynamically from the-trivia-api
async function fetchQuestions(category, limit = 5) {
  const url = 'https://the-trivia-api.com/v2/questions';
  try {
    const response = await axios.get(url, {
      params: {
        categories: category.toLowerCase().replace(/ /g, '-'),
        limit,
      },
    });
    return response.data;
  } catch (err) {
    console.error('❌ Failed to fetch questions:', err.message);
    return [];
  }
}

function formatOptions(answers) {
  const labels = ['A', 'B', 'C', 'D'];
  return answers.map((ans, i) => ({
    text: `${labels[i]}. ${ans}`,
    callback_data: labels[i],
  }));
}

function buildQuestionMessage(qObj, index) {
  const allAnswers = [...qObj.incorrectAnswers, qObj.correctAnswer];
  const shuffled = allAnswers.sort(() => Math.random() - 0.5);
  qObj.shuffledAnswers = shuffled; // Save for answer checking
  return {
    text: `Q${index + 1}: ${qObj.question.text}`,
    options: formatOptions(shuffled),
  };
}

async function sendCategorySelection(chatId) {
  const categories = ['General Knowledge', 'Science', 'History', 'Movies'];
  const keyboard = categories.map(cat => [{ text: cat }]);
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: '🎯 Choose a quiz category:',
    reply_markup: {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

async function sendMessage(chatId, text) {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
  });
}

async function sendQuestion(chatId, session) {
  const questionData = buildQuestionMessage(session.questions[session.index], session.index);
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: questionData.text,
    reply_markup: {
      inline_keyboard: [questionData.options],
    },
  });
}

async function handleAnswer(chatId, callbackQuery) {
  const session = userSessions[chatId];
  const currentQ = session.questions[session.index];
  const selected = callbackQuery.data;
  const correct = currentQ.correctAnswer;
  const correctIndex = currentQ.shuffledAnswers.findIndex(a => a === correct);
  const isCorrect = selected === ['A', 'B', 'C', 'D'][correctIndex];

  if (isCorrect) {
    session.score++;
    await sendMessage(chatId, '✅ Correct!');
  } else {
    await sendMessage(chatId, `❌ Wrong. Correct answer: ${correct}`);
  }

  session.index++;
  if (session.index < session.questions.length) {
    await sendQuestion(chatId, session);
  } else {
    await sendMessage(chatId, `🎉 Quiz finished! Your score: ${session.score}/${session.questions.length}`);
    leaderboard[chatId] = Math.max(session.score, leaderboard[chatId] || 0);
    delete userSessions[chatId];
  }
}

async function showLeaderboard(chatId) {
  const sorted = Object.entries(leaderboard)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, score], i) => `${i + 1}. User ${id}: ${score} pts`)
    .join('\n') || 'No entries yet.';
  await sendMessage(chatId, `🏆 Leaderboard:\n${sorted}`);
}

// Incoming message or callback
app.post('/webhook', async (req, res) => {
  try {
    const { message, callback_query } = req.body;

    if (message) {
      const chatId = message.chat.id;
      const text = message.text?.trim();

      if (text === '/start') {
        await sendMessage(chatId, '👋 Welcome to Quick Quiz! Type /quiz to start or /leaderboard to view top scores.');
      } else if (text === '/quiz') {
        await sendCategorySelection(chatId);
      } else if (text === '/leaderboard') {
        await showLeaderboard(chatId);
      } else if (['General Knowledge', 'Science', 'History', 'Movies'].includes(text)) {
        const questions = await fetchQuestions(text, 5);
        if (!questions.length) return sendMessage(chatId, '⚠️ Could not load questions. Try again later.');

        userSessions[chatId] = {
          questions,
          score: 0,
          index: 0,
          category: text,
        };
        await sendQuestion(chatId, userSessions[chatId]);
      } else {
        await sendMessage(chatId, 'ℹ️ Type /quiz to begin or /leaderboard to see top scores.');
      }
    } else if (callback_query) {
      const chatId = callback_query.message.chat.id;
      await handleAnswer(chatId, callback_query);

      // Acknowledge button press to Telegram
      await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
        callback_query_id: callback_query.id,
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

app.get('/', (req, res) => res.send('🚀 Quick Quiz bot is live'));

app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
