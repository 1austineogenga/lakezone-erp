const express = require('express');
const router = express.Router();

router.get('/transactions', (req, res) => {
  res.send('List of transactions');
});

module.exports = router;
