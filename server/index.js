const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDb, queryOne, run } = require('./db');
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const staffRoutes = require('./routes/staffRoutes');
const storeLocationRoutes = require('./routes/storeLocationRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/store-location', storeLocationRoutes);

// 本番環境: Reactビルド済みファイルを配信
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

async function seedAdmin() {
  const row = await queryOne("SELECT COUNT(*) as count FROM staff WHERE role = 'admin'");
  if (row.count === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await run("INSERT INTO staff (name, login_id, password_hash, role) VALUES (?, ?, ?, ?)",
      ['管理者', 'admin', hash, 'admin']);
    console.log('初期管理者を作成しました: login_id=admin, password=admin123');
  }
}

async function start() {
  await initDb();
  await seedAdmin();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`サーバー起動: http://localhost:${PORT}`);
  });
}

start();
