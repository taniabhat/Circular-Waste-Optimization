const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:8080',
    /\.vercel\.app$/  // Allow all Vercel deployments
  ],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'UWRMS API Server is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/login, /api/auth/register, /api/auth/me',
      data: '/api/data/stats, /api/data/waste-by-type, /api/data/waste-by-city, /api/data/waste-by-year, /api/data/disposal-methods, /api/data/efficiency-report'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 UWRMS API Server running on port ${PORT}`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/`);
  console.log(`   Auth:   http://localhost:${PORT}/api/auth/login`);
  console.log(`   Data:   http://localhost:${PORT}/api/data/stats\n`);
});
