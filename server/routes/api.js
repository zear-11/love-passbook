const express = require('express');
const { getDb } = require('../db/schema');
const { updateVolunteerStats } = require('../services/volunteer');

const router = express.Router();

// ==================== 志愿者 ====================

/**
 * GET /api/volunteers?name=&employee_id=&phone=&keyword=
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { name, employee_id, phone, keyword } = req.query;

    let sql = 'SELECT * FROM volunteers WHERE 1=1';
    const params = [];

    if (name && employee_id) {
      sql += ' AND name = ? AND employee_id = ?';
      params.push(name, employee_id);
    } else if (name) {
      sql += ' AND name = ?';
      params.push(name);
    } else if (phone) {
      sql += ' AND phone = ?';
      params.push(phone);
    } else if (keyword) {
      sql += ' AND (name LIKE ? OR employee_id LIKE ? OR phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY id DESC';

    const volunteers = db.prepare(sql).all(...params);
    res.json({ volunteers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/volunteers
 * 创建志愿者（如不存在则创建）
 */
router.post('/', (req, res) => {
  try {
    const { name, employee_id, department, phone } = req.body;

    if (!name || !employee_id) {
      return res.status(400).json({ error: '姓名和工号不能为空' });
    }

    const db = getDb();

    // 查找已有
    const existing = db.prepare('SELECT * FROM volunteers WHERE name = ? AND employee_id = ?').get(name, employee_id);
    if (existing) {
      // 更新手机号（如果提供了新的）
      if (phone && !existing.phone) {
        db.prepare('UPDATE volunteers SET phone = ?, department = COALESCE(NULLIF(department,\'\'),?) WHERE id = ?')
          .run(phone, department || '', existing.id);
        existing.phone = phone;
        existing.department = existing.department || department || '';
      }
      return res.json({ volunteer: existing, existed: true });
    }

    const result = db.prepare(
      'INSERT INTO volunteers (name, employee_id, department, phone) VALUES (?, ?, ?, ?)'
    ).run(name, employee_id, department || '', phone || '');

    const volunteer = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(result.lastInsertRowid);
    res.json({ volunteer, existed: false });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: '该志愿者已存在' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/volunteers/:id
 */
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    db.prepare('DELETE FROM stamp_records WHERE volunteer_id = ?').run(id);
    db.prepare('DELETE FROM redemptions WHERE volunteer_id = ?').run(id);
    db.prepare('DELETE FROM volunteers WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 活动 ====================

/**
 * GET /api/activities
 */
router.get('/activities', (req, res) => {
  try {
    const db = getDb();
    const activities = db.prepare('SELECT * FROM activities ORDER BY date DESC').all();
    res.json({ activities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/volunteers/activities
 */
router.post('/activities', requireAdmin, (req, res) => {
  try {
    const { name, date, location, default_hours } = req.body;
    if (!name) return res.status(400).json({ error: '活动名称不能为空' });

    const db = getDb();
    const result = db.prepare(
      'INSERT INTO activities (name, date, location, default_hours) VALUES (?, ?, ?, ?)'
    ).run(name, date || '', location || '', default_hours || 2);

    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(result.lastInsertRowid);
    res.json({ activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 印章记录 ====================

/**
 * GET /api/volunteers/stamp-records?volunteer_id=&status=
 */
router.get('/stamp-records', (req, res) => {
  try {
    const db = getDb();
    const { volunteer_id, status } = req.query;

    let sql = `SELECT sr.*, a.name as activity_name, a.date as activity_date, a.location as activity_location,
               v.name as volunteer_name, v.employee_id as volunteer_employee_id
               FROM stamp_records sr
               LEFT JOIN activities a ON sr.activity_id = a.id
               LEFT JOIN volunteers v ON sr.volunteer_id = v.id
               WHERE 1=1`;
    const params = [];

    if (volunteer_id) {
      sql += ' AND sr.volunteer_id = ?';
      params.push(volunteer_id);
    }
    if (status) {
      sql += ' AND sr.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY sr.created_at DESC';

    const records = db.prepare(sql).all(...params);
    res.json({ records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/volunteers/stamp-records
 * 创建印章记录
 */
router.post('/stamp-records', (req, res) => {
  try {
    const { volunteer_id, activity_id, hours, date, source, status, note } = req.body;

    if (!volunteer_id || !activity_id) {
      return res.status(400).json({ error: '志愿者和活动不能为空' });
    }

    const db = getDb();

    // 检查重复（排除rejected的）
    const dup = db.prepare(
      'SELECT id FROM stamp_records WHERE volunteer_id = ? AND activity_id = ? AND status != ?'
    ).get(volunteer_id, activity_id, 'rejected');

    if (dup) {
      return res.status(400).json({ error: '该活动的志愿章已存在' });
    }

    const result = db.prepare(
      `INSERT INTO stamp_records (volunteer_id, activity_id, hours, date, source, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(volunteer_id, activity_id, hours || 2, date || '', source || 'self', status || 'pending', note || '');

    // 如果直接approved，更新志愿者统计
    if (status === 'approved') {
      updateVolunteerStats(volunteer_id);
    }

    const record = db.prepare(
      `SELECT sr.*, a.name as activity_name FROM stamp_records sr
       LEFT JOIN activities a ON sr.activity_id = a.id WHERE sr.id = ?`
    ).get(result.lastInsertRowid);

    res.json({ record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/volunteers/stamp-records/:id/review
 */
router.put('/stamp-records/:id/review', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '状态值无效' });
    }

    const db = getDb();
    const record = db.prepare('SELECT * FROM stamp_records WHERE id = ?').get(id);
    if (!record) return res.status(404).json({ error: '记录不存在' });

    db.prepare('UPDATE stamp_records SET status = ?, reviewed_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(status, id);

    if (status === 'approved') {
      updateVolunteerStats(record.volunteer_id);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/volunteers/stamp-records/batch
 * 批量录入
 */
router.post('/stamp-records/batch', requireAdmin, (req, res) => {
  try {
    const { records } = req.body; // [{ volunteer_id, activity_id, hours, date }]
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records不能为空' });
    }

    const db = getDb();
    let created = 0;
    const updatedVolunteerIds = new Set();

    const insertStmt = db.prepare(
      `INSERT INTO stamp_records (volunteer_id, activity_id, hours, date, source, status, note)
       VALUES (?, ?, ?, ?, 'admin', 'approved', '')`
    );
    const checkDup = db.prepare(
      'SELECT id FROM stamp_records WHERE volunteer_id = ? AND activity_id = ? AND status != ?'
    );

    const transaction = db.transaction(() => {
      for (const r of records) {
        const dup = checkDup.get(r.volunteer_id, r.activity_id, 'rejected');
        if (!dup) {
          insertStmt.run(r.volunteer_id, r.activity_id, r.hours || 2, r.date || '');
          created++;
          updatedVolunteerIds.add(r.volunteer_id);
        }
      }
    });

    transaction();

    // 更新统计
    for (const vid of updatedVolunteerIds) {
      updateVolunteerStats(vid);
    }

    res.json({ count: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 兑换 ====================

/**
 * POST /api/volunteers/redeem
 * 志愿者申请兑换礼品（满6章）
 */
router.post('/redeem', (req, res) => {
  try {
    const { volunteer_id } = req.body;
    if (!volunteer_id) return res.status(400).json({ error: '志愿者ID不能为空' });

    const db = getDb();
    const volunteer = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(volunteer_id);
    if (!volunteer) return res.status(404).json({ error: '志愿者不存在' });

    if (volunteer.total_stamps < 6) {
      return res.status(400).json({ error: '志愿章不足6枚，暂不可兑换' });
    }

    if (volunteer.redeem_status === 'redeemed') {
      return res.status(400).json({ error: '已兑换过礼品' });
    }

    // 创建兑换记录
    db.prepare(
      'INSERT INTO redemptions (volunteer_id, stamps_count, status) VALUES (?, ?, ?)'
    ).run(volunteer_id, volunteer.total_stamps, 'pending');

    // 更新志愿者状态
    db.prepare('UPDATE volunteers SET redeem_status = ?, redeem_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run('redeemed', volunteer_id);

    const updatedVol = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(volunteer_id);
    res.json({ volunteer: updatedVol, message: '🎉 兑换成功！精美礼品将尽快送达' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/volunteers/redemptions
 * 获取兑换记录列表（管理员）
 */
router.get('/redemptions', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const redemptions = db.prepare(
      `SELECT r.*, v.name as volunteer_name, v.employee_id, v.department, v.phone
       FROM redemptions r
       LEFT JOIN volunteers v ON r.volunteer_id = v.id
       ORDER BY r.redeemed_at DESC`
    ).all();
    res.json({ redemptions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/volunteers/stats
 * 数据总览
 */
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const volunteerCount = db.prepare('SELECT COUNT(*) as c FROM volunteers').get().c;
    const approvedCount = db.prepare("SELECT COUNT(*) as c FROM stamp_records WHERE status = 'approved'").get().c;
    const pendingCount = db.prepare("SELECT COUNT(*) as c FROM stamp_records WHERE status = 'pending'").get().c;
    const totalHours = db.prepare("SELECT COALESCE(SUM(hours),0) as s FROM stamp_records WHERE status = 'approved'").get().s;
    const redeemCount = db.prepare("SELECT COUNT(*) as c FROM redemptions").get().c;

    res.json({ volunteerCount, approvedCount, pendingCount, totalHours, redeemCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 管理员中间件
function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

module.exports = router;
