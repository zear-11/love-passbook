const express = require('express');
const { TABLE_VOLUNTEERS, TABLE_ACTIVITIES, TABLE_STAMP_RECORDS,
        listAllRecords, createRecord, batchCreateRecords, updateRecord, deleteRecord } = require('../feishu');

const router = express.Router();

// 公开接口白名单（不需要登录）
const PUBLIC_ROUTES = [
  { path: '/activities', method: 'GET' },
  { path: '/volunteers', method: 'GET' },
  { path: '/volunteers', method: 'POST' },
  { path: '/stamp-records', method: 'GET' },
  { path: '/stamp-records', method: 'POST' },
  { path: '/redeem', method: 'POST' },
];
router.use((req, res, next) => {
  const isPublic = PUBLIC_ROUTES.some(r => req.path === r.path && req.method === r.method)
    || req.path.startsWith('/stamp-records/') && req.method === 'GET';
  if (isPublic) return next();
  if (!req.session.user && !req.session.admin) return res.status(401).json({ error: '未登录' });
  next();
});

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.status(403).json({ error: '需要管理员权限' });
  next();
}

// ===== 志愿者 =====

// GET /api/feishu/volunteers?name=&phone=&keyword=
router.get('/volunteers', async (req, res) => {
  try {
    const { name, phone, keyword } = req.query;
    const conditions = [];
    if (name && phone) { conditions.push(`CurrentValue.[姓名]="${name}"`); conditions.push(`CurrentValue.[手机号]="${phone}"`); }
    else if (phone) { conditions.push(`CurrentValue.[手机号]="${phone}"`); }
    else if (name) { conditions.push(`CurrentValue.[姓名]="${name}"`); }
    else if (keyword) { conditions.push(`OR(CurrentValue.[姓名].Contains("${keyword}"),CurrentValue.[手机号].Contains("${keyword}"))`); }
    const filter = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : `AND(${conditions.join(',')})`) : undefined;
    const items = await listAllRecords(TABLE_VOLUNTEERS, filter ? { filter } : {});
    const volunteers = items.map(i => ({ recordId: i.record_id, name: i.fields['姓名'] || '', phone: i.fields['手机号'] || '', department: i.fields['部门'] || '', totalStamps: i.fields['志愿章数'] || 0, totalHours: i.fields['志愿时长'] || 0, redeemStatus: i.fields['兑换状态'] || '未兑换' }));
    res.json({ volunteers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/feishu/volunteers
router.post('/volunteers', async (req, res) => {
  try {
    const { name, phone, department } = req.body;
    if (!name || !phone) return res.status(400).json({ error: '姓名和手机号不能为空' });
    // 检查是否已存在
    const existing = await listAllRecords(TABLE_VOLUNTEERS, { filter: `AND(CurrentValue.[姓名]="${name}",CurrentValue.[手机号]="${phone}")` });
    if (existing.length > 0) {
      const i = existing[0];
      return res.json({ volunteer: { recordId: i.record_id, name: i.fields['姓名'], phone: i.fields['手机号'], department: i.fields['部门'] || '', totalStamps: i.fields['志愿章数'] || 0, totalHours: i.fields['志愿时长'] || 0, redeemStatus: i.fields['兑换状态'] || '未兑换' }, existed: true });
    }
    const record = await createRecord(TABLE_VOLUNTEERS, { '姓名': name, '手机号': phone, '部门': department || '', '志愿章数': 0, '志愿时长': 0, '兑换状态': '未兑换' });
    res.json({ volunteer: { recordId: record.record_id, name, phone, department: department || '', totalStamps: 0, totalHours: 0, redeemStatus: '未兑换' }, existed: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/feishu/volunteers/:recordId
router.delete('/volunteers/:recordId', requireAdmin, async (req, res) => {
  try {
    const { recordId } = req.params;
    // 删除该志愿者的所有印章记录
    const records = await listAllRecords(TABLE_STAMP_RECORDS, { filter: `CurrentValue.[志愿者ID]="${recordId}"` });
    for (const r of records) { await deleteRecord(TABLE_STAMP_RECORDS, r.record_id); }
    await deleteRecord(TABLE_VOLUNTEERS, recordId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== 活动 =====

router.get('/activities', async (req, res) => {
  try {
    const items = await listAllRecords(TABLE_ACTIVITIES);
    const activities = items.map(i => ({ recordId: i.record_id, name: i.fields['活动名称'] || '', date: i.fields['活动日期'] || '', location: i.fields['活动地点'] || '', defaultHours: i.fields['默认时长'] || 2 }));
    res.json({ activities });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/activities', requireAdmin, async (req, res) => {
  try {
    const { name, date, location, defaultHours } = req.body;
    if (!name) return res.status(400).json({ error: '活动名称不能为空' });
    const record = await createRecord(TABLE_ACTIVITIES, { '活动名称': name, '活动日期': date || null, '活动地点': location || '', '默认时长': defaultHours || 2 });
    res.json({ activity: { recordId: record.record_id, name, date: date || '', location: location || '', defaultHours: defaultHours || 2 } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== 印章记录 =====

router.get('/stamp-records', async (req, res) => {
  try {
    const { volunteer_id, status } = req.query;
    const conditions = [];
    if (volunteer_id) conditions.push(`CurrentValue.[志愿者ID]="${volunteer_id}"`);
    if (status) conditions.push(`CurrentValue.[状态]="${status}"`);
    const filter = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : `AND(${conditions.join(',')})`) : undefined;
    const items = await listAllRecords(TABLE_STAMP_RECORDS, filter ? { filter } : {});

    // 批量获取志愿者和活动名称
    const [volItems, actItems] = await Promise.all([
      listAllRecords(TABLE_VOLUNTEERS),
      listAllRecords(TABLE_ACTIVITIES),
    ]);
    const volMap = Object.fromEntries(volItems.map(v => [v.record_id, v.fields['姓名'] || '']));
    const actMap = Object.fromEntries(actItems.map(a => [a.record_id, { name: a.fields['活动名称'] || '', location: a.fields['活动地点'] || '' }]));

    const records = items.map(i => ({
      recordId: i.record_id,
      volunteerRecordId: i.fields['志愿者ID'] || '',
      activityRecordId: i.fields['活动ID'] || '',
      hours: i.fields['时长'] || 0,
      date: i.fields['日期'] || '',
      source: i.fields['来源'] || 'self',
      status: i.fields['状态'] || 'pending',
      note: i.fields['备注'] || '',
      volunteerName: volMap[i.fields['志愿者ID']] || '',
      activityName: (actMap[i.fields['活动ID']] || {}).name || '',
      activityLocation: (actMap[i.fields['活动ID']] || {}).location || '',
    }));
    res.json({ records });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/stamp-records', async (req, res) => {
  try {
    const { volunteer_id, activity_id, hours, date, source, status, note } = req.body;
    if (!volunteer_id || !activity_id) return res.status(400).json({ error: '志愿者和活动不能为空' });
    // 防重复
    const dup = await listAllRecords(TABLE_STAMP_RECORDS, { filter: `AND(CurrentValue.[志愿者ID]="${volunteer_id}",CurrentValue.[活动ID]="${activity_id}",CurrentValue.[状态]!="rejected")` });
    if (dup.length > 0) return res.status(400).json({ error: '该活动的志愿章已存在' });

    const dateValue = date ? Math.round(new Date(date).getTime() / 1000) : null;
    await createRecord(TABLE_STAMP_RECORDS, { '志愿者ID': volunteer_id, '活动ID': activity_id, '时长': hours || 2, '日期': dateValue, '来源': source || 'self', '状态': status || 'pending', '备注': note || '' });
    // 如果直接approved，更新统计
    if (status === 'approved') await updateVolunteerStats(volunteer_id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/stamp-records/:recordId/review', requireAdmin, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: '状态值无效' });
    // 获取原记录
    const items = await listAllRecords(TABLE_STAMP_RECORDS, { filter: `CurrentValue.[记录ID]="${recordId}"` });
    // 直接用recordId更新
    await updateRecord(TABLE_STAMP_RECORDS, recordId, { '状态': status, '审核时间': Math.round(Date.now() / 1000) });
    // 更新统计
    if (status === 'approved' && items.length > 0) {
      await updateVolunteerStats(items[0].fields['志愿者ID']);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/stamp-records/batch', requireAdmin, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) return res.status(400).json({ error: 'records不能为空' });
    let created = 0;
    const updatedVolIds = new Set();
    for (const r of records) {
      const dup = await listAllRecords(TABLE_STAMP_RECORDS, { filter: `AND(CurrentValue.[志愿者ID]="${r.volunteer_id}",CurrentValue.[活动ID]="${r.activity_id}")` });
      if (dup.length === 0) {
        const dateValue = r.date ? Math.round(new Date(r.date).getTime() / 1000) : null;
        await createRecord(TABLE_STAMP_RECORDS, { '志愿者ID': r.volunteer_id, '活动ID': r.activity_id, '时长': r.hours || 2, '日期': dateValue, '来源': 'admin', '状态': 'approved', '备注': '' });
        created++;
        updatedVolIds.add(r.volunteer_id);
      }
    }
    for (const vid of updatedVolIds) { await updateVolunteerStats(vid); }
    res.json({ count: created });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== 兑换 =====

router.post('/redeem', async (req, res) => {
  try {
    const { volunteer_id } = req.body;
    if (!volunteer_id) return res.status(400).json({ error: '志愿者ID不能为空' });
    const vols = await listAllRecords(TABLE_VOLUNTEERS, { filter: `CurrentValue.[记录ID]="${volunteer_id}"` });
    // 用recordId直接查
    const volItems = await listAllRecords(TABLE_VOLUNTEERS);
    const vol = volItems.find(v => v.record_id === volunteer_id);
    if (!vol) return res.status(404).json({ error: '志愿者不存在' });
    const stamps = vol.fields['志愿章数'] || 0;
    const redeemStatus = vol.fields['兑换状态'] || '未兑换';
    if (stamps < 6) return res.status(400).json({ error: '志愿章不足6枚，暂不可兑换' });
    if (redeemStatus === '已兑换') return res.status(400).json({ error: '已兑换过礼品' });
    await updateRecord(TABLE_VOLUNTEERS, volunteer_id, { '兑换状态': '已兑换' });
    res.json({ ok: true, message: '🎉 兑换成功！' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== 统计 =====

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [vols, approved, pending] = await Promise.all([
      listAllRecords(TABLE_VOLUNTEERS),
      listAllRecords(TABLE_STAMP_RECORDS, { filter: 'CurrentValue.[状态]="approved"' }),
      listAllRecords(TABLE_STAMP_RECORDS, { filter: 'CurrentValue.[状态]="pending"' }),
    ]);
    const totalHours = approved.reduce((s, i) => s + (i.fields['时长'] || 0), 0);
    const redeemCount = vols.filter(v => v.fields['兑换状态'] === '已兑换').length;
    res.json({ volunteerCount: vols.length, approvedCount: approved.length, pendingCount: pending.length, totalHours, redeemCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== 辅助：更新志愿者统计 =====
async function updateVolunteerStats(volunteerRecordId) {
  const approved = await listAllRecords(TABLE_STAMP_RECORDS, { filter: `AND(CurrentValue.[志愿者ID]="${volunteerRecordId}",CurrentValue.[状态]="approved")` });
  const totalStamps = approved.length;
  const totalHours = approved.reduce((s, i) => s + (i.fields['时长'] || 0), 0);
  const redeemStatus = totalStamps >= 6 ? '可兑换' : '未兑换';
  // 如果已兑换则不回退
  const volItems = await listAllRecords(TABLE_VOLUNTEERS);
  const vol = volItems.find(v => v.record_id === volunteerRecordId);
  if (vol && vol.fields['兑换状态'] === '已兑换') {
    await updateRecord(TABLE_VOLUNTEERS, volunteerRecordId, { '志愿章数': totalStamps, '志愿时长': totalHours });
  } else {
    await updateRecord(TABLE_VOLUNTEERS, volunteerRecordId, { '志愿章数': totalStamps, '志愿时长': totalHours, '兑换状态': redeemStatus });
  }
}

module.exports = router;
