const express = require('express');
const session = require('express-session');
const path = require('path');
const { initTables } = require('./db/schema');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== 初始化数据库 =====
initTables();

// ===== 中间件 =====
app.use(express.json());
app.use(session({
  name: 'love-passbook-sid',
  secret: process.env.SESSION_SECRET || 'love-passbook-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// ===== API 路由 =====
app.use('/api/admin', adminRoutes);
app.use('/api/volunteers', apiRoutes);

// ===== 健康检查 =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ===== 托管前端静态文件 =====
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// SPA fallback: 所有非API请求返回 index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(publicPath, 'index.html'));
  }
});

// ===== 启动 =====
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   📖 公益部爱心存折 系统已启动           ║
║   地址: http://localhost:${PORT}           ║
║   环境: ${process.env.NODE_ENV || 'development'}                       ║
╚══════════════════════════════════════════╝
  `);
});
