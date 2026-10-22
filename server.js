// server.js
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json({ limit: '100kb' }));

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN;

const TRIVIA_API = 'https://the-trivia-api.com/v2/questions';
const TELEGRAM_API = BOT_TOKEN
  ? `https://api.telegram.org/bot${BOT_TOKEN}`
  : null;

const TELEGRAM_TIMEOUT = 10000;
const TRIVIA_TIMEOUT = 15000;
const QUESTIONS_PER_QUIZ = 5;

// In-memory data. This resets when the server restarts.
const userSessions = new Map();
const leaderboard = new Map();

// Avoid processing the same Telegram update more than once
// during the current server process.
const processedUpdates = new Set();
const MAX_PROCESSED_UPDATES = 2000;

// Telegram category button -> Trivia API category.
const CATEGORY_MAP = {
  'General Knowledge': 'general_knowledge',
  History: 'history',
  Science: 'science',
  Movies: 'film_and_tv',
};

const CATEGORIES = Object.keys(CATEGORY_MAP);

// --------------------------------------------------
// TELEGRAM MESSAGE FUNCTIONS
// --------------------------------------------------

async function sendMessage(chatId, text, extra = {}) {
  if (!TELEGRAM_API) {
    throw new Error('BOT_TOKEN is not configured.');
  }

  const response = await axios.post(
    `${TELEGRAM_API}/sendMessage`,
    {
      chat_id: chatId,
      text,
      ...extra,
    },
    {
      timeout: TELEGRAM_TIMEOUT,
    }
  );

  if (!response.data?.ok) {
    throw new Error(
      response.data?.description || 'Telegram sendMessage failed.'
    );
  }

  return response.data.result;
}

async function sendCategoryKeyboard(chatId) {
  const keyboard = CATEGORIES.map((category) => [
    { text: category },
  ]);

  await sendMessage(
    chatId,
    '🧠 Choose a quiz category below:',
    {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    }
  );
}

// --------------------------------------------------
// FETCH QUESTIONS FROM THE TRIVIA API
// --------------------------------------------------

async function fetchQuestions(category, limit = QUESTIONS_PER_QUIZ) {
  const apiCategory = CATEGORY_MAP[category];

  if (!apiCategory) {
    console.error('Unsupported quiz category:', category);
    return [];
  }

  try {
    const response = await axios.get(TRIVIA_API, {
      params: {
        categories: apiCategory,
        limit,
      },
      timeout: TRIVIA_TIMEOUT,
    });

    if (!Array.isArray(response.data)) {
      console.error('Trivia API returned an unexpected response.');
      return [];
    }

    // Check that each question has the fields required by this bot.
    const validQuestions = response.data.filter((item) => {
      return (
        typeof item?.question?.text === 'string' &&
        item.question.text.trim().length > 0 &&
        typeof item.correctAnswer === 'string' &&
        item.correctAnswer.length > 0 &&
        Array.isArray(item.incorrectAnswers) &&
        item.incorrectAnswers.length === 3 &&
        item.incorrectAnswers.every(
          (answer) =>
            typeof answer === 'string' && answer.length > 0
        )
      );
    });

    console.log(
      `Trivia API: received ${response.data.length} questions; ` +
      `${validQuestions.length} valid for ${apiCategory}.`
    );

    return validQuestions;
  } catch (error) {
    console.error(
      'Trivia API request failed:',
      error.response?.status || error.code || 'ERROR',
      error.response?.data || error.message
    );

    return [];
  }
}

// --------------------------------------------------
// FORMAT QUESTIONS AND ANSWER OPTIONS
// --------------------------------------------------

function formatQuestion(questionObj, index) {
  const answers = [
    ...questionObj.incorrectAnswers,
    questionObj.correctAnswer,
  ];

  // Shuffle the options without changing the original question.
  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }

  questionObj.shuffledAnswers = answers;

  const options = answers
    .map(
      (answer, i) =>
        `${String.fromCharCode(65 + i)}. ${answer}`
    )
    .join('\n');

  return (
    `Q${index + 1}: ${questionObj.question.text}\n\n` +
    `${options}\n\n` +
    'Reply with A, B, C, or D.'
  );
}

// --------------------------------------------------
// LEADERBOARD
// --------------------------------------------------

function getLeaderboardText() {
  const sortedPlayers = [...leaderboard.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sortedPlayers.length === 0) {
    return '📭 No scores yet! Complete a quiz to appear here.';
  }

  const lines = sortedPlayers.map(
    ([name, score], index) =>
      `${index + 1}. ${name}: ${score} pts`
  );

  return `🏆 Top Players:\n\n${lines.join('\n')}`;
}

// --------------------------------------------------
// PROCESS TELEGRAM UPDATES
// --------------------------------------------------

async function processUpdate(update) {
  const message = update?.message;

  // Ignore updates that are not normal text messages.
  if (
    !message ||
    !message.chat ||
    typeof message.text !== 'string'
  ) {
    return;
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  const from = message.from || {};
  const userName =
    from.username ||
    from.first_name ||
    `User_${chatId}`;

  if (!userSessions.has(chatId)) {
    userSessions.set(chatId, {
      score: 0,
      currentQuestionIndex: 0,
      questions: [],
      category: '',
    });
  }

  const session = userSessions.get(chatId);

  // /start
  if (text === '/start') {
    // Reset any unfinished quiz.
    session.score = 0;
    session.currentQuestionIndex = 0;
    session.questions = [];
    session.category = '';

    await sendMessage(
      chatId,
      '👋 Welcome to Quick Quiz Bot!\n\n' +
      'Choose a category to begin your quiz.\n' +
      'Answer each question with A, B, C, or D.'
    );

    await sendCategoryKeyboard(chatId);
    return;
  }

  // /leaderboard
  if (text === '/leaderboard') {
    await sendMessage(chatId, getLeaderboardText());
    return;
  }

  // Start a new quiz when a category is selected.
  if (CATEGORIES.includes(text)) {
    session.category = text;
    session.score = 0;
    session.currentQuestionIndex = 0;
    session.questions = [];

    await sendMessage(
      chatId,
      `⏳ Loading ${text} questions...`
    );

    const questions = await fetchQuestions(
      text,
      QUESTIONS_PER_QUIZ
    );

    if (questions.length === 0) {
      session.category = '';
      session.questions = [];
      session.currentQuestionIndex = 0;

      await sendMessage(
        chatId,
        '⚠️ Could not load questions right now.\n\n' +
        'Please try selecting the category again in a moment.'
      );

      return;
    }

    session.questions = questions;

    const firstQuestion = formatQuestion(
      session.questions[0],
      0
    );

    await sendMessage(
      chatId,
      `🎯 Starting "${text}" quiz!\n\n${firstQuestion}`
    );

    return;
  }

  // Handle answers when a quiz is in progress.
  if (
    session.questions.length > 0 &&
    session.currentQuestionIndex < session.questions.length
  ) {
    const letter = text.toUpperCase();

    if (!['A', 'B', 'C', 'D'].includes(letter)) {
      await sendMessage(
        chatId,
        '❗ Please answer with A, B, C, or D.'
      );
      return;
    }

    const currentQuestion =
      session.questions[session.currentQuestionIndex];

    const answerIndex = letter.charCodeAt(0) - 65;
    const selectedAnswer =
      currentQuestion.shuffledAnswers?.[answerIndex];

    if (typeof selectedAnswer !== 'string') {
      await sendMessage(
        chatId,
        '⚠️ There was a problem with this question. ' +
        'Please type /start to try again.'
      );

      session.questions = [];
      session.currentQuestionIndex = 0;
      session.category = '';
      return;
    }

    const isCorrect =
      selectedAnswer.trim().toLowerCase() ===
      currentQuestion.correctAnswer.trim().toLowerCase();

    if (isCorrect) {
      session.score++;

      await sendMessage(chatId, '✅ Correct!');
    } else {
      await sendMessage(
        chatId,
        `❌ Incorrect.\n` +
        `Correct answer: ${currentQuestion.correctAnswer}`
      );
    }

    session.currentQuestionIndex++;

    // Send the next question.
    if (
      session.currentQuestionIndex <
      session.questions.length
    ) {
      const nextQuestion = formatQuestion(
        session.questions[session.currentQuestionIndex],
        session.currentQuestionIndex
      );

      await sendMessage(chatId, nextQuestion);
      return;
    }

    // Quiz completed.
    const finalScore = session.score;
    const totalQuestions = session.questions.length;

    // Keep the player's best score.
    const previousBest = leaderboard.get(userName) || 0;

    if (finalScore > previousBest) {
      leaderboard.set(userName, finalScore);
    }

    await sendMessage(
      chatId,
      `🎉 Quiz complete!\n\n` +
      `Category: ${session.category}\n` +
      `Your score: ${finalScore}/${totalQuestions}\n` +
      `Your best score: ${Math.max(previousBest, finalScore)}\n\n` +
      'Type /start to play again or /leaderboard to see the top players.'
    );

    // Clear the completed quiz but keep the session available.
    session.score = 0;
    session.currentQuestionIndex = 0;
    session.questions = [];
    session.category = '';

    return;
  }

  // No active quiz.
  await sendMessage(
    chatId,
    '❓ I did not recognize that command.\n\n' +
    'Type /start to begin a quiz or ' +
    '/leaderboard to view the top players.'
  );
}

// --------------------------------------------------
// TELEGRAM WEBHOOK
// --------------------------------------------------

app.post('/webhook', (req, res) => {
  const update = req.body;

  // Acknowledge the webhook promptly so Telegram does not
  // keep retrying while the bot fetches questions or sends messages.
  res.sendStatus(200);

  if (!update || typeof update !== 'object') {
    return;
  }

  const updateId = update.update_id;

  if (typeof updateId === 'number') {
    if (processedUpdates.has(updateId)) {
      console.log('Ignoring duplicate Telegram update:', updateId);
      return;
    }

    processedUpdates.add(updateId);

    // Prevent the deduplication set from growing indefinitely.
    if (processedUpdates.size > MAX_PROCESSED_UPDATES) {
      const oldestId = processedUpdates.values().next().value;
      processedUpdates.delete(oldestId);
    }
  }

  processUpdate(update).catch((error) => {
    console.error(
      'Error processing Telegram update:',
      error.response?.data || error.message
    );
  });
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get('/', (req, res) => {
  res.status(200).send('✅ Quick Quiz Bot is live!');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'Quick Quiz Bot',
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`🚀 Quick Quiz Bot running on port ${PORT}`);

  if (!BOT_TOKEN) {
    console.error(
      '❌ BOT_TOKEN is missing. Add it in Render Environment Variables.'
    );
  } else {
    console.log('✅ BOT_TOKEN environment variable is configured.');
  }
});
