const express = require('express');
const crypto = require('crypto');
const { FEISHU_APP_ID, getJsApiTicket, getUserAccessToken, getUserInfo, ADMIN_EMPLOYEE_IDS } = require('../feishu');

const router = express.Router();

// POST /api/auth/login — 飞书authCode换身份
router.post('/login', async (req, res) => {
  try {
    const { authCode } = req.body;
    if (!authCode) return res.status(400).json({ error: '缺少authCode' });
    const tokenData = await getUserAccessToken(authCode);
    const userInfo = await getUserInfo(tokenData.access_token);
    const isAdmin = ADMIN_EMPLOYEE_IDS.includes(userInfo.employee_id || '');
    req.session.user = {
      openId: userInfo.open_id, name: userInfo.name,
      employeeId: userInfo.employee_id || '',
      department: userInfo.department_name || '',
      phone: userInfo.mobile || '',
      isAdmin,
    };
    res.json({ user: req.session.user });
  } catch (err) { res.status(500).json({ error: '登录失败: ' + err.message }); }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '未登录' });
  res.json({ user: req.session.user });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => { req.session.destroy(() => res.json({ ok: true })); });

// GET /api/auth/jssdk-config
router.get('/jssdk-config', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: '缺少url' });
    const ticket = await getJsApiTicket();
    const nonceStr = Math.random().toString(36).substring(2, 15);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureStr = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
    const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');
    res.json({ appId: FEISHU_APP_ID, timestamp, nonceStr, signature });
  } catch (err) { res.status(500).json({ error: '签名失败' }); }
});

// GET /api/auth/config
router.get('/config', (req, res) => {
  res.json({ appId: FEISHU_APP_ID, inFeishu: true });
});

module.exports = router;
