import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, ShieldAlert, CheckCircle2, Eye, Play } from 'lucide-react';
import apiService from '../services/api';
import { SqlMutationDiffTableView } from '../components/SqlRecordTableView';

export default function RestorationCenterPage() {
  const [tableName, setTableName] = useState('CUSTOMERS');
  const [recordPk, setRecordPk] = useState('101');
  const defaultTs = new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16);
  const [targetTimestamp, setTargetTimestamp] = useState(defaultTs);
  const [userNote, setUserNote] = useState('Historical operational rollback');

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const [error, setError] = useState(null);

  const handlePreview = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPreview(null);
    setRestoreResult(null);

    try {
      const data = await apiService.previewRestore(
        tableName,
        recordPk,
        new Date(targetTimestamp).toISOString()
      );
      setPreview(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to preview restoration.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRestore = async () => {
    setExecuting(true);
    try {
      const res = await apiService.executeRestore(
        tableName,
        recordPk,
        new Date(targetTimestamp).toISOString(),
        userNote,
        true
      );
      setRestoreResult(res);
      setShowConfirmModal(false);
      setPreview(null);
    } catch (err) {
      alert('Restoration failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Safe Historical Restoration</h2>
        <p className="text-xs text-slate-400">
          Restore records to an earlier point in time safely as a new auditable transaction
        </p>
      </div>

      {/* Warning Box */}
      <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-300">Safe Restoration Protocol</p>
          <p className="mt-0.5 text-amber-400/90 leading-relaxed">
            Historical state is never deleted. Restoration creates a fresh, forward transaction
            that records the reversal in the audit log while validating all relational constraints.
          </p>
        </div>
      </div>

      {/* Target Selector */}
      <form onSubmit={handlePreview} className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Table</label>
            <select
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            >
              <option value="CUSTOMERS">CUSTOMERS</option>
              <option value="PRODUCTS">PRODUCTS</option>
              <option value="ORDERS">ORDERS</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Record PK</label>
            <input
              type="text"
              value={recordPk}
              onChange={(e) => setRecordPk(e.target.value)}
              placeholder="e.g. 101"
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Point-in-Time Target</label>
            <input
              type="datetime-local"
              value={targetTimestamp}
              onChange={(e) => setTargetTimestamp(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Audit Note / Reason</label>
          <input
            type="text"
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            placeholder="Document reason for audit trail"
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
          >
            <Eye className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analyzing Impact...' : 'Preview Restoration Impact'}</span>
          </button>
        </div>
      </form>

      {/* Success Notification */}
      {restoreResult && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white text-sm">Restoration Committed Successfully</p>
            <p className="mt-0.5 text-emerald-300">
              {restoreResult.message} &bull; Recorded in Transaction #{restoreResult.tx_id}
            </p>
          </div>
        </div>
      )}

      {/* Preview Card */}
      {preview && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Proposed Restoration Analysis</h3>
              <p className="text-xs text-slate-400">
                Action: <strong className="text-indigo-400">{preview.proposed_action}</strong>
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-800 text-xs text-slate-300">
              Constraint Check: <strong className="text-emerald-400">{preview.constraint_warning}</strong>
            </span>
          </div>

          {/* Relational SQL Mutation State Comparison */}
          <SqlMutationDiffTableView
            oldValues={preview.current_state}
            newValues={preview.historical_state}
            tableName={tableName}
          />

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Apply Restoration</span>
            </button>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-rose-800/80 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Confirm Data Restoration</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are about to mutate current state of <strong>{tableName}[{recordPk}]</strong> to match its historical state at {new Date(targetTimestamp).toLocaleString()}.
            </p>
            <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
              Action: {preview?.proposed_action}<br />
              Audit Note: &ldquo;{userNote}&rdquo;
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={executing}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {executing ? 'Applying...' : 'Yes, Commit Restoration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
