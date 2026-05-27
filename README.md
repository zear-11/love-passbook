# 📖 公益部爱心存折

电子存折系统，用于记录集团各地志愿者参与公益活动的志愿章，支持自录入、审核、批量录入和礼品兑换。

## 功能

- **志愿者端**：查询存折、自录入志愿章（待审核）、满6章兑换礼品
- **管理后台**：审核自录入、批量录入新活动、新增活动、数据管理
- **兑换流程**：满6枚志愿章可兑换精美礼品，带礼花动画

## 快速开始

```bash
# 安装依赖
npm install

# 初始化数据库（含演示数据）
npm run init-db

# 启动服务
npm start

# 访问 http://localhost:3000
```

## 默认管理员

| 项目 | 值 |
|------|-----|
| 姓名 | 管理员 |
| 电话 | 13800000000 |
| 密码 | admin123 |

> ⚠️ 请登录后尽快修改密码

## 演示账号

| 姓名 | 工号 |
|------|------|
| 张三 | A001 |
| 李四 | A002 |
| 王五 | A003 |
| 赵六 | A004 |

## 数据库

使用 SQLite，数据文件位于 `data/passbook.db`。备份即拷贝该文件。

### 表结构

| 表 | 说明 | 年增量估算 |
|----|------|-----------|
| volunteers | 志愿者 | ~500 |
| activities | 公益活动 | ~30 |
| stamp_records | 印章记录 | ~5000 |
| admins | 管理员 | ~5 |
| redemptions | 兑换记录 | ~80 |

## 部署

### 服务器部署（推荐）

```bash
# 安装 Node.js 18+
# 克隆仓库
git clone https://github.com/你的用户名/love-passbook.git
cd love-passbook
npm install
npm run init-db

# 用 PM2 管理
npm install -g pm2
NODE_ENV=production pm2 start server/index.js --name love-passbook
pm2 startup && pm2 save
```

### nginx 配置

```nginx
server {
    listen 80;
    server_name 你的域名;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### HTTPS（推荐）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 数据库 | SQLite (better-sqlite3) |
| 前端 | 原生 HTML/CSS/JS |
| 认证 | express-session + bcryptjs |

## 项目结构

```
love-passbook/
├── server/
│   ├── index.js           # 入口
│   ├── db/
│   │   ├── schema.js      # 数据库Schema
│   │   └── init.js        # 初始化+演示数据
│   ├── routes/
│   │   ├── admin.js       # 管理员登录/密码
│   │   └── api.js         # 志愿者/活动/印章/兑换API
│   └── services/
│       └── volunteer.js   # 统计更新逻辑
├── public/
│   └── index.html         # 前端单页应用
├── data/                  # SQLite数据（gitignore）
├── package.json
└── README.md
```
