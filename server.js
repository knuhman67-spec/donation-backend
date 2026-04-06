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
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Donation Manager API running');
});

app.use('/auth', authRoutes);
app.use('/organizations', organizationRoutes);
app.use('/members', memberRoutes);
app.use('/payments', paymentRoutes);
app.use('/reports', reportRoutes);
app.use('/payment-requests', paymentRequestRoutes);

const PORT = process.env.PORT || 3002;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});