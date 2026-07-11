import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || 'localhost';

app.listen(port, host, () => {
  console.log(`Glossly proxy server listening on http://${host}:${port}`);
});
