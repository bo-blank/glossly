import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { suggestRouter } from './routes/suggest';
import { modelsRouter } from './routes/models';
import { aiLikenessRouter } from './routes/aiLikeness';

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(suggestRouter);
app.use(modelsRouter);
app.use(aiLikenessRouter);

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || 'localhost';

app.listen(port, host, () => {
  console.log(`Glossly proxy server listening on http://${host}:${port}`);
});
