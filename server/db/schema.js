const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'passbook.db');

// 确保 data 目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');     // 提高并发写入性能
    db.pragma('foreign_keys = ON');       // 启用外键约束
    db.pragma('busy_timeout = 5000');     // 忙等待5秒
  }
  return db;
}

function initTables() {
  const db = getDb();

  db.exec(`
    -- 志愿者表
    CREATE TABLE IF NOT EXISTS volunteers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      phone         TEXT    NOT NULL,
      department    TEXT    DEFAULT '',
      total_stamps  INTEGER DEFAULT 0,
      total_hours   REAL    DEFAULT 0,
      redeem_status TEXT    DEFAULT 'none',   -- none / available / redeemed
      redeem_at     TEXT,
      created_at    TEXT    DEFAULT (datetime('now', 'localtime'))
    );

    -- 活动表
    CREATE TABLE IF NOT EXISTS activities (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      date          TEXT    DEFAULT '',
      location      TEXT    DEFAULT '',
      default_hours REAL    DEFAULT 2,
      created_at    TEXT    DEFAULT (datetime('now', 'localtime'))
    );

    -- 印章记录表
    CREATE TABLE IF NOT EXISTS stamp_records (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      volunteer_id  INTEGER NOT NULL,
      activity_id   INTEGER NOT NULL,
      hours         REAL    NOT NULL,
      date          TEXT    DEFAULT '',
      source        TEXT    DEFAULT 'self',     -- self / admin
      status        TEXT    DEFAULT 'pending',  -- pending / approved / rejected
      note          TEXT    DEFAULT '',
      created_at    TEXT    DEFAULT (datetime('now', 'localtime')),
      reviewed_at   TEXT,
      FOREIGN KEY (volunteer_id) REFERENCES volunteers(id),
      FOREIGN KEY (activity_id)  REFERENCES activities(id)
    );

    -- 管理员表
    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      phone         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    DEFAULT (datetime('now', 'localtime'))
    );

    -- 兑换记录表
    CREATE TABLE IF NOT EXISTS redemptions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      volunteer_id  INTEGER NOT NULL,
      stamps_count  INTEGER NOT NULL,
      redeemed_at   TEXT    DEFAULT (datetime('now', 'localtime')),
      status        TEXT    DEFAULT 'pending',  -- pending / shipped / completed
      note          TEXT    DEFAULT '',
      FOREIGN KEY (volunteer_id) REFERENCES volunteers(id)
    );

    -- 索引
    CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteer_name_phone
      ON volunteers(name, phone);

    CREATE INDEX IF NOT EXISTS idx_records_volunteer
      ON stamp_records(volunteer_id);

    CREATE INDEX IF NOT EXISTS idx_records_status
      ON stamp_records(status);

    CREATE INDEX IF NOT EXISTS idx_records_activity
      ON stamp_records(activity_id);

    CREATE INDEX IF NOT EXISTS idx_redemptions_volunteer
      ON redemptions(volunteer_id);
  `);

  // 检查是否需要插入默认管理员
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get();
  if (adminCount.count === 0) {
    const bcrypt = require('bcryptjs');
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO admins (name, phone, password_hash)
      VALUES (?, ?, ?)
    `).run('管理员', '13800000000', defaultPassword);
    console.log('✅ 已创建默认管理员: 姓名=管理员, 电话=13800000000, 密码=admin123');
    console.log('   ⚠️ 请尽快登录后台修改密码！');
  }
}

module.exports = { getDb, initTables, DB_PATH };
