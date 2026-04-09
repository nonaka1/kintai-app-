const express = require('express');
const { queryOne, run } = require('../db');
const { authenticate, requireAdmin } = require('../auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const location = await queryOne('SELECT * FROM store_location WHERE id = 1');
    res.json({ location: location || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { latitude, longitude, radius, name } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: '緯度・経度は必須です' });
    }

    const r = radius || 200;
    const n = name || '店舗';

    await run('DELETE FROM store_location WHERE id = 1');
    await run('INSERT INTO store_location (id, latitude, longitude, radius, name) VALUES (1, ?, ?, ?, ?)',
      [latitude, longitude, r, n]);

    res.json({ location: { id: 1, latitude, longitude, radius: r, name: n } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
