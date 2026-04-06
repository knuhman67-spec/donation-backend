console.log('MAIN SERVER FILE LOADED');

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const memberRoutes = require('./routes/memberRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const paymentRequestRoutes = require('./routes/paymentRequestRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.get('/', (req, res) => {
  res.status(200).send('Donation Manager API running');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    environment: process.env.NODE_ENV || 'development',
  });
});

app.use('/auth', authRoutes);
app.use('/organizations', organizationRoutes);
app.use('/members', memberRoutes);
app.use('/payments', paymentRoutes);
app.use('/reports', reportRoutes);
app.use('/payment-requests', paymentRequestRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message,
  });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});