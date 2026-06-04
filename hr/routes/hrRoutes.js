const express = require('express');
const router = express.Router();

router.get('/employees', (req, res) => {
  res.send('List of employees');
});

module.exports = router;
