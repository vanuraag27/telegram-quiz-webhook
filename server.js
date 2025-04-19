// server.js
import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config(); // ✅ ES module way to load .env

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const userSessions = {};

// ✅ Fetch questions dynamically from external API
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
    console.error('Error fetching questions:', error);
    return [];
  }
}

function formatQuestion(questionObj, index) {
  const { question, correctAnswer, incorrectAnswers } = questionObj;
  const allAnswers = [...incorrectAnswers, correctAnswer].sort(() => Math.random() - 0.5);
  const options = allAnswers.map((ans, i) => `${String.fromCharCode(65 + i)}. ${ans}`).join('\n');
  return `Q${index + 1}: ${question.text}\n${options}`;
}

async function sendMessage(chatId, text) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
  });
}

app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (!message || !message.chat) return res.sendStatus(200);

  const chatId = message.chat.id;
  const text = message.text?.trim().toLowerCase();

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
    await sendMessage(chatId, 'Welcome to the Quiz Bot! Please choose a category:\n1. History\n2. Science\n3. Movies\n4. General Knowledge\n\nType the category name to begin.');
  } else if (['history', 'science', 'movies', 'General Knowledge'].includes(text)) {
    session.category = text;
    session.questions = await fetchQuestions(text, 5);
    session.score = 0;
    session.currentQuestionIndex = 0;

    if (session.questions.length === 0) {
      return sendMessage(chatId, 'Could not fetch questions. Please try again later.');
    }

    const questionText = formatQuestion(session.questions[0], 0);
    await sendMessage(chatId, `Let's start the quiz!\n\n${questionText}`);
  } else if (session.questions.length > 0 && session.currentQuestionIndex < session.questions.length) {
    const currentQ = session.questions[session.currentQuestionIndex];
    const correct = currentQ.correctAnswer.toLowerCase();
    const allAnswers = [...currentQ.incorrectAnswers, currentQ.correctAnswer].sort();

    const selectedIndex = text.charCodeAt(0) - 97; // a, b, c, d → 0,1,2,3
    const answer = allAnswers[selectedIndex]?.toLowerCase();

    if (answer === correct) {
      session.score++;
      await sendMessage(chatId, '✅ Correct!');
    } else {
      await sendMessage(chatId, `❌ Incorrect. Correct answer: ${currentQ.correctAnswer}`);
    }

    session.currentQuestionIndex++;

    if (session.currentQuestionIndex < session.questions.length) {
      const nextQ = formatQuestion(session.questions[session.currentQuestionIndex], session.currentQuestionIndex);
      await sendMessage(chatId, `\n${nextQ}`);
    } else {
      await sendMessage(chatId, `🎉 Quiz Over! Your Score: ${session.score}/${session.questions.length}`);
      session.questions = [];
    }
  } else {
    await sendMessage(chatId, 'Please type /start to begin the quiz.');
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
