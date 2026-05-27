const express = require('express');
const bcrypt = require('bcryptjs');
const { listAllRecords, createRecord, TABLE_VOLUNTEERS } = require('../feishu');

const router = express.Router();

// POST /api/admin/login — 用姓名+电话+密码，验证身份通过飞书多维表格中的管理员记录
// 简化版：管理员信息存在环境变量中
const ADMIN_ACCOUNTS = [
  { name: '管理员', phone: '13800000000', passwordHash: bcrypt.hashSync('admin123', 10) },
];

// 允许通过环境变量添加更多管理员
if (process.env.ADMIN_ACCOUNTS) {
  try {
    const extra = JSON.parse(process.env.ADMIN_ACCOUNTS);
    extra.forEach(a => { a.passwordHash = bcrypt.hashSync(a.password, 10); ADMIN_ACCOUNTS.push(a); });
  } catch (e) {}
}

router.post('/login', (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ error: '请填写完整信息' });
    const admin = ADMIN_ACCOUNTS.find(a => a.name === name && a.phone === phone);
    if (!admin) return res.status(401).json({ error: '姓名或电话不正确' });
    if (!bcrypt.compareSync(password, admin.passwordHash)) return res.status(401).json({ error: '密码不正确' });
    req.session.admin = { name: admin.name, phone: admin.phone };
    res.json({ admin: { name: admin.name, phone: admin.phone } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', (req, res) => {
  if (!req.session.admin) return res.status(401).json({ error: '未登录' });
  res.json({ admin: req.session.admin });
});

router.post('/logout', (req, res) => { req.session.destroy(() => res.json({ ok: true })); });

module.exports = router;
