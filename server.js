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
const quizzes = {
  General: [
    { question: 'Capital of France?', options: ['Paris', 'London', 'Berlin'], answer: 'Paris' },
    { question: 'Red planet?', options: ['Earth', 'Mars', 'Venus'], answer: 'Mars' },
    { question: 'Boiling point of water?', options: ['90°C', '100°C', '110°C'], answer: '100°C' },
    { question: 'Language in Brazil?', options: ['Spanish', 'Portuguese', 'French'], answer: 'Portuguese' },
    { question: 'H2O is?', options: ['Oxygen', 'Water', 'Hydrogen'], answer: 'Water' },
    { question: 'Symbol of peace?', options: ['Crow', 'Dove', 'Sparrow'], answer: 'Dove' },
    { question: 'Bees make?', options: ['Milk', 'Honey', 'Wax'], answer: 'Honey' },
    { question: 'Largest ocean?', options: ['Atlantic', 'Indian', 'Pacific'], answer: 'Pacific' },
    { question: 'Invented lightbulb?', options: ['Tesla', 'Edison', 'Bell'], answer: 'Edison' },
    { question: 'Currency of Japan?', options: ['Yuan', 'Yen', 'Won'], answer: 'Yen' },
    { question: 'Largest mammal?', options: ['Elephant', 'Whale', 'Giraffe'], answer: 'Whale' },
    { question: 'Metal liquid at room temp?', options: ['Mercury', 'Iron', 'Gold'], answer: 'Mercury' },
    { question: 'Continent count?', options: ['5', '6', '7'], answer: '7' },
    { question: 'Discovered gravity?', options: ['Einstein', 'Newton', 'Galileo'], answer: 'Newton' },
    { question: '2016 Olympics host?', options: ['China', 'Brazil', 'UK'], answer: 'Brazil' },
    { question: 'Square root of 64?', options: ['6', '8', '10'], answer: '8' },
    { question: 'Maple leaf country?', options: ['USA', 'Canada', 'Germany'], answer: 'Canada' },
    { question: 'Shakespeare work?', options: ['Hamlet', 'Odyssey', 'Inferno'], answer: 'Hamlet' },
    { question: 'What gas do plants absorb?', options: ['Oxygen', 'Carbon Dioxide', 'Hydrogen'], answer: 'Carbon Dioxide' },
    { question: 'Painted Mona Lisa?', options: ['Van Gogh', 'Picasso', 'Da Vinci'], answer: 'Da Vinci' }
  ],
  History: [
    { question: 'Who was the first U.S. president?', options: ['Lincoln', 'Washington', 'Jefferson'], answer: 'Washington' },
    { question: 'World War II ended in?', options: ['1945', '1939', '1950'], answer: '1945' },
    { question: 'Taj Mahal was built by?', options: ['Akbar', 'Shah Jahan', 'Aurangzeb'], answer: 'Shah Jahan' },
    { question: 'Independence of India?', options: ['1942', '1945', '1947'], answer: '1947' },
    { question: 'Great Wall of China is in?', options: ['Japan', 'China', 'Korea'], answer: 'China' },
    { question: 'Hitler ruled which country?', options: ['Italy', 'Germany', 'France'], answer: 'Germany' },
    { question: 'Who discovered America?', options: ['Columbus', 'Magellan', 'Cook'], answer: 'Columbus' },
    { question: 'Cold War was between?', options: ['USA & USSR', 'UK & France', 'India & China'], answer: 'USA & USSR' },
    { question: 'Who wrote “The Republic”?', options: ['Plato', 'Aristotle', 'Socrates'], answer: 'Plato' },
    { question: 'Which empire built the Colosseum?', options: ['Greek', 'Roman', 'Ottoman'], answer: 'Roman' },
    { question: 'Napoleon was emperor of?', options: ['France', 'Spain', 'Italy'], answer: 'France' },
    { question: 'Mahatma Gandhi led the?', options: ['Salt March', 'War of Roses', 'Boxer Rebellion'], answer: 'Salt March' },
    { question: 'Pyramids of Giza built by?', options: ['Romans', 'Egyptians', 'Greeks'], answer: 'Egyptians' },
    { question: 'Alexander the Great from?', options: ['Rome', 'Greece', 'Macedonia'], answer: 'Macedonia' },
    { question: 'Berlin Wall fell in?', options: ['1985', '1989', '1991'], answer: '1989' },
    { question: 'World War I began in?', options: ['1914', '1920', '1900'], answer: '1914' },
    { question: 'First man on the moon?', options: ['Buzz Aldrin', 'Yuri Gagarin', 'Neil Armstrong'], answer: 'Neil Armstrong' },
    { question: 'Founder of Buddhism?', options: ['Mahavira', 'Gautama Buddha', 'Krishna'], answer: 'Gautama Buddha' },
    { question: 'Battle of Panipat fought in?', options: ['1526', '1680', '1757'], answer: '1526' },
    { question: 'Mona Lisa painted in which era?', options: ['Renaissance', 'Baroque', 'Modern'], answer: 'Renaissance' }
  ],
  Tech: [
    { question: 'HTML stands for?', options: ['Hyper Trainer Markup', 'Hyper Text Markup', 'Hyper Tool Markup'], answer: 'Hyper Text Markup' },
    { question: 'First computer?', options: ['ENIAC', 'Macintosh', 'IBM PC'], answer: 'ENIAC' },
    { question: 'Programming language from Google?', options: ['Go', 'Rust', 'Swift'], answer: 'Go' },
    { question: 'Operating system by Apple?', options: ['Windows', 'macOS', 'Linux'], answer: 'macOS' },
    { question: 'Java was developed by?', options: ['Microsoft', 'Sun Microsystems', 'IBM'], answer: 'Sun Microsystems' },
    { question: 'Main circuit board in PC?', options: ['CPU', 'Motherboard', 'RAM'], answer: 'Motherboard' },
    { question: 'HTTP stands for?', options: ['HyperText Transfer Protocol', 'Hyper Transfer Text Process', 'High Text Transfer Protocol'], answer: 'HyperText Transfer Protocol' },
    { question: 'Linux creator?', options: ['Gates', 'Jobs', 'Torvalds'], answer: 'Torvalds' },
    { question: 'SQL is for?', options: ['Design', 'Web', 'Database'], answer: 'Database' },
    { question: 'Most popular mobile OS?', options: ['iOS', 'Android', 'Windows'], answer: 'Android' },
    { question: 'RAM is?', options: ['Storage', 'Memory', 'Processor'], answer: 'Memory' },
    { question: 'URL stands for?', options: ['Unified Resource Link', 'Uniform Resource Locator', 'Uniform Relocation Link'], answer: 'Uniform Resource Locator' },
    { question: 'Cloud by Amazon?', options: ['Azure', 'AWS', 'Google Cloud'], answer: 'AWS' },
    { question: 'Search engine by Microsoft?', options: ['Bing', 'Yahoo', 'DuckDuckGo'], answer: 'Bing' },
    { question: 'Founder of Facebook?', options: ['Zuckerberg', 'Jobs', 'Page'], answer: 'Zuckerberg' },
    { question: 'WhatsApp bought by?', options: ['Apple', 'Facebook', 'Google'], answer: 'Facebook' },
    { question: 'PDF stands for?', options: ['Portable Document Format', 'Printed Doc File', 'Portable Data Format'], answer: 'Portable Document Format' },
    { question: 'Python is?', options: ['Snake', 'Programming Language', 'OS'], answer: 'Programming Language' },
    { question: 'Tesla CEO?', options: ['Bezos', 'Musk', 'Cook'], answer: 'Musk' },
    { question: 'First iPhone launch year?', options: ['2005', '2007', '2010'], answer: '2007' }
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
