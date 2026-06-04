const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const hrRoutes = require('./hr/routes/hrRoutes');
const financeRoutes = require('./finance/routes/financeRoutes');

// Middleware
app.use(express.json());

// Use routes
app.use('/hr', hrRoutes);
app.use('/finance', financeRoutes);

app.listen(PORT, () => {
  console.log(`Lake Zone ERP server running on port ${PORT}`);
});