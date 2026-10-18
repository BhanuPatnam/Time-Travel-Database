import React, { useState, useEffect } from 'react';
import { 
  Database, Search, RefreshCw, Eye, History, GitCommit, 
  Plus, Edit2, Trash2, CheckCircle2, AlertCircle, X, Sparkles 
} from 'lucide-react';
import apiService from '../services/api';

export default function CurrentDataPage({ onSelectRecord }) {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('CUSTOMERS');
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Modals state
  const [activeRecord, setActiveRecord] = useState(null); // Inspect Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Form states
  const [formData, setFormData] = useState({});

  useEffect(() => {
    apiService.getTables().then(setTables).catch(console.error);
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await apiService.getTableRecords(selectedTable, searchTerm);
      setRecords(data);
    } catch (err) {
      console.error('Failed to load table records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    setFormData({});
  }, [selectedTable]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRecords();
  };

  const getPkValue = (row) => {
    return row.customer_id || row.product_id || row.order_id || Object.values(row)[0];
  };

  const getPkFieldName = () => {
    if (selectedTable === 'CUSTOMERS') return 'customer_id';
    if (selectedTable === 'PRODUCTS') return 'product_id';
    return 'order_id';
  };

  // --- CRUD HANDLERS ---
  const handleOpenAdd = () => {
    if (selectedTable === 'CUSTOMERS') {
      setFormData({ name: '', email: '', phone: '+1-555-0199', status: 'ACTIVE', credit_limit: '50000.00' });
    } else if (selectedTable === 'PRODUCTS') {
      setFormData({ sku: 'SKU-NEW-01', name: '', category: 'Hardware', unit_price: '1999.00', stock_quantity: '25' });
    } else if (selectedTable === 'ORDERS') {
      setFormData({ customer_id: '101', status: 'PENDING', total_amount: '1500.00', notes: 'New purchase order' });
    }
    setShowAddModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiService.createRecord(selectedTable, formData);
      setShowAddModal(false);
      setActionFeedback({
        type: 'SUCCESS',
        message: `Inserted new ${selectedTable} record #${res.record_pk || 'entry'}. Trigger automatically logged INSERT event in history!`,
        table: selectedTable,
        pk: res.record_pk
      });
      fetchRecords();
    } catch (err) {
      alert('Failed to insert record: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleOpenEdit = (row) => {
    setEditRecord(row);
    setFormData({ ...row });
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    const pk = getPkValue(editRecord);
    try {
      const res = await apiService.updateRecord(selectedTable, pk, formData);
      setEditRecord(null);
      setActionFeedback({
        type: 'SUCCESS',
        message: `Updated ${selectedTable} #${pk}. Column-level delta captured into TT_CHANGE_LOG!`,
        table: selectedTable,
        pk: String(pk)
      });
      fetchRecords();
    } catch (err) {
      alert('Failed to update record: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteTarget) return;
    const pk = getPkValue(deleteTarget);
    try {
      await apiService.deleteRecord(selectedTable, pk);
      setDeleteTarget(null);
      setActionFeedback({
        type: 'SUCCESS',
        message: `Deleted ${selectedTable} #${pk}. Historical DELETE event recorded; state can be reconstructed via Time Travel!`,
        table: selectedTable,
        pk: String(pk)
      });
      fetchRecords();
    } catch (err) {
      alert('Failed to delete record: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Table Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Current Data Explorer &amp; Live DML</h2>
          <p className="text-xs text-slate-400">
            Inspect, insert, update, and delete live rows. All mutations trigger atomic historical change-capture.
          </p>
        </div>

        {/* Table tabs */}
        <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          {['CUSTOMERS', 'PRODUCTS', 'ORDERS'].map((t) => (
            <button
              key={t}
              onClick={() => { setSelectedTable(t); setSearchTerm(''); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedTable === t
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionFeedback && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 text-xs text-indigo-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <p className="font-semibold text-white">{actionFeedback.message}</p>
              <p className="text-[11px] text-indigo-300">Auditable change log and commit sequences updated.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {actionFeedback.pk && (
              <>
                <button
                  onClick={() => onSelectRecord && onSelectRecord('timeline', actionFeedback.table, actionFeedback.pk)}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
                >
                  View in Timeline
                </button>
                <button
                  onClick={() => onSelectRecord && onSelectRecord('timetravel', actionFeedback.table, actionFeedback.pk)}
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition"
                >
                  Time Travel
                </button>
              </>
            )}
            <button 
              onClick={() => setActionFeedback(null)} 
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={`Search ${selectedTable}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </form>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add {selectedTable.slice(0, -1)}</span>
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                {records.length > 0 && Object.keys(records[0]).map((key) => (
                  <th key={key} className="px-4 py-3">{key.replace('_', ' ')}</th>
                ))}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    Loading {selectedTable} records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    No records found matching your query.
                  </td>
                </tr>
              ) : (
                records.map((row, idx) => {
                  const pk = getPkValue(row);
                  return (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      {Object.entries(row).map(([k, val]) => (
                        <td key={k} className="px-4 py-3 text-slate-300 font-mono text-[11px]">
                          {val !== null && typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Inspect */}
                          <button
                            onClick={() => setActiveRecord(row)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            title="Inspect JSON Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {/* Edit / Update */}
                          <button
                            onClick={() => handleOpenEdit(row)}
                            className="p-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/60 text-sky-300 border border-sky-800/40 transition"
                            title="Update Record (Fires UPDATE trigger)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(row)}
                            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition"
                            title="Delete Record (Fires DELETE trigger)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {/* Time Travel */}
                          <button
                            onClick={() => onSelectRecord && onSelectRecord('timetravel', selectedTable, pk)}
                            className="p-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/40 transition"
                            title="Time Travel"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          {/* Timeline */}
                          <button
                            onClick={() => onSelectRecord && onSelectRecord('timeline', selectedTable, pk)}
                            className="p-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 transition"
                            title="Version Timeline"
                          >
                            <GitCommit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-indigo-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Add Entry to {selectedTable}</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              {selectedTable === 'CUSTOMERS' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Company / Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Dynamics Ltd"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="contact@apexdynamics.com"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Phone</label>
                      <input
                        type="text"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Status</label>
                      <select
                        value={formData.status || 'ACTIVE'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Credit Limit ($)</label>
                    <input
                      type="number"
                      step="500"
                      value={formData.credit_limit || ''}
                      onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                </>
              )}

              {selectedTable === 'PRODUCTS' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">SKU</label>
                      <input
                        type="text"
                        required
                        value={formData.sku || ''}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Category</label>
                      <input
                        type="text"
                        required
                        value={formData.category || ''}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Product Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Unit Price ($)</label>
                      <input
                        type="number"
                        step="10"
                        required
                        value={formData.unit_price || ''}
                        onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Stock Quantity</label>
                      <input
                        type="number"
                        required
                        value={formData.stock_quantity || ''}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedTable === 'ORDERS' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Customer ID (FK)</label>
                      <input
                        type="number"
                        required
                        value={formData.customer_id || ''}
                        onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Order Status</label>
                      <select
                        value={formData.status || 'PENDING'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PROCESSING">PROCESSING</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Total Amount ($)</label>
                    <input
                      type="number"
                      step="50"
                      required
                      value={formData.total_amount || ''}
                      onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Notes</label>
                    <input
                      type="text"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md"
                >
                  Commit Insert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT / UPDATE MODAL --- */}
      {editRecord && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-sky-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-sky-400" />
                <span>Update {selectedTable} #{getPkValue(editRecord)}</span>
              </h3>
              <button onClick={() => setEditRecord(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-3 text-xs">
              {selectedTable === 'CUSTOMERS' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Phone</label>
                      <input
                        type="text"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Status</label>
                      <select
                        value={formData.status || 'ACTIVE'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Credit Limit ($)</label>
                    <input
                      type="number"
                      step="500"
                      value={formData.credit_limit || ''}
                      onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                </>
              )}

              {selectedTable === 'PRODUCTS' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Product Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Unit Price ($)</label>
                      <input
                        type="number"
                        step="10"
                        required
                        value={formData.unit_price || ''}
                        onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Stock Quantity</label>
                      <input
                        type="number"
                        required
                        value={formData.stock_quantity || ''}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedTable === 'ORDERS' && (
                <>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Order Status</label>
                    <select
                      value={formData.status || 'PENDING'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="PROCESSING">PROCESSING</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Total Amount ($)</label>
                    <input
                      type="number"
                      step="50"
                      required
                      value={formData.total_amount || ''}
                      onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Notes</label>
                    <input
                      type="text"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-md"
                >
                  Save &amp; Log Delta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-rose-800 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Delete {selectedTable} Entry</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong>{selectedTable} #{getPkValue(deleteTarget)}</strong>?
            </p>
            <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
              The trigger will automatically record a <strong>DELETE</strong> change event into the historical audit log. You can reconstruct or restore this row anytime using the Time Travel Explorer!
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md"
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RECORD INSPECT MODAL --- */}
      {activeRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Record Inspection</h3>
            <p className="text-xs text-slate-400 mb-4">Table: {selectedTable}</p>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto max-h-80">
              {JSON.stringify(activeRecord, null, 2)}
            </pre>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setActiveRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
