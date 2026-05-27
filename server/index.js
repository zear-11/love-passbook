const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.set('trust proxy', 1);
app.use(session({
  name: 'love-passbook-sid',
  secret: process.env.SESSION_SECRET || 'love-passbook-secret',
  resave: false, saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' },
}));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feishu', apiRoutes);

// 健康检查
app.get('/api/health', (req, res) => { res.json({ status: 'ok', time: new Date().toISOString() }); });

// 托管前端
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));
app.get('*', (req, res) => { if (!req.path.startsWith('/api')) res.sendFile(path.join(publicPath, 'index.html')); });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📖 爱心存折(飞书版) 已启动 | 端口: ${PORT}`);
});
