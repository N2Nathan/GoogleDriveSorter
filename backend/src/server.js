import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import driveRoutes from './routes/drive.js';
import analysisRoutes from './routes/analysis.js';
import moveRoutes from './routes/move.js';
import { initDatabase } from './database/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
await initDatabase();

// Routes
app.use('/auth', authRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/move', moveRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
