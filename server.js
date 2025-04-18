// server.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

app.use(bodyParser.json());

// Sample general knowledge questions
const quizData = [
  { question: 'What is the capital of France?', options: ['Paris', 'London', 'Berlin'], answer: 'Paris' },
  { question: 'Which planet is known as the Red Planet?', options: ['Earth', 'Mars', 'Venus'], answer: 'Mars' },
  { question: 'Who wrote Hamlet?', options: ['Shakespeare', 'Hemingway', 'Frost'], answer: 'Shakespeare' },
  { question: 'What is the boiling point of water?', options: ['90°C', '100°C', '110°C'], answer: '100°C' },
  { question: 'Who painted the Mona Lisa?', options: ['Van Gogh', 'Picasso', 'Da Vinci'], answer: 'Da Vinci' },
  { question: 'Which country is known for the maple leaf?', options: ['USA', 'Canada', 'Germany'], answer: 'Canada' },
  { question: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Pacific'], answer: 'Pacific' },
  { question: 'Who discovered gravity?', options: ['Einstein', 'Newton', 'Galileo'], answer: 'Newton' },
  { question: 'What is H2O?', options: ['Oxygen', 'Water', 'Hydrogen'], answer: 'Water' },
  { question: 'What language is spoken in Brazil?', options: ['Spanish', 'Portuguese', 'French'], answer: 'Portuguese' },
  { question: 'What is the currency of Japan?', options: ['Yuan', 'Yen', 'Won'], answer: 'Yen' },
  { question: 'Which is the largest mammal?', options: ['Elephant', 'Whale', 'Giraffe'], answer: 'Whale' },
  { question: 'What gas do plants absorb?', options: ['Oxygen', 'Carbon Dioxide', 'Hydrogen'], answer: 'Carbon Dioxide' },
  { question: 'Which country hosted the 2016 Olympics?', options: ['China', 'Brazil', 'UK'], answer: 'Brazil' },
  { question: 'What is the square root of 64?', options: ['6', '8', '10'], answer: '8' },
  { question: 'Which metal is liquid at room temp?', options: ['Mercury', 'Iron', 'Gold'], answer: 'Mercury' },
  { question: 'How many continents are there?', options: ['5', '6', '7'], answer: '7' },
  { question: 'What do bees make?', options: ['Milk', 'Honey', 'Wax'], answer: 'Honey' },
  { question: 'Which bird is a universal peace symbol?', options: ['Crow', 'Dove', 'Sparrow'], answer: 'Dove' },
  { question: 'Who invented the lightbulb?', options: ['Tesla', 'Edison', 'Bell'], answer: 'Edison' }
];

const userStates = {};

app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  const chatId = message.chat.id;
  const text = message.text;

  if (!userStates[chatId]) {
    userStates[chatId] = { current: 0, score: 0 };
  }

  if (text === '/start') {
    await sendMessage(chatId, 'Welcome to Quick Quiz! Type /quiz to begin.');
  } else if (text === '/quiz') {
    userStates[chatId] = { current: 0, score: 0 };
    sendQuestion(chatId);
  } else {
    checkAnswer(chatId, text);
  }

  res.sendStatus(200);
});

async function sendQuestion(chatId) {
  const state = userStates[chatId];
  if (state.current < quizData.length) {
    const q = quizData[state.current];
    const options = q.options.map(opt => [{ text: opt, callback_data: opt }]);
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `Q${state.current + 1}: ${q.question}`,
      reply_markup: { keyboard: options, one_time_keyboard: true, resize_keyboard: true }
    });
  } else {
    await sendMessage(chatId, `Quiz finished! Your score: ${state.score}/${quizData.length}`);
    delete userStates[chatId];
  }
}

async function checkAnswer(chatId, text) {
  const state = userStates[chatId];
  const currentQ = quizData[state.current];
  if (text === currentQ.answer) {
    state.score++;
    await sendMessage(chatId, '✅ Correct!');
  } else {
    await sendMessage(chatId, `❌ Wrong. Correct answer was: ${currentQ.answer}`);
  }
  state.current++;
  sendQuestion(chatId);
}

async function sendMessage(chatId, text) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: text
  });
}

app.get('/', (req, res) => {
  res.send('Quiz bot is live!');
});

app.listen(PORT, () => {
  console.log(`✅ Webhook listening on port ${PORT}`);
});
