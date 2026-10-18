import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000,
});

export const apiService = {
  // Health
  getHealth: () => api.get('/health').then(res => res.data),
  getStatus: () => api.get('/status').then(res => res.data),

  // Current Tables & Data (CRUD / DML)
  getTables: () => api.get('/tables').then(res => res.data),
  getTableRecords: (tableName, search) => 
    api.get(`/tables/${tableName}/records`, { params: { search } }).then(res => res.data),
  getRecord: (tableName, recordPk) => 
    api.get(`/tables/${tableName}/records/${recordPk}`).then(res => res.data),
  createRecord: (tableName, data) =>
    api.post(`/tables/${tableName}/records`, data).then(res => res.data),
  updateRecord: (tableName, recordPk, data) =>
    api.put(`/tables/${tableName}/records/${recordPk}`, data).then(res => res.data),
  deleteRecord: (tableName, recordPk) =>
    api.delete(`/tables/${tableName}/records/${recordPk}`).then(res => res.data),

  // Time Travel Reconstruction
  reconstructRow: (tableName, recordPk, targetTimestamp, strategy = 'ADAPTIVE') =>
    api.post('/time-travel/row', {
      table_name: tableName,
      record_pk: recordPk,
      target_timestamp: targetTimestamp,
      strategy,
    }).then(res => res.data),

  reconstructTable: (tableName, targetTimestamp, strategy = 'ADAPTIVE') =>
    api.post('/time-travel/table', {
      table_name: tableName,
      target_timestamp: targetTimestamp,
      strategy,
    }).then(res => res.data),

  // Version Timeline
  getTimeline: (tableName, recordPk) =>
    api.get(`/timeline/${tableName}/${recordPk}`).then(res => res.data),

  // Historical Diff
  compareStates: (tableName, timestamp1, timestamp2) =>
    api.post('/diff', {
      table_name: tableName,
      timestamp_1: timestamp1,
      timestamp_2: timestamp2,
    }).then(res => res.data),

  // Checkpoints
  getCheckpoints: (tableName) =>
    api.get('/checkpoints', { params: { table_name: tableName } }).then(res => res.data),
  createCheckpoint: (tableName, strategy = 'MANUAL', reason = 'Dashboard request') =>
    api.post('/checkpoints', {
      table_name: tableName,
      strategy,
      reason,
    }).then(res => res.data),
  evaluateAdaptivePolicy: (tableName) =>
    api.post(`/checkpoints/evaluate-adaptive?table_name=${tableName}`).then(res => res.data),
  getPolicyDecisions: (tableName) =>
    api.get('/checkpoints/decisions', { params: { table_name: tableName } }).then(res => res.data),

  // Restoration
  previewRestore: (tableName, recordPk, targetTimestamp) =>
    api.post('/restore/preview', {
      table_name: tableName,
      record_pk: recordPk,
      target_timestamp: targetTimestamp,
    }).then(res => res.data),
  executeRestore: (tableName, recordPk, targetTimestamp, userNote, confirmAction = true) =>
    api.post('/restore/execute', {
      table_name: tableName,
      record_pk: recordPk,
      target_timestamp: targetTimestamp,
      user_note: userNote,
      confirm_action: confirmAction,
    }).then(res => res.data),

  // Benchmarks
  runBenchmark: (config) =>
    api.post('/benchmarks/run', config).then(res => res.data),
  getBenchmarkHistory: () =>
    api.get('/benchmarks/history').then(res => res.data),

  // Settings & Storage
  getSettings: () => api.get('/settings').then(res => res.data),
  updateSetting: (paramKey, paramValue) =>
    api.post('/settings', { param_key: paramKey, param_value: paramValue }).then(res => res.data),
  getStorageStats: () => api.get('/storage/stats').then(res => res.data),
};

export default apiService;
