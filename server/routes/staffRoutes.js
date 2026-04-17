const express = require('express');
const bcrypt = require('bcryptjs');
const { query, queryOne, run } = require('../db');
const { authenticate, requireAdmin } = require('../auth');

const router = express.Router();

// スタッフごとの所属店舗を取得して付与
async function attachStores(staffList) {
  if (staffList.length === 0) return staffList;
  const ids = staffList.map(s => s.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query(
    `SELECT ss.staff_id, s.id, s.name FROM staff_stores ss JOIN stores s ON ss.store_id = s.id WHERE ss.staff_id IN (${placeholders}) ORDER BY s.id`,
    ids
  );
  const byStaff = {};
  rows.forEach(r => {
    if (!byStaff[r.staff_id]) byStaff[r.staff_id] = [];
    byStaff[r.staff_id].push({ id: r.id, name: r.name });
  });
  return staffList.map(s => ({ ...s, stores: byStaff[s.id] || [] }));
}

router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const staffList = await query('SELECT id, name, login_id, role, created_at FROM staff ORDER BY id');
    const withStores = await attachStores(staffList);
    res.json({ staff: withStores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, login_id, password, role, store_ids } = req.body;
    if (!name || !login_id || !password) {
      return res.status(400).json({ error: '名前、ログインID、パスワードは必須です' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const staffRole = role === 'admin' ? 'admin' : 'staff';

    await run('INSERT INTO staff (name, login_id, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, login_id, password_hash, staffRole]);

    const newStaff = await queryOne('SELECT id, name, login_id, role, created_at FROM staff WHERE login_id = ?', [login_id]);

    // 所属店舗を登録
    if (Array.isArray(store_ids) && store_ids.length > 0) {
      for (const sid of store_ids) {
        await run('INSERT INTO staff_stores (staff_id, store_id) VALUES (?, ?)', [newStaff.id, sid]);
      }
    }

    const [withStores] = await attachStores([newStaff]);
    res.status(201).json({ staff: withStores });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'このログインIDはすでに使用されています' });
    }
    res.status(500).json({ error: err.message });
  }
});

// スタッフの所属店舗を更新
router.put('/:id/stores', authenticate, requireAdmin, async (req, res) => {
  try {
    const staffId = req.params.id;
    const { store_ids } = req.body;
    if (!Array.isArray(store_ids)) {
      return res.status(400).json({ error: 'store_ids は配列で指定してください' });
    }

    await run('DELETE FROM staff_stores WHERE staff_id = ?', [staffId]);
    for (const sid of store_ids) {
      await run('INSERT INTO staff_stores (staff_id, store_id) VALUES (?, ?)', [staffId, sid]);
    }

    res.json({ message: '所属店舗を更新しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const staffId = req.params.id;
    if (parseInt(staffId) === req.user.id) {
      return res.status(400).json({ error: '自分自身は削除できません' });
    }

    await run('DELETE FROM staff_stores WHERE staff_id = ?', [staffId]);
    await run('DELETE FROM attendance WHERE staff_id = ?', [staffId]);
    await run('DELETE FROM staff WHERE id = ?', [staffId]);

    res.json({ message: 'スタッフを削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
