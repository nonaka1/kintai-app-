const express = require('express');
const bcrypt = require('bcryptjs');
const { query, queryOne, run } = require('../db');
const { authenticate, requireAdmin } = require('../auth');

const router = express.Router();

router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const staffList = await query('SELECT id, name, login_id, role, created_at FROM staff ORDER BY id');
    res.json({ staff: staffList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, login_id, password, role } = req.body;
    if (!name || !login_id || !password) {
      return res.status(400).json({ error: '名前、ログインID、パスワードは必須です' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const staffRole = role === 'admin' ? 'admin' : 'staff';

    await run('INSERT INTO staff (name, login_id, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, login_id, password_hash, staffRole]);

    const newStaff = await queryOne('SELECT id, name, login_id, role, created_at FROM staff WHERE login_id = ?', [login_id]);
    res.status(201).json({ staff: newStaff });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'このログインIDはすでに使用されています' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const staffId = req.params.id;
    if (parseInt(staffId) === req.user.id) {
      return res.status(400).json({ error: '自分自身は削除できません' });
    }

    await run('DELETE FROM attendance WHERE staff_id = ?', [staffId]);
    await run('DELETE FROM staff WHERE id = ?', [staffId]);

    res.json({ message: 'スタッフを削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
