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

// Fetch questions dynamically
async function fetchQuestions(category, limit = 5) {
  try {
    const response = await axios.get('https://the-trivia-api.com/v2/questions', {
      params: {
        categories: category.toLowerCase(),
        limit,
      },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching questions:', error);
    return [];
  }
}

// Format a question
function formatQuestion(questionObj, index) {
  const { question, correctAnswer, incorrectAnswers } = questionObj;
  const allAnswers = [...incorrectAnswers, correctAnswer].sort(() => Math.random() - 0.5);
  questionObj.shuffledAnswers = allAnswers; // Store for comparison

  const options = allAnswers
    .map((ans, i) => `${String.fromCharCode(65 + i)}. ${ans}`)
    .join('\n');

  return `Q${index + 1}: ${question.text}\n\n${options}`;
}

// Send message
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text,
    });
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
  }
}

// Handle webhook updates
app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (!message || !message.chat || !message.text) return res.sendStatus(200);

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (!userSessions[chatId]) {
    userSessions[chatId] = {
      score: 0,
      currentQuestionIndex: 0,
      questions: [],
      category: '',
    };
  }

  const session = userSessions[chatId];

  if (text === '/start') {
    await sendMessage(chatId, '🎉 Welcome to the Quiz Bot!\n\nChoose a category:\n👉 History\n👉 Science\n👉 Movies\n👉 General Knowledge\n\nType the category name to begin.');
  } else if (
    ['History', 'Science', 'Movies', 'General Knowledge'].includes(text)
  ) {
    session.category = text;
    session.questions = await fetchQuestions(text, 5);
    session.score = 0;
    session.currentQuestionIndex = 0;

    if (session.questions.length === 0) {
      await sendMessage(chatId, '⚠️ Could not fetch questions. Try again later.');
      return;
    }

    const qText = formatQuestion(session.questions[0], 0);
    await sendMessage(chatId, `📚 Category: ${text}\n\n${qText}`);
  } else if (session.questions.length > 0 && session.currentQuestionIndex < session.questions.length) {
    const currentQ = session.questions[session.currentQuestionIndex];
    const letter = text.toUpperCase();

    const index = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
    const selectedAnswer = currentQ.shuffledAnswers?.[index];

    if (!selectedAnswer) {
      await sendMessage(chatId, '❗ Please answer with A, B, C, or D.');
      return;
    }

    if (selectedAnswer.toLowerCase() === currentQ.correctAnswer.toLowerCase()) {
      session.score++;
      await sendMessage(chatId, '✅ Correct!');
    } else {
      await sendMessage(chatId, `❌ Wrong! Correct answer was: ${currentQ.correctAnswer}`);
    }

    session.currentQuestionIndex++;

    if (session.currentQuestionIndex < session.questions.length) {
      const nextQ = formatQuestion(session.questions[session.currentQuestionIndex], session.currentQuestionIndex);
      await sendMessage(chatId, `\n${nextQ}`);
    } else {
      await sendMessage(chatId, `🎉 Quiz finished!\nYour Score: ${session.score}/${session.questions.length}`);
      delete userSessions[chatId];
    }
  } else {
    await sendMessage(chatId, 'ℹ️ Please type /start to begin the quiz or choose a valid category.');
  }

  res.sendStatus(200);
});

// Test endpoint
app.get('/', (req, res) => {
  res.send('✅ Quick Quiz Bot is up and running!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
