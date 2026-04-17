const express = require('express');
const { query, queryOne, run } = require('../db');
const { authenticate, requireAdmin } = require('../auth');

const router = express.Router();

// 全店舗取得（admin: 全店舗 / staff: 自分の所属店舗のみ）
router.get('/', authenticate, async (req, res) => {
  try {
    let stores;
    if (req.user.role === 'admin') {
      stores = await query('SELECT * FROM stores ORDER BY id');
    } else {
      stores = await query(
        'SELECT s.* FROM stores s JOIN staff_stores ss ON s.id = ss.store_id WHERE ss.staff_id = ? ORDER BY s.id',
        [req.user.id]
      );
    }
    res.json({ stores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 店舗追加（admin）
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, latitude, longitude, radius } = req.body;
    if (!name || latitude == null || longitude == null) {
      return res.status(400).json({ error: '名前・緯度・経度は必須です' });
    }
    const r = radius || 200;
    await run('INSERT INTO stores (name, latitude, longitude, radius) VALUES (?, ?, ?, ?)',
      [name, latitude, longitude, r]);
    const stores = await query('SELECT * FROM stores ORDER BY id');
    res.status(201).json({ stores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 店舗更新（admin）
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, latitude, longitude, radius } = req.body;
    const id = req.params.id;
    if (!name || latitude == null || longitude == null) {
      return res.status(400).json({ error: '名前・緯度・経度は必須です' });
    }
    const r = radius || 200;
    await run('UPDATE stores SET name = ?, latitude = ?, longitude = ?, radius = ? WHERE id = ?',
      [name, latitude, longitude, r, id]);
    res.json({ message: '更新しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 店舗削除（admin）
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await run('DELETE FROM staff_stores WHERE store_id = ?', [id]);
    await run('DELETE FROM stores WHERE id = ?', [id]);
    res.json({ message: '削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
