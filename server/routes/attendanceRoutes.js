const express = require('express');
const { query, queryOne, run } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();

function todayStr() {
  const now = new Date();
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
}

function nowTimeStr() {
  const now = new Date();
  return String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function checkGeofence(latitude, longitude) {
  const store = await queryOne('SELECT * FROM store_location WHERE id = 1');
  if (!store) return { ok: true, distance: null, store: null };
  const distance = haversineDistance(latitude, longitude, store.latitude, store.longitude);
  return { ok: distance <= store.radius, distance: Math.round(distance), store };
}

router.post('/clock-in', authenticate, async (req, res) => {
  try {
    const date = todayStr();
    const time = nowTimeStr();
    const { latitude, longitude } = req.body;

    if (latitude != null && longitude != null) {
      const geo = await checkGeofence(latitude, longitude);
      if (!geo.ok) {
        return res.status(403).json({
          error: `店舗の範囲外です（${geo.distance}m / 許容${geo.store.radius}m）`,
          distance: geo.distance, radius: geo.store.radius
        });
      }
    }

    const existing = await queryOne('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', [req.user.id, date]);
    if (existing && existing.clock_in) {
      return res.status(400).json({ error: '本日はすでに出勤打刻済みです' });
    }

    if (!existing) {
      await run('INSERT INTO attendance (staff_id, date, clock_in, clock_in_lat, clock_in_lng) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, date, time, latitude || null, longitude || null]);
    } else {
      await run('UPDATE attendance SET clock_in = ?, clock_in_lat = ?, clock_in_lng = ? WHERE staff_id = ? AND date = ?',
        [time, latitude || null, longitude || null, req.user.id, date]);
    }

    res.json({ message: '出勤打刻しました', clock_in: time, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/clock-out', authenticate, async (req, res) => {
  try {
    const date = todayStr();
    const time = nowTimeStr();
    const { latitude, longitude } = req.body;

    if (latitude != null && longitude != null) {
      const geo = await checkGeofence(latitude, longitude);
      if (!geo.ok) {
        return res.status(403).json({
          error: `店舗の範囲外です（${geo.distance}m / 許容${geo.store.radius}m）`,
          distance: geo.distance, radius: geo.store.radius
        });
      }
    }

    const existing = await queryOne('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', [req.user.id, date]);
    if (!existing || !existing.clock_in) {
      return res.status(400).json({ error: '本日の出勤打刻がありません' });
    }
    if (existing.clock_out) {
      return res.status(400).json({ error: '本日はすでに退勤打刻済みです' });
    }

    await run('UPDATE attendance SET clock_out = ?, clock_out_lat = ?, clock_out_lng = ? WHERE staff_id = ? AND date = ?',
      [time, latitude || null, longitude || null, req.user.id, date]);

    res.json({ message: '退勤打刻しました', clock_out: time, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/break-start', authenticate, async (req, res) => {
  try {
    const date = todayStr();
    const time = nowTimeStr();

    const existing = await queryOne('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', [req.user.id, date]);
    if (!existing || !existing.clock_in) {
      return res.status(400).json({ error: '出勤打刻がありません' });
    }
    if (existing.clock_out) {
      return res.status(400).json({ error: 'すでに退勤済みです' });
    }
    if (existing.break_start && !existing.break_end) {
      return res.status(400).json({ error: 'すでに休憩中です' });
    }

    await run('UPDATE attendance SET break_start = ?, break_end = NULL WHERE staff_id = ? AND date = ?',
      [time, req.user.id, date]);

    res.json({ message: '休憩開始しました', break_start: time, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/break-end', authenticate, async (req, res) => {
  try {
    const date = todayStr();
    const time = nowTimeStr();

    const existing = await queryOne('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', [req.user.id, date]);
    if (!existing || !existing.break_start) {
      return res.status(400).json({ error: '休憩が開始されていません' });
    }
    if (existing.break_end) {
      return res.status(400).json({ error: 'すでに休憩終了済みです' });
    }

    await run('UPDATE attendance SET break_end = ? WHERE staff_id = ? AND date = ?',
      [time, req.user.id, date]);

    res.json({ message: '休憩終了しました', break_end: time, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/today', authenticate, async (req, res) => {
  try {
    const date = todayStr();
    const record = await queryOne('SELECT * FROM attendance WHERE staff_id = ? AND date = ?', [req.user.id, date]);
    res.json({ date, record: record || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/today-all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    const date = todayStr();
    const records = await query(
      'SELECT a.*, s.name as staff_name FROM attendance a JOIN staff s ON a.staff_id = s.id WHERE a.date = ? ORDER BY a.clock_in',
      [date]
    );
    const allStaff = await query('SELECT id, name FROM staff ORDER BY id');
    res.json({ date, records, allStaff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/monthly', authenticate, async (req, res) => {
  try {
    const { year, month, staff_id } = req.query;
    const targetStaffId = (req.user.role === 'admin' && staff_id) ? staff_id : req.user.id;
    const prefix = `${year}-${String(month).padStart(2, '0')}%`;

    const records = await query('SELECT * FROM attendance WHERE staff_id = ? AND date LIKE ? ORDER BY date',
      [targetStaffId, prefix]);

    res.json({ records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
