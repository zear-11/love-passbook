const { getDb } = require('../db/schema');

/**
 * 更新志愿者的累计数据（志愿章数、志愿时长、兑换状态）
 */
function updateVolunteerStats(volunteerId) {
  const db = getDb();

  const stats = db.prepare(`
    SELECT COUNT(*) as total_stamps, COALESCE(SUM(hours), 0) as total_hours
    FROM stamp_records
    WHERE volunteer_id = ? AND status = 'approved'
  `).get(volunteerId);

  const redeemStatus = stats.total_stamps >= 6 ? 'available' : 'none';

  db.prepare(`
    UPDATE volunteers
    SET total_stamps = ?, total_hours = ?, redeem_status = ?
    WHERE id = ?
  `).run(stats.total_stamps, stats.total_hours, redeemStatus, volunteerId);

  return stats;
}

module.exports = { updateVolunteerStats };
