# 📖 公益部爱心存折（飞书多维表格版）

数据存储在飞书多维表格，支持飞书工作台一键登录。

## 快速开始

```bash
npm install
npm start
# 访问 http://localhost:3000
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| FEISHU_APP_ID | 飞书应用ID | cli_aa9c0fff49f99cd2 |
| FEISHU_APP_SECRET | 飞书应用密钥 | 已内置 |
| BITABLE_APP_TOKEN | 多维表格App Token | E17lbWDcuazeiksQSDycnLZwnbe |
| TABLE_VOLUNTEERS | 志愿者表ID | tblprz63ICbhW9fH |
| TABLE_ACTIVITIES | 活动表ID | tbl49V0PsmVk6jZl |
| TABLE_STAMP_RECORDS | 印章记录表ID | tblEdAEZxywzcVFD |
| SESSION_SECRET | Session密钥 | 随机 |
| ADMIN_EMPLOYEE_IDS | 飞书管理员工号 | 空 |

## 管理后台

姓名: 管理员 | 电话: 13800000000 | 密码: admin123

## 飞书应用权限

- `contact:user.base:readonly` 获取姓名
- `contact:user.phone:readonly` 获取手机号
- `contact:user.department:readonly` 获取部门
- `bitable:app:readonly` 读多维表格
- `bitable:app` 写多维表格

## 部署

支持 Render / 服务器 / 任何 Node.js 环境。
