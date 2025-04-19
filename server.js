import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const VALID_CATEGORIES = ['history', 'science', 'movies', 'general_knowledge'];

const userSessions = {};

// Fetch dynamic questions
async function fetchQuestions(category, limit = 5) {
  try {
    const response = await axios.get('https://the-trivia-api.com/v2/questions', {
      params: {
        categories: category,
        limit,
      },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching questions:', error?.response?.data || error.message);
    return [];
  }
}

// Format question for Telegram
function formatQuestion(questionObj, index) {
  const { question, correctAnswer, incorrectAnswers } = questionObj;
  const allAnswers = [...incorrectAnswers, correctAnswer];
  const shuffled = allAnswers.sort(() => Math.random() - 0.5);
  const options = shuffled.map((ans, i) => `${String.fromCharCode(65 + i)}. ${ans}`).join('\n');

  return `Q${index + 1}: ${question.text}\n${options}`;
}

// Send message to user
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text,
    });
  } catch (err) {
    console.error('❌ Telegram sendMessage error:', err?.response?.data || err.message);
  }
}

// Webhook handler
app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (!message || !message.chat || !message.text) return res.sendStatus(200);

  const chatId = message.chat.id;
  const text = message.text.trim().toLowerCase();

  if (!userSessions[chatId]) {
    userSessions[chatId] = {
      score: 0,
      currentQuestionIndex: 0,
      questions: [],
      category: '',
      answersMap: [],
    };
  }

  const session = userSessions[chatId];

  if (text === '/start') {
    await sendMessage(chatId,
      '👋 Welcome to the Quiz Bot!\n\nPlease choose a category:\n🕰 History\n🧪 Science\n🎬 Movies\n🌍 General Knowledge\n\nJust type the category name to begin!'
    );
  } else if (VALID_CATEGORIES.includes(text.replace(' ', '_'))) {
    const category = text.replace(' ', '_');
    session.category = category;
    session.questions = await fetchQuestions(category, 5);
    session.score = 0;
    session.currentQuestionIndex = 0;

    if (session.questions.length === 0) {
      return sendMessage(chatId, '⚠️ Could not fetch questions. Please try again later.');
    }

    const q = session.questions[0];
    const answers = [...q.incorrectAnswers, q.correctAnswer].sort(() => Math.random() - 0.5);
    session.answersMap = answers;

    const questionText = formatQuestion(q, 0);
    await sendMessage(chatId, `🎯 Let's start the quiz!\n\n${questionText}`);
  } else if (session.questions.length > 0 && session.currentQuestionIndex < session.questions.length) {
    const input = text.charAt(0).toUpperCase();
    const idx = input.charCodeAt(0) - 65; // 'A' => 0

    const selected = session.answersMap[idx];
    const correct = session.questions[session.currentQuestionIndex].correctAnswer;

    if (!selected) {
      await sendMessage(chatId, '❗Please answer with A, B, C, or D.');
      return;
    }

    if (selected.toLowerCase() === correct.toLowerCase()) {
      session.score++;
      await sendMessage(chatId, '✅ Correct!');
    } else {
      await sendMessage(chatId, `❌ Incorrect. Correct answer: ${correct}`);
    }

    session.currentQuestionIndex++;

    if (session.currentQuestionIndex < session.questions.length) {
      const nextQ = session.questions[session.currentQuestionIndex];
      const answers = [...nextQ.incorrectAnswers, nextQ.correctAnswer].sort(() => Math.random() - 0.5);
      session.answersMap = answers;

      const questionText = formatQuestion(nextQ, session.currentQuestionIndex);
      await sendMessage(chatId, `\n${questionText}`);
    } else {
      await sendMessage(chatId, `🎉 Quiz Over! Your Score: ${session.score}/${session.questions.length}`);
      session.questions = [];
    }
  } else {
    await sendMessage(chatId, '❓ Type /start to begin the quiz or choose a valid category.');
  }

  res.sendStatus(200);
});

// Health check
app.get('/', (req, res) => {
  res.send('🚀 Quiz bot is live!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
