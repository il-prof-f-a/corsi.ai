'use strict';
const express = require('express');
const router = express.Router();
const { isFirstRun, openDatabase, closeDatabase } = require('../database');

// GET /api/auth/status
router.get('/status', (req, res) => {
  res.json({
    authenticated: !!(req.session?.authenticated),
    firstRun: isFirstRun()
  });
});

// POST /api/auth/login  (usato anche per il primo setup)
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string' || !password.length) {
    return res.status(400).json({ error: 'Password richiesta' });
  }
  const result = openDatabase(password);
  if (result.success) {
    req.session.authenticated = true;
    return res.json({ success: true, firstRun: result.firstRun });
  }
  return res.status(401).json({ error: result.error });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    closeDatabase();
    res.json({ success: true });
  });
});

module.exports = router;
