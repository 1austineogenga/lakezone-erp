const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Root route with log
app.get('/', (req, res) => {
  console.log("Root route accessed");   // <-- log added
  res.send('Lake Zone ERP Microservice Running...');
});

// HR route example
app.get('/hr/employees', (req, res) => {
  console.log("HR employees route accessed");  // <-- log added
  res.send([{ id: 1, name: 'John Doe' }]);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);  // <-- log added
});
