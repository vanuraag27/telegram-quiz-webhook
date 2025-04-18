import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;

app.use(express.json());

app.post('/webhook', async (req, res) => {
  const update = req.body;

  if (update.message?.web_app_data?.data) {
    const userId = update.message.from.id;
    const data = JSON.parse(update.message.web_app_data.data);

    if (data.type === 'quiz_result') {
      const score = data.score;

      // Send result to user
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: userId,
        text: `🎉 You scored ${score}/3 in the quiz! Thanks for playing.`
      });
    }
  }

  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Webhook listening on port ${port}`);
});
