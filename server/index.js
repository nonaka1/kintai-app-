const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDb, queryOne, run } = require('./db');
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const staffRoutes = require('./routes/staffRoutes');
const storeLocationRoutes = require('./routes/storeLocationRoutes');
const storesRoutes = require('./routes/storesRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ヘルスチェック（Renderのポート検出用）
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/store-location', storeLocationRoutes);
app.use('/api/stores', storesRoutes);

// 本番環境: Reactビルド済みファイルを配信
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function seedAdmin() {
  const row = await queryOne("SELECT COUNT(*) as count FROM staff WHERE role = 'admin'");
  if (Number(row.count) === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await run("INSERT INTO staff (name, login_id, password_hash, role) VALUES (?, ?, ?, ?)",
      ['管理者', 'admin', hash, 'admin']);
    console.log('初期管理者を作成しました: login_id=admin, password=admin123');
  }
}

async function start() {
  await initDb();
  await seedAdmin();
  const server = app.listen(PORT, () => {
    console.log(`サーバー起動: ポート ${PORT}`);
  });
  server.on('error', (err) => {
    console.error('サーバーエラー:', err);
  });
}

start();
