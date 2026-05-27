const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/schema');

const router = express.Router();

/**
 * POST /api/admin/login
 * 管理员登录：姓名 + 电话 + 密码
 */
router.post('/login', (req, res) => {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ error: '请填写姓名、电话和密码' });
    }

    const db = getDb();
    const admin = db.prepare('SELECT * FROM admins WHERE name = ? AND phone = ?').get(name, phone);

    if (!admin) {
      return res.status(401).json({ error: '姓名或电话不正确' });
    }

    const valid = bcrypt.compareSync(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '密码不正确' });
    }

    req.session.admin = {
      id: admin.id,
      name: admin.name,
      phone: admin.phone,
    };

    res.json({
      admin: { id: admin.id, name: admin.name, phone: admin.phone },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/me
 */
router.get('/me', (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: '未登录' });
  }
  res.json({ admin: req.session.admin });
});

/**
 * POST /api/admin/logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

/**
 * PUT /api/admin/password
 * 修改密码
 */
router.put('/password', (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请填写旧密码和新密码' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' });
    }

    const db = getDb();
    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.admin.id);

    if (!bcrypt.compareSync(oldPassword, admin.password_hash)) {
      return res.status(401).json({ error: '旧密码不正确' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, admin.id);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/create
 * 创建新管理员（需已登录）
 */
router.post('/create', (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: '请填写完整信息' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM admins WHERE phone = ?').get(phone);
    if (existing) {
      return res.status(400).json({ error: '该电话已被注册' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO admins (name, phone, password_hash) VALUES (?, ?, ?)').run(name, phone, hash);

    res.json({ admin: { id: result.lastInsertRowid, name, phone } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
