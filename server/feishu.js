const axios = require('axios');

const FEISHU_BASE = 'https://open.feishu.cn/open-apis';

// ===== 配置 =====
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_aa9c0fff49f99cd2';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || 'yrVIjOlWqAqHc5ItiL3YwglxxJ730t7q';
const BITABLE_APP_TOKEN = process.env.BITABLE_APP_TOKEN || 'E17lbWDcuazeiksQSDycnLZwnbe';
const TABLE_VOLUNTEERS = process.env.TABLE_VOLUNTEERS || 'tblprz63ICbhW9fH';
const TABLE_ACTIVITIES = process.env.TABLE_ACTIVITIES || 'tbl49V0PsmVk6jZl';
const TABLE_STAMP_RECORDS = process.env.TABLE_STAMP_RECORDS || 'tblEdAEZxywzcVFD';
const ADMIN_EMPLOYEE_IDS = (process.env.ADMIN_EMPLOYEE_IDS || '').split(',').filter(Boolean);

// ===== Token 缓存 =====
let tenantTokenCache = { token: null, expiresAt: 0 };
let appTokenCache = { token: null, expiresAt: 0 };
let jsapiTicketCache = { ticket: null, expiresAt: 0 };

async function getTenantAccessToken() {
  if (tenantTokenCache.token && Date.now() < tenantTokenCache.expiresAt) {
    return tenantTokenCache.token;
  }
  const res = await axios.post(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET,
  });
  if (res.data.code !== 0) throw new Error('获取tenant_access_token失败: ' + res.data.msg);
  tenantTokenCache = { token: res.data.tenant_access_token, expiresAt: Date.now() + (res.data.expire - 300) * 1000 };
  return tenantTokenCache.token;
}

async function getAppAccessToken() {
  if (appTokenCache.token && Date.now() < appTokenCache.expiresAt) {
    return appTokenCache.token;
  }
  const res = await axios.post(`${FEISHU_BASE}/auth/v3/app_access_token/internal`, {
    app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET,
  });
  if (res.data.code !== 0) throw new Error('获取app_access_token失败: ' + res.data.msg);
  appTokenCache = { token: res.data.app_access_token, expiresAt: Date.now() + (res.data.expire - 300) * 1000 };
  return appTokenCache.token;
}

async function getJsApiTicket() {
  if (jsapiTicketCache.ticket && Date.now() < jsapiTicketCache.expiresAt) {
    return jsapiTicketCache.ticket;
  }
  const token = await getTenantAccessToken();
  const res = await axios.get(`${FEISHU_BASE}/jssdk/ticket/get`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.data.code !== 0) throw new Error('获取jsapi_ticket失败: ' + res.data.msg);
  jsapiTicketCache = { ticket: res.data.data.ticket, expiresAt: Date.now() + (res.data.data.expire_in - 300) * 1000 };
  return jsapiTicketCache.ticket;
}

// ===== 用户认证 =====
async function getUserAccessToken(authCode) {
  const appToken = await getAppAccessToken();
  const res = await axios.post(`${FEISHU_BASE}/authen/v1/oidc/access_token`, {
    grant_type: 'authorization_code', code: authCode,
  }, { headers: { Authorization: `Bearer ${appToken}`, 'Content-Type': 'application/json' } });
  if (res.data.code !== 0) throw new Error('获取user_access_token失败: ' + res.data.msg);
  return res.data.data;
}

async function getUserInfo(userAccessToken) {
  const res = await axios.get(`${FEISHU_BASE}/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${userAccessToken}` },
  });
  if (res.data.code !== 0) throw new Error('获取用户信息失败: ' + res.data.msg);
  return res.data.data;
}

// ===== Bitable CRUD =====
async function bitableHeaders() {
  const token = await getTenantAccessToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function listRecords(tableId, options = {}) {
  const headers = await bitableHeaders();
  const params = {};
  if (options.filter) params.filter = options.filter;
  if (options.pageSize) params.page_size = options.pageSize;
  if (options.pageToken) params.page_token = options.pageToken;
  const res = await axios.get(`${FEISHU_BASE}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${tableId}/records`, { headers, params });
  if (res.data.code !== 0) throw new Error('查询失败: ' + res.data.msg);
  return res.data.data;
}

async function listAllRecords(tableId, options = {}) {
  let allItems = [];
  let pageToken = undefined;
  do {
    const result = await listRecords(tableId, { ...options, pageToken, pageSize: 500 });
    allItems = allItems.concat(result.items || []);
    pageToken = result.page_token;
  } while (pageToken);
  return allItems;
}

async function createRecord(tableId, fields) {
  const headers = await bitableHeaders();
  const res = await axios.post(`${FEISHU_BASE}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${tableId}/records`, { fields }, { headers });
  if (res.data.code !== 0) throw new Error('创建失败: ' + res.data.msg);
  return res.data.data.record;
}

async function batchCreateRecords(tableId, records) {
  if (records.length === 0) return [];
  const headers = await bitableHeaders();
  const res = await axios.post(`${FEISHU_BASE}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${tableId}/records/batch_create`, { records }, { headers });
  if (res.data.code !== 0) throw new Error('批量创建失败: ' + res.data.msg);
  return res.data.data.records || [];
}

async function updateRecord(tableId, recordId, fields) {
  const headers = await bitableHeaders();
  const res = await axios.put(`${FEISHU_BASE}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${tableId}/records/${recordId}`, { fields }, { headers });
  if (res.data.code !== 0) throw new Error('更新失败: ' + res.data.msg);
  return res.data.data.record;
}

async function deleteRecord(tableId, recordId) {
  const headers = await bitableHeaders();
  const res = await axios.delete(`${FEISHU_BASE}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${tableId}/records/${recordId}`, { headers });
  if (res.data.code !== 0) throw new Error('删除失败: ' + res.data.msg);
  return true;
}

module.exports = {
  FEISHU_APP_ID, BITABLE_APP_TOKEN, TABLE_VOLUNTEERS, TABLE_ACTIVITIES, TABLE_STAMP_RECORDS, ADMIN_EMPLOYEE_IDS,
  getTenantAccessToken, getJsApiTicket, getUserAccessToken, getUserInfo,
  listRecords, listAllRecords, createRecord, batchCreateRecords, updateRecord, deleteRecord,
};
