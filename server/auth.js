const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kintai-app-secret-key-2024';

function generateToken(staff) {
  return jwt.sign(
    { id: staff.id, login_id: staff.login_id, name: staff.name, role: staff.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'トークンが無効です' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }
  next();
}

module.exports = { generateToken, authenticate, requireAdmin, JWT_SECRET };
