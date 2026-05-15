import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import authRouter from './routes/auth.js';
import stateRouter from './routes/state.js';
import setupRouter from './routes/setup.js';
import planRouter from './routes/plan.js';
import chatRouter from './routes/chat.js';
import logRouter from './routes/log.js';
import logsRouter from './routes/logs.js';
import adaptationsRouter from './routes/adaptations.js';
import medicalClearanceRouter from './routes/medicalClearance.js';
import painSeverityRouter from './routes/painSeverity.js';
import conversationsRouter from './routes/conversations.js';
import exerciseRoutes from './routes/exercises.js';
import replanRouter from './routes/replan.js';
import progressRouter from './routes/progress.js';
import { requireAuth } from './middleware/auth.js';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((s) => s.trim())
    : ['http://localhost:5173', 'exp://'],
  credentials: true,
}));
app.use(express.json());

app.get('/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/auth', authRouter);
app.use('/api/state', stateRouter);
app.use('/api/setup', setupRouter);
app.use('/api/plan', planRouter);
app.use('/api/chat', chatRouter);
app.use('/api/log', logRouter);
app.use('/api/logs', logsRouter);
app.use('/api/adaptations', adaptationsRouter);
app.use('/api/medical-clearance', medicalClearanceRouter);
app.use('/api/pain-severity', painSeverityRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/exercises', requireAuth, exerciseRoutes);
app.use('/api/replan', replanRouter);
app.use('/api/progress', progressRouter);

const PORT = process.env.PORT || 3001;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
