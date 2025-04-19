// server.js
import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const app = express();
app.use(bodyParser.json());

// Use the BOT_TOKEN environment variable
const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Valid quiz categories
const VALID_CATEGORIES = ['history', 'science', 'movies', 'general knowledge'];

// In-memory user sessions
const userSessions = {};

// Fetch questions from external API
async function fetchQuestions(category, limit = 5) {
  try {
    const response = await axios.get('https://the-trivia-api.com/v2/questions', {
      params: { categories: category.toLowerCase(), limit },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching questions:', error?.response?.data || error.message);
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

// Send a message via Telegram API
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text });
  } catch (err) {
    console.error('Telegram sendMessage error:', err?.response?.data || err.message);
  }
}

// Webhook handler for Telegram updates
app.post('/webhook', async (req, res) => {
  const msg = req.body.message;
  if (!msg || !msg.chat || !msg.text) return res.sendStatus(200);

  const chatId = msg.chat.id;
  const text = msg.text.trim().toLowerCase();

  // Initialize session if new user
  if (!userSessions[chatId]) {
    userSessions[chatId] = { questions: [], currentQuestionIndex: 0, score: 0, answersMap: [] };
  }
  const session = userSessions[chatId];

  if (text === '/start') {
    await sendMessage(chatId,
      '👋 Welcome to the Quiz Bot!\nChoose a category:\n• History\n• Science\n• Movies\n• General Knowledge\n\nType the category name.'
    );

  } else if (VALID_CATEGORIES.includes(text)) {
    // User selected a category
    session.questions = await fetchQuestions(text, 5);
    session.currentQuestionIndex = 0;
    session.score = 0;

    if (!session.questions.length) {
      return sendMessage(chatId, '⚠️ Could not fetch questions. Please try again later.');
    }

    // Prepare first question
    const q = session.questions[0];
    session.answersMap = [...q.incorrectAnswers, q.correctAnswer].sort(() => Math.random() - 0.5);
    await sendMessage(chatId, `🎯 Let's start!\n\n${formatQuestion(q, 0)}`);

  } else if (session.questions.length && session.currentQuestionIndex < session.questions.length) {
    // User answered a question
    const idx = text.charCodeAt(0) - 65; // 'A' = 65
    const selected = session.answersMap[idx];
    const correct = session.questions[session.currentQuestionIndex].correctAnswer;

    if (!selected) {
      return sendMessage(chatId, '❗ Please respond with A, B, C, or D.');
    }

    if (selected.toLowerCase() === correct.toLowerCase()) {
      session.score++;
      await sendMessage(chatId, '✅ Correct!');
    } else {
      await sendMessage(chatId, `❌ Wrong. Answer: ${correct}`);
    }

    // Next question or end quiz
    session.currentQuestionIndex++;
    if (session.currentQuestionIndex < session.questions.length) {
      const nextQ = session.questions[session.currentQuestionIndex];
      session.answersMap = [...nextQ.incorrectAnswers, nextQ.correctAnswer].sort(() => Math.random() - 0.5);
      await sendMessage(chatId, formatQuestion(nextQ, session.currentQuestionIndex));
    } else {
      await sendMessage(chatId, `🎉 Quiz Over! Score: ${session.score}/${session.questions.length}`);
      session.questions = [];
    }

  } else {
    // Unrecognized input, prompt /start
    await sendMessage(chatId, '🤔 I did not understand. Type /start to begin.');
  }

  res.sendStatus(200);
});

// Health check endpoint
app.get('/', (req, res) => res.send('🤖 Quiz Bot is live!'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
