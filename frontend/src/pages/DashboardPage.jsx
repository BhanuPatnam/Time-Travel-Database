import React, { useState, useEffect } from 'react';
import { 
  Database, History, Flag, HardDrive, Zap, CheckCircle2, 
  AlertTriangle, RefreshCw, ArrowUpRight, Plus, Edit2, Trash2, 
  Search, Eye, Clock, Sparkles, X, ShieldAlert, ArrowRight,
  UserPlus, ShoppingBag, ShoppingCart, Users, GitBranch, GitCommit, RotateCcw
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip 
} from 'recharts';
import apiService from '../services/api';

export default function DashboardPage({ onNavigate, onSelectRecord }) {
  // Stats and overview states
  const [stats, setStats] = useState(null);
  const [tables, setTables] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Database CRUD management states
  const [selectedTable, setSelectedTable] = useState('CUSTOMERS');
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Branch & Commit Context states
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [branchCommits, setBranchCommits] = useState([]);
  const [selectedCommitId, setSelectedCommitId] = useState('__HEAD__');
  const [branchRecordsAll, setBranchRecordsAll] = useState([]);
  const isViewingBranchSnapshot = selectedBranch !== 'main' || selectedCommitId !== '__HEAD__';

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTableTarget, setAddTableTarget] = useState('CUSTOMERS');
  const [editRecord, setEditRecord] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Action toast / feedback banner
  const [actionFeedback, setActionFeedback] = useState(null);

  // Reference lookups for FK dropdowns & multi-product order builder
  const [allCustomers, setAllCustomers] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [allOrderItems, setAllOrderItems] = useState([]);
  const [orderItemsDraft, setOrderItemsDraft] = useState([
    { product_id: 201, quantity: 1 },
    { product_id: 202, quantity: 1 }
  ]);

  // 1. Fetch system-wide metrics and checkpoint telemetry
  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const [storageData, tablesData, cpData, decData, branchList, custList, prodList, itemList] = await Promise.all([
        apiService.getStorageStats(),
        apiService.getTables(),
        apiService.getCheckpoints(),
        apiService.getPolicyDecisions(),
        apiService.getBranches().catch(() => []),
        apiService.getTableRecords('CUSTOMERS').catch(() => []),
        apiService.getTableRecords('PRODUCTS').catch(() => []),
        apiService.getTableRecords('ORDER_ITEMS').catch(() => []),
      ]);
      setStats(storageData);
      setTables(tablesData);
      setCheckpoints(cpData.slice(0, 5));
      setDecisions(decData.slice(0, 5));
      setBranches(branchList || []);
      setAllCustomers(custList || []);
      setAllProducts(prodList || []);
      setAllOrderItems(itemList || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch records for the currently selected table (and branch/commit if selected)
  const fetchRecords = async () => {
    setRecordsLoading(true);
    try {
      if (!isViewingBranchSnapshot) {
        const data = await apiService.getTableRecords(selectedTable, searchTerm);
        setRecords(data || []);
      } else {
        const cid = selectedCommitId === '__HEAD__' ? null : selectedCommitId;
        const stateRes = await apiService.getBranchState(selectedBranch, '__ALL__', cid);
        const allRows = stateRes?.records || [];
        setBranchRecordsAll(allRows);
        let filtered = allRows.filter(r => (r._table || 'CUSTOMERS') === selectedTable);
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          filtered = filtered.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
        }
        setRecords(filtered);
      }
    } catch (err) {
      console.error('Failed to load records for table ' + selectedTable, err);
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      apiService.getBranchCommits(selectedBranch)
        .then(data => setBranchCommits(data || []))
        .catch(() => setBranchCommits([]));
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchRecords();
  }, [selectedTable, selectedBranch, selectedCommitId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRecords();
  };

  // Helper to extract primary key
  const getPkValue = (row) => {
    if (!row) return null;
    return row.customer_id || row.product_id || row.order_id || row.item_id || Object.values(row)[0];
  };

  const getPkField = (tableName) => {
    if (tableName === 'CUSTOMERS') return 'customer_id';
    if (tableName === 'PRODUCTS') return 'product_id';
    if (tableName === 'ORDER_ITEMS') return 'item_id';
    return 'order_id';
  };

  // --- CRUD ACTIONS ---

  // Open Add Modal
  const handleOpenAdd = (table = selectedTable) => {
    setAddTableTarget(table);
    if (table === 'CUSTOMERS') {
      setFormData({
        name: '',
        email: '',
        phone: '+1-555-0188',
        status: 'ACTIVE',
        credit_limit: '50000.00',
      });
    } else if (table === 'PRODUCTS') {
      setFormData({
        sku: 'SKU-PROD-' + Math.floor(100 + Math.random() * 900),
        name: '',
        category: 'Hardware',
        unit_price: '2499.00',
        stock_quantity: '30',
      });
    } else if (table === 'ORDERS') {
      const firstCustId = allCustomers[0]?.customer_id || 101;
      const firstProdId = allProducts[0]?.product_id || 201;
      const secondProdId = allProducts[1]?.product_id || firstProdId;
      setOrderItemsDraft([
        { product_id: firstProdId, quantity: 1 },
        { product_id: secondProdId, quantity: 1 }
      ]);
      setFormData({
        customer_id: String(firstCustId),
        status: 'PENDING',
        notes: 'Multi-product enterprise order',
      });
    } else if (table === 'ORDER_ITEMS') {
      setFormData({
        order_id: '501',
        product_id: String(allProducts[0]?.product_id || 201),
        quantity: '1',
      });
    }
    setShowAddModal(true);
  };

  // Submit Add Record
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = addTableTarget === 'ORDERS'
        ? {
            ...formData,
            customer_id: Number(formData.customer_id),
            items: orderItemsDraft.map(it => ({
              product_id: Number(it.product_id),
              quantity: Number(it.quantity)
            }))
          }
        : formData;
      const res = await apiService.createRecord(addTableTarget, payload);
      setShowAddModal(false);
      setActionFeedback({
        type: 'SUCCESS',
        action: 'INSERT',
        message: `Created new ${addTableTarget} entry #${res.record_pk || 'new'}. Auditable change logged atomically to TT_CHANGE_LOG!`,
        table: addTableTarget,
        pk: res.record_pk,
        timestamp: new Date().toISOString(),
      });
      // Refresh current table if matches, and refresh dashboard stats
      if (selectedTable === addTableTarget) {
        fetchRecords();
      } else {
        setSelectedTable(addTableTarget);
      }
      fetchDashboardStats();
    } catch (err) {
      alert('Failed to insert record: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (row) => {
    setEditRecord(row);
    setFormData({ ...row });
  };

  // Submit Edit Record
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const pk = getPkValue(editRecord);
    try {
      const res = await apiService.updateRecord(selectedTable, pk, formData);
      setEditRecord(null);
      setActionFeedback({
        type: 'SUCCESS',
        action: 'UPDATE',
        message: `Updated ${selectedTable} record #${pk}. History trigger logged JSON delta before & after values!`,
        table: selectedTable,
        pk: pk,
        timestamp: new Date().toISOString(),
      });
      fetchRecords();
      fetchDashboardStats();
    } catch (err) {
      alert('Failed to update record: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Delete Record
  const handleDeleteSubmit = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    const pk = getPkValue(deleteTarget);
    try {
      await apiService.deleteRecord(selectedTable, pk);
      setDeleteTarget(null);
      setActionFeedback({
        type: 'WARNING',
        action: 'DELETE',
        message: `Deleted ${selectedTable} #${pk}. A tombstone DELETE event was captured in history. You can time-travel back to view it!`,
        table: selectedTable,
        pk: pk,
        timestamp: new Date().toISOString(),
      });
      fetchRecords();
      fetchDashboardStats();
    } catch (err) {
      alert('Failed to delete record: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to reliably retrieve row count for any table
  const getTableCount = (tblName) => {
    if (isViewingBranchSnapshot) {
      return branchRecordsAll.filter(r => (r._table || 'CUSTOMERS') === tblName).length;
    }
    if (selectedTable === tblName && Array.isArray(records) && !recordsLoading && !searchTerm.trim()) {
      return records.length;
    }
    const found = tables.find(t => (t.name === tblName || t.table_name === tblName));
    return found ? (found.row_count ?? 0) : 0;
  };

  const customersCount = getTableCount('CUSTOMERS');
  const productsCount = getTableCount('PRODUCTS');
  const ordersCount = getTableCount('ORDERS');
  const totalCurrentRows = isViewingBranchSnapshot
    ? (customersCount + productsCount + ordersCount)
    : ((tables && tables.length > 0)
        ? tables.reduce((acc, t) => acc + (t.row_count || 0), 0)
        : (customersCount + productsCount + ordersCount));

  const pieData = stats ? [
    { name: 'Current Data', value: stats.current_data_bytes || 4096, color: '#38bdf8' },
    { name: 'History Change Log', value: stats.history_log_bytes || 8192, color: '#818cf8' },
    { name: 'Checkpoints', value: stats.checkpoint_bytes || 12288, color: '#c084fc' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold text-[#202833] tracking-tight">Database Operations &amp; Time Travel Hub</h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">
              Live Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time CRUD with atomic temporal change capture, adaptive checkpointing, and historical replay
          </p>
        </div>

        {/* Quick Operations Button Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleOpenAdd('CUSTOMERS')}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>

          <button
            onClick={() => handleOpenAdd('PRODUCTS')}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>

          <button
            onClick={() => handleOpenAdd('ORDERS')}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Add Order</span>
          </button>

          <button
            onClick={() => {
              fetchDashboardStats();
              fetchRecords();
            }}
            disabled={loading || recordsLoading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
            title="Refresh All Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || recordsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 1.5. Branch & Commit Context Selector Bar */}
      <div className="content-panel p-3.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <GitBranch className="w-4 h-4 text-[#4263A5]" />
            <span className="font-semibold text-[#202833]">Database Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setSelectedCommitId('__HEAD__');
              }}
              className="px-2.5 py-1.5 bg-[#F7F8FA] border border-[#E2E6EC] rounded-lg text-xs font-semibold text-[#202833] focus:border-[#4263A5] outline-none cursor-pointer"
            >
              {branches.length === 0 ? (
                <option value="main">main (default)</option>
              ) : (
                branches.map(b => (
                  <option key={b.branch_id} value={b.branch_name}>
                    {b.branch_name} {b.is_default === 'Y' ? '(default)' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <GitCommit className="w-4 h-4 text-[#D97706]" />
            <span className="font-semibold text-[#202833]">Commit:</span>
            <select
              value={selectedCommitId}
              onChange={(e) => setSelectedCommitId(e.target.value)}
              className="px-2.5 py-1.5 bg-[#F7F8FA] border border-[#E2E6EC] rounded-lg text-xs font-mono text-[#202833] focus:border-[#4263A5] outline-none cursor-pointer max-w-[260px]"
            >
              <option value="__HEAD__">HEAD (Latest on {selectedBranch})</option>
              {branchCommits.map(c => (
                <option key={c.commit_id} value={c.commit_id}>
                  {c.commit_id} — {c.commit_message.substring(0, 35)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isViewingBranchSnapshot && (
            <button
              onClick={() => {
                setSelectedBranch('main');
                setSelectedCommitId('__HEAD__');
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-[#FEF3D6] hover:bg-[#FDE68A] border border-[#FEE3A2] text-[#B06000] rounded-lg text-xs font-semibold cursor-pointer transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Live Main</span>
            </button>
          )}
          <button
            onClick={() => onNavigate('branching')}
            className="flex items-center space-x-1 px-3 py-1.5 bg-[#EDF3FC] hover:bg-[#DCE7F9] border border-[#D0E0F6] text-[#4263A5] rounded-lg text-xs font-semibold cursor-pointer transition"
          >
            <span>Open Temporal Branches</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Feedback Banner (Visible after Add / Update / Delete) */}
      {actionFeedback && (
        <div className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          actionFeedback.action === 'DELETE'
            ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
            : actionFeedback.action === 'UPDATE'
            ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-200'
            : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
        }`}>
          <div className="flex items-start space-x-3">
            <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
              actionFeedback.action === 'DELETE' ? 'bg-rose-900/60 text-rose-300' :
              actionFeedback.action === 'UPDATE' ? 'bg-indigo-900/60 text-indigo-300' :
              'bg-emerald-900/60 text-emerald-300'
            }`}>
              {actionFeedback.action === 'DELETE' ? <ShieldAlert className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/30 font-mono">
                  {actionFeedback.action} EVENT LOGGED
                </span>
                <span className="text-[11px] opacity-75">
                  Table: <span className="font-semibold text-white">{actionFeedback.table}</span> &bull; PK: <span className="font-semibold text-white">{actionFeedback.pk}</span>
                </span>
              </div>
              <p className="text-xs mt-1 text-slate-200">
                {actionFeedback.message}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {onSelectRecord && actionFeedback.pk && (
              <>
                <button
                  onClick={() => onSelectRecord('timeline', actionFeedback.table, String(actionFeedback.pk))}
                  className="px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-xs font-medium border border-white/10 text-white flex items-center space-x-1 cursor-pointer transition"
                >
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  <span>View Timeline</span>
                </button>
                <button
                  onClick={() => onSelectRecord('timetravel', actionFeedback.table, String(actionFeedback.pk))}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-xs font-medium text-white flex items-center space-x-1 cursor-pointer transition"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Time Travel</span>
                </button>
              </>
            )}
            <button
              onClick={() => setActionFeedback(null)}
              className="p-1.5 rounded-lg hover:bg-black/30 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Entity Tables Overview Section (CUSTOMERS, PRODUCTS, ORDERS & TOTAL ROWS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Relational Business Tables Overview
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {totalCurrentRows} total live entries
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Customers Count Card */}
          <button
            onClick={() => setSelectedTable('CUSTOMERS')}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer glass-panel-hover ${
              selectedTable === 'CUSTOMERS'
                ? 'bg-sky-950/30 border-sky-500/50 shadow-md shadow-sky-900/20'
                : 'glass-panel border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">CUSTOMERS</span>
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[#202833] font-mono">
              {loading ? '...' : customersCount.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>Active client accounts</span>
              <span className="text-sky-400 font-medium hover:underline text-[10px]">View table &rarr;</span>
            </div>
          </button>

          {/* Products Count Card */}
          <button
            onClick={() => setSelectedTable('PRODUCTS')}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer glass-panel-hover ${
              selectedTable === 'PRODUCTS'
                ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md shadow-indigo-900/20'
                : 'glass-panel border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">PRODUCTS</span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[#202833] font-mono">
              {loading ? '...' : productsCount.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>Catalog inventory items</span>
              <span className="text-indigo-400 font-medium hover:underline text-[10px]">View table &rarr;</span>
            </div>
          </button>

          {/* Orders Count Card */}
          <button
            onClick={() => setSelectedTable('ORDERS')}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer glass-panel-hover ${
              selectedTable === 'ORDERS'
                ? 'bg-purple-950/30 border-purple-500/50 shadow-md shadow-purple-900/20'
                : 'glass-panel border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">ORDERS</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[#202833] font-mono">
              {loading ? '...' : ordersCount.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>Customer purchase orders</span>
              <span className="text-purple-400 font-medium hover:underline text-[10px]">View table &rarr;</span>
            </div>
          </button>

          {/* Total Current Rows Card */}
          <div className="glass-panel p-4 rounded-2xl glass-panel-hover border border-slate-800">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">TOTAL ACTIVE ROWS</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[#202833] font-mono">
              {loading ? '...' : totalCurrentRows.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>Across all business schemas</span>
              <span className="text-emerald-400 font-mono text-[10px]">Live OLTP</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Temporal Engine & Performance Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl glass-panel-hover">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Historical Changes</span>
            <History className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#202833] font-mono">
            {loading ? '...' : (stats?.total_changes || 0).toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Immutable audit entries logged in TT_CHANGE_LOG</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl glass-panel-hover">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Materialized Checkpoints</span>
            <Flag className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#202833] font-mono">
            {loading ? '...' : (stats?.total_checkpoints || 0).toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Consistent boundaries materialized</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl glass-panel-hover">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Storage Consumed</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#202833] font-mono">
            {loading ? '...' : `${((stats?.total_bytes || 0) / 1024).toFixed(1)} KB`}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Budget: {stats?.budget_mb || 250} MB ({stats?.usage_percentage || 0}%)
          </p>
        </div>
      </div>

      {/* 4. MAIN INTERACTIVE DASHBOARD SECTION: Database Operations & Record Management */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
        {/* Sub-Header & Table Switcher */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <h3 className="text-base font-semibold text-[#202833]">Database Records &amp; Live DML Operations</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Add new entries, update attributes, or delete rows. Every DML operation is automatically captured in <code className="text-indigo-300">TT_CHANGE_LOG</code>.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleOpenAdd(selectedTable)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Entry to {selectedTable}</span>
            </button>
          </div>
        </div>

        {/* Table Selector Tabs & Filter Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Table Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0">
            {['CUSTOMERS', 'PRODUCTS', 'ORDERS', 'ORDER_ITEMS'].map((tbl) => {
              const count = getTableCount(tbl);
              const isActive = selectedTable === tbl;
              return (
                <button
                  key={tbl}
                  onClick={() => setSelectedTable(tbl)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer border ${
                    isActive
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200 shadow-inner'
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span>{tbl}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                    isActive ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search ${selectedTable}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#4263A5] w-48 md:w-64"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              Filter
            </button>
          </form>
        </div>

        {/* Live Records Table */}
        <div className="overflow-x-auto">
          {recordsLoading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
              <span>Fetching live table rows from database...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <Database className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-slate-300">No records found in {selectedTable}</p>
              <p className="text-slate-500 mt-1">Add an entry using the button above to begin tracking historical changes.</p>
              <button
                onClick={() => handleOpenAdd(selectedTable)}
                className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
              >
                + Add First Entry
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/70 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Primary Key</th>
                  {selectedTable === 'CUSTOMERS' && (
                    <>
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Credit Limit</th>
                    </>
                  )}
                  {selectedTable === 'PRODUCTS' && (
                    <>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Unit Price</th>
                      <th className="py-3 px-4">Stock</th>
                    </>
                  )}
                  {selectedTable === 'ORDERS' && (
                    <>
                      <th className="py-3 px-4">Customer (FK)</th>
                      <th className="py-3 px-4">Products (Line Items)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Notes</th>
                    </>
                  )}
                  {selectedTable === 'ORDER_ITEMS' && (
                    <>
                      <th className="py-3 px-4">Order ID (FK)</th>
                      <th className="py-3 px-4">Product (FK)</th>
                      <th className="py-3 px-4">Quantity</th>
                      <th className="py-3 px-4">Unit Price</th>
                      <th className="py-3 px-4">Subtotal</th>
                    </>
                  )}
                  <th className="py-3 px-4 text-right">Database Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {records.map((row, idx) => {
                  const pk = getPkValue(row);
                  return (
                    <tr 
                      key={pk || idx} 
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Primary Key */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-indigo-300 font-semibold">
                          #{pk}
                        </span>
                      </td>

                      {/* CUSTOMERS Row */}
                      {selectedTable === 'CUSTOMERS' && (
                        <>
                          <td className="py-3 px-4 font-semibold text-[#202833]">{row.name}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{row.email}</td>
                          <td className="py-3 px-4 text-slate-400">{row.phone || '-'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              row.status === 'ACTIVE'
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                                : row.status === 'VIP'
                                ? 'bg-purple-950/60 text-purple-300 border-purple-800/50'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-200">
                            ${Number(row.credit_limit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </>
                      )}

                      {/* PRODUCTS Row */}
                      {selectedTable === 'PRODUCTS' && (
                        <>
                          <td className="py-3 px-4 font-mono text-xs text-amber-300">{row.sku}</td>
                          <td className="py-3 px-4 font-semibold text-[#202833]">{row.name}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                              {row.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-200">
                            ${Number(row.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <span className={Number(row.stock_quantity) < 10 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                              {row.stock_quantity}
                            </span>
                          </td>
                        </>
                      )}

                      {/* ORDERS Row */}
                      {selectedTable === 'ORDERS' && (() => {
                        const cust = allCustomers.find(c => Number(c.customer_id) === Number(row.customer_id));
                        const lineItems = allOrderItems.filter(it => Number(it.order_id) === Number(row.order_id));
                        return (
                          <>
                            <td className="py-3 px-4 text-xs">
                              <span className="font-mono text-[#4263A5] font-semibold">#{row.customer_id}</span>
                              {cust && <span className="ml-1.5 text-[#687386]">{cust.name}</span>}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {lineItems.length > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-[#EDF3FC] text-[#4263A5] border border-[#D0E0F6] font-medium text-[11px]">
                                  {lineItems.length} {lineItems.length === 1 ? 'product' : 'products'} (
                                  {lineItems.map(it => `#${it.product_id}×${it.quantity}`).join(', ')})
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">No line items</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                row.status === 'COMPLETED' || row.status === 'DELIVERED'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                                  : row.status === 'PENDING'
                                  ? 'bg-amber-950/60 text-amber-300 border-amber-800/50'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-200">
                              ${Number(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-slate-400 truncate max-w-xs">{row.notes || '-'}</td>
                          </>
                        );
                      })()}

                      {/* ORDER_ITEMS Row */}
                      {selectedTable === 'ORDER_ITEMS' && (() => {
                        const prod = allProducts.find(p => Number(p.product_id) === Number(row.product_id));
                        return (
                          <>
                            <td className="py-3 px-4 font-mono text-[#4263A5] font-semibold">
                              Order #{row.order_id}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <span className="font-mono text-[#0D8A5B] font-semibold">#{row.product_id}</span>
                              {prod && <span className="ml-1.5 text-[#202833] font-medium">{prod.name}</span>}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold">{row.quantity}</td>
                            <td className="py-3 px-4 font-mono">
                              ${Number(row.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold text-[#202833]">
                              ${Number(row.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </>
                        );
                      })()}

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Update / Edit */}
                          <button
                            onClick={() => handleOpenEdit(row)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition cursor-pointer"
                            title="Update record in database"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(row)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
                            title="Delete record (triggers temporal tombstone)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Inspect / Time Travel */}
                          {onSelectRecord && (
                            <>
                              <button
                                onClick={() => onSelectRecord('timeline', selectedTable, String(pk))}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                                title="Inspect version timeline"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onSelectRecord('timetravel', selectedTable, String(pk))}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 transition cursor-pointer"
                                title="Time travel to reconstruct past state"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Row-level auditing active: INSERT, UPDATE, and DELETE operations automatically write to <code className="text-slate-300 font-mono">TT_CHANGE_LOG</code>.</span>
          </div>
          <button
            onClick={() => onNavigate && onNavigate('data')}
            className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1 cursor-pointer"
          >
            <span>Open Dedicated Data Explorer</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </div>

      {/* 5. Telemetry & Analytics Grid: Storage breakdown & Recent Checkpoints & Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Storage Chart */}
        <div className="glass-panel p-5 rounded-2xl">
          <h3 className="text-sm font-semibold text-[#202833] mb-1">Storage Allocation</h3>
          <p className="text-xs text-slate-400 mb-3">Byte footprint across current data vs history</p>
          <div className="h-44 flex items-center justify-center">
            {loading ? (
              <div className="text-slate-500 text-xs">Loading chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={46}
                    outerRadius={68}
                    paddingAngle={4}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val) => [`${(val / 1024).toFixed(2)} KB`, 'Size']}
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E6EC', color: '#202833', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center space-x-2 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </span>
                <span className="font-mono text-slate-400">{(item.value / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        </div>

        {/* Checkpoint Feed */}
        <div className="glass-panel p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#202833]">Recent Checkpoints</h3>
              <p className="text-xs text-slate-400">Consistent boundaries materialized</p>
            </div>
            <button
              onClick={() => onNavigate('checkpoints')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center cursor-pointer"
            >
              <span>Manage</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            {checkpoints.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No checkpoints recorded yet.</p>
            ) : (
              checkpoints.map((cp) => (
                <div key={cp.checkpoint_id} className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{cp.checkpoint_name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[10px] font-medium">
                      {cp.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{cp.table_name} &bull; {cp.row_count} rows</span>
                    <span className="font-mono">{(cp.storage_bytes / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Adaptive Policy Decisions */}
        <div className="glass-panel p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#202833]">Adaptive Decisions</h3>
              <p className="text-xs text-slate-400">Workload cost evaluation history</p>
            </div>
            <button
              onClick={() => onNavigate('checkpoints')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center cursor-pointer"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            {decisions.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No policy evaluations yet.</p>
            ) : (
              decisions.map((d) => {
                const isCreated = d.action_taken === 'CHECKPOINT_CREATED';
                return (
                  <div key={d.decision_id} className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200">{d.table_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isCreated 
                          ? 'bg-purple-950/60 text-purple-300 border-purple-800/40' 
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {d.action_taken}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                      {d.decision_reason}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD RECORD TO DATABASE                                             */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700 p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-[#202833] hover:bg-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 text-indigo-400 mb-1">
              <Plus className="w-5 h-5" />
              <h3 className="text-lg font-bold text-[#202833]">Add New Entry to {addTableTarget}</h3>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Insert a new row into the table. The Oracle trigger will automatically log an auditable <code className="text-indigo-300 font-mono">INSERT</code> event.
            </p>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Fields for CUSTOMERS */}
              {addTableTarget === 'CUSTOMERS' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Customer Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Athena Dynamics Corp"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="ops@athena.com"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                      <input
                        type="text"
                        placeholder="+1-555-0188"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                      <select
                        value={formData.status || 'ACTIVE'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="VIP">VIP</option>
                        <option value="PENDING">PENDING</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Credit Limit ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="50000.00"
                        value={formData.credit_limit || ''}
                        onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Fields for PRODUCTS */}
              {addTableTarget === 'PRODUCTS' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-slate-300 mb-1">SKU *</label>
                      <input
                        type="text"
                        required
                        value={formData.sku || ''}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-amber-300 font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">Product Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Quantum Accelerator Unit"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                    <select
                      value={formData.category || 'Hardware'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Hardware">Hardware</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Sensors">Sensors</option>
                      <option value="Accessories">Accessories</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Unit Price ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.unit_price || ''}
                        onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Initial Stock Quantity *</label>
                      <input
                        type="number"
                        required
                        value={formData.stock_quantity || ''}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Fields for ORDERS (1 Customer + Multiple Products) */}
              {addTableTarget === 'ORDERS' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Customer (Referenced FK) *</label>
                      <select
                        required
                        value={formData.customer_id || '101'}
                        onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {allCustomers.map(c => (
                          <option key={c.customer_id} value={c.customer_id}>
                            #{c.customer_id} — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                      <select
                        value={formData.status || 'PENDING'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PROCESSING">PROCESSING</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                  </div>

                  {/* Multi-Product Line Items Builder */}
                  <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E2E6EC] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#202833]">
                        Order Products (Multiple Line Items)
                      </span>
                      <button
                        type="button"
                        onClick={() => setOrderItemsDraft(prev => [
                          ...prev,
                          { product_id: allProducts[0]?.product_id || 201, quantity: 1 }
                        ])}
                        className="px-2 py-1 rounded bg-[#4263A5] text-white text-[11px] font-semibold cursor-pointer hover:bg-[#345188]"
                      >
                        + Add Product
                      </button>
                    </div>

                    <div className="space-y-2 max-h-44 overflow-y-auto">
                      {orderItemsDraft.map((item, idx) => {
                        const prod = allProducts.find(p => Number(p.product_id) === Number(item.product_id));
                        const lineSubtotal = (Number(prod?.unit_price || 0)) * Number(item.quantity || 0);
                        return (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <select
                              value={item.product_id}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setOrderItemsDraft(prev => prev.map((it, i) => i === idx ? { ...it, product_id: val } : it));
                              }}
                              className="col-span-6 px-2 py-1.5 rounded border border-[#E2E6EC] bg-[#FFFFFF] text-xs text-[#202833]"
                            >
                              {allProducts.map(p => (
                                <option key={p.product_id} value={p.product_id}>
                                  #{p.product_id} {p.name} (${p.unit_price})
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value));
                                setOrderItemsDraft(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it));
                              }}
                              className="col-span-2 px-2 py-1.5 rounded border border-[#E2E6EC] bg-[#FFFFFF] text-xs font-mono text-[#202833]"
                              title="Quantity"
                            />
                            <span className="col-span-3 text-right font-mono text-xs font-semibold text-[#0D8A5B]">
                              ${lineSubtotal.toLocaleString()}
                            </span>
                            <button
                              type="button"
                              disabled={orderItemsDraft.length <= 1}
                              onClick={() => setOrderItemsDraft(prev => prev.filter((_, i) => i !== idx))}
                              className="col-span-1 text-center text-[#C5221F] disabled:opacity-30 cursor-pointer font-bold"
                              title="Remove product"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-[#E2E6EC] flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#687386]">Auto-Calculated Order Total:</span>
                      <span className="font-mono font-bold text-[#202833] text-sm">
                        ${orderItemsDraft.reduce((sum, it) => {
                          const p = allProducts.find(pr => Number(pr.product_id) === Number(it.product_id));
                          return sum + (Number(p?.unit_price || 0) * Number(it.quantity || 0));
                        }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Order Notes / Memo</label>
                    <textarea
                      rows={2}
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      placeholder="Add special instructions or delivery details..."
                    />
                  </div>
                </>
              )}

              {/* Fields for ORDER_ITEMS */}
              {addTableTarget === 'ORDER_ITEMS' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Order ID (FK) *</label>
                    <input
                      type="number"
                      required
                      value={formData.order_id || '501'}
                      onChange={(e) => setFormData({ ...formData, order_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Product (FK) *</label>
                    <select
                      value={formData.product_id || '201'}
                      onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
                    >
                      {allProducts.map(p => (
                        <option key={p.product_id} value={p.product_id}>
                          #{p.product_id} {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.quantity || '1'}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Writing to Oracle...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Commit Insert</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: UPDATE RECORD IN DATABASE                                          */}
      {/* ========================================================================= */}
      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700 p-6 shadow-2xl relative">
            <button 
              onClick={() => setEditRecord(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 text-indigo-400 mb-1">
              <Edit2 className="w-5 h-5" />
              <h3 className="text-lg font-bold text-[#202833]">Update {selectedTable} #{getPkValue(editRecord)}</h3>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Modifying these fields will trigger the database temporal trigger to capture old vs new JSON states into <code className="text-indigo-300 font-mono">TT_CHANGE_LOG</code>.
            </p>

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              {/* Fields for CUSTOMERS */}
              {selectedTable === 'CUSTOMERS' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Customer Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Phone</label>
                      <input
                        type="text"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                      <select
                        value={formData.status || 'ACTIVE'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="VIP">VIP</option>
                        <option value="PENDING">PENDING</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Credit Limit ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.credit_limit || ''}
                        onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Fields for PRODUCTS */}
              {selectedTable === 'PRODUCTS' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Product Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                      <input
                        type="text"
                        value={formData.category || ''}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Unit Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.unit_price || ''}
                        onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Stock Quantity</label>
                      <input
                        type="number"
                        required
                        value={formData.stock_quantity || ''}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Fields for ORDERS */}
              {selectedTable === 'ORDERS' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                      <select
                        value={formData.status || 'PENDING'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PROCESSING">PROCESSING</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Total Amount ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.total_amount || ''}
                        onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                    <textarea
                      rows={2}
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Database...</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION                                                */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-rose-800/60 p-6 shadow-2xl relative">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800/60">
                <ShieldAlert className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#202833]">Confirm Temporal Deletion</h3>
                <p className="text-xs text-slate-400">Auditable tombstone event</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Are you sure you want to delete <span className="font-semibold text-[#202833]">{selectedTable} #{getPkValue(deleteTarget)}</span>?
            </p>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 space-y-1 mb-5">
              <div className="flex items-center space-x-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Time Travel Safety Guarantee:</span>
              </div>
              <p>
                This row will be removed from the active table, but its full prior state is permanently preserved in <code className="text-slate-300 font-mono">TT_CHANGE_LOG</code>. You can reconstruct and inspect it at any prior timestamp.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteSubmit}
                className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 transition cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Record</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
