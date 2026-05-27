// 初始化数据库脚本
const { initTables, DB_PATH } = require('./schema');

console.log('正在初始化数据库...');
console.log(`数据库路径: ${DB_PATH}`);

try {
  initTables();
  console.log('✅ 数据库初始化完成！');
} catch (err) {
  console.error('❌ 数据库初始化失败:', err.message);
  process.exit(1);
}

// 插入演示数据
const { getDb } = require('./schema');
const db = getDb();

// 检查是否已有数据
const count = db.prepare('SELECT COUNT(*) as c FROM activities').get();
if (count.c === 0) {
  console.log('正在插入演示数据...');

  // 活动
  const insertAct = db.prepare('INSERT INTO activities (name, date, location, default_hours) VALUES (?, ?, ?, ?)');
  insertAct.run('植树节志愿活动', '2024-03-12', '城市公园', 3);
  insertAct.run('敬老院慰问', '2024-05-18', '阳光敬老院', 2);
  insertAct.run('儿童图书馆捐赠', '2024-06-01', '市图书馆', 2);
  insertAct.run('海滩清洁行动', '2024-08-15', '金沙湾海滩', 4);
  insertAct.run('暖冬衣物募集', '2024-11-20', '公司大厅', 2);
  insertAct.run('春运志愿服务', '2025-01-18', '火车站', 5);

  // 志愿者（姓名+手机号）
  const insertVol = db.prepare('INSERT INTO volunteers (name, phone, department, total_stamps, total_hours) VALUES (?, ?, ?, ?, ?)');
  insertVol.run('张三', '13800001111', '技术部', 5, 13);
  insertVol.run('李四', '13800002222', '市场部', 3, 10);
  insertVol.run('王五', '13800003333', '财务部', 1, 2);
  insertVol.run('赵六', '13800004444', '人力部', 2, 7);

  // 印章记录
  const insertRec = db.prepare('INSERT INTO stamp_records (volunteer_id, activity_id, hours, date, source, status, note) VALUES (?, ?, ?, ?, ?, ?, ?)');
  // 张三 5枚
  insertRec.run(1, 1, 3, '2024-03-12', 'admin', 'approved', '');
  insertRec.run(1, 2, 2, '2024-05-18', 'admin', 'approved', '');
  insertRec.run(1, 3, 2, '2024-06-01', 'admin', 'approved', '');
  insertRec.run(1, 4, 4, '2024-08-15', 'admin', 'approved', '');
  insertRec.run(1, 5, 2, '2024-11-20', 'admin', 'approved', '');
  // 李四 3枚
  insertRec.run(2, 1, 3, '2024-03-12', 'admin', 'approved', '');
  insertRec.run(2, 2, 2, '2024-05-18', 'admin', 'approved', '');
  insertRec.run(2, 6, 5, '2025-01-18', 'admin', 'approved', '');
  // 王五 1枚 + 1条待审核
  insertRec.run(3, 3, 2, '2024-06-01', 'admin', 'approved', '');
  insertRec.run(3, 4, 4, '2024-08-15', 'self', 'pending', '我也参加了海滩清洁');
  // 赵六 2枚
  insertRec.run(4, 5, 2, '2024-11-20', 'admin', 'approved', '');
  insertRec.run(4, 6, 5, '2025-01-18', 'admin', 'approved', '');

  console.log('✅ 演示数据已插入');
} else {
  console.log('ℹ️ 数据库已有数据，跳过演示数据插入');
}
