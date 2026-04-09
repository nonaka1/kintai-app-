const express = require('express');
const bcrypt = require('bcryptjs');
const { queryOne } = require('../db');
const { generateToken, authenticate } = require('../auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { login_id, password } = req.body;
    if (!login_id || !password) {
      return res.status(400).json({ error: 'ログインIDとパスワードを入力してください' });
    }

    const row = await queryOne('SELECT * FROM staff WHERE login_id = ?', [login_id]);
    if (!row) {
      return res.status(401).json({ error: 'ログインIDまたはパスワードが正しくありません' });
    }

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'ログインIDまたはパスワードが正しくありません' });
    }

    const token = generateToken(row);
    res.json({
      token,
      user: { id: row.id, name: row.name, login_id: row.login_id, role: row.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
