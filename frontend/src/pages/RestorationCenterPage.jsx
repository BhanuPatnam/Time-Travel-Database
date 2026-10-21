import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, ShieldAlert, CheckCircle2, Eye, Play, Clock } from 'lucide-react';
import apiService from '../services/api';
import { SqlMutationDiffTableView } from '../components/SqlRecordTableView';
import { toLocalDateTimeInputValue, localInputToIsoUtc, getLocalOffsetTimeString, formatFriendlyDateTime } from '../utils/timeUtils';

export default function RestorationCenterPage() {
  const [tableName, setTableName] = useState('CUSTOMERS');
  const [recordPk, setRecordPk] = useState('101');
  const [targetTimestamp, setTargetTimestamp] = useState(() => getLocalOffsetTimeString(15));
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
        localInputToIsoUtc(targetTimestamp)
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
        localInputToIsoUtc(targetTimestamp),
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
        <h2 className="text-xl font-bold text-[#202833]">Safe Historical Restoration</h2>
        <p className="text-xs text-[#687386]">
          Restore records to an earlier point in time safely as a new auditable transaction
        </p>
      </div>

      {/* Warning Box */}
      <div className="p-4 rounded-lg bg-[#FDF8EE] border border-[#F7E5C0] text-xs text-[#A66B16] flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-[#A66B16] shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-[#A66B16]">Safe Restoration Protocol</p>
          <p className="mt-0.5 text-[#A66B16] leading-relaxed">
            Historical state is never deleted. Restoration creates a fresh, forward transaction
            that records the reversal in the audit log while validating all relational constraints.
          </p>
        </div>
      </div>

      {/* Target Selector */}
      <form onSubmit={handlePreview} className="content-panel p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#202833] mb-1.5">Target Table</label>
            <select
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:border-[#4263A5] outline-none cursor-pointer"
            >
              <option value="CUSTOMERS">CUSTOMERS</option>
              <option value="PRODUCTS">PRODUCTS</option>
              <option value="ORDERS">ORDERS</option>
              <option value="ORDER_ITEMS">ORDER_ITEMS</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202833] mb-1.5">Record PK</label>
            <input
              type="text"
              value={recordPk}
              onChange={(e) => setRecordPk(e.target.value)}
              placeholder="e.g. 101"
              required
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:border-[#4263A5] outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202833] mb-1.5">Point-in-Time Target</label>
            <input
              type="datetime-local"
              value={targetTimestamp}
              onChange={(e) => setTargetTimestamp(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:border-[#4263A5] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#202833] mb-1.5">Audit Note / Reason</label>
          <input
            type="text"
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            placeholder="Document reason for audit trail"
            className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:border-[#4263A5] outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E2E6EC]">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#687386] flex items-center mr-1">
              <Clock className="w-3.5 h-3.5 mr-1" /> Quick Presets:
            </span>
            <button
              type="button"
              onClick={() => setTargetTimestamp(getLocalOffsetTimeString(5))}
              className="px-2 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] cursor-pointer"
            >
              5m ago
            </button>
            <button
              type="button"
              onClick={() => setTargetTimestamp(getLocalOffsetTimeString(15))}
              className="px-2 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] cursor-pointer"
            >
              15m ago
            </button>
            <button
              type="button"
              onClick={() => setTargetTimestamp(getLocalOffsetTimeString(60))}
              className="px-2 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] cursor-pointer"
            >
              1h ago
            </button>
            <button
              type="button"
              onClick={() => setTargetTimestamp(getLocalOffsetTimeString(600))}
              className="px-2 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] cursor-pointer"
            >
              Demo Start
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#4263A5] hover:bg-[#3977A8] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Eye className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analyzing Impact...' : 'Preview Restoration Impact'}</span>
          </button>
        </div>
      </form>

      {/* Success Notification */}
      {restoreResult && (
        <div className="p-4 rounded-lg bg-[#EDF6F1] border border-[#C6E4D4] text-xs text-[#34765A] flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 text-[#34765A] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#34765A] text-sm">Restoration Committed Successfully</p>
            <p className="mt-0.5 text-[#34765A]">
              {restoreResult.message} &bull; Recorded in Transaction #{restoreResult.tx_id}
            </p>
          </div>
        </div>
      )}

      {/* Preview Card */}
      {preview && (
        <div className="content-panel p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E6EC] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#202833]">Proposed Restoration Analysis</h3>
              <p className="text-xs text-[#687386]">
                Action: <strong className="text-[#4263A5]">{preview.proposed_action}</strong>
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#F0F2F5] text-xs text-[#202833] border border-[#E2E6EC]">
              Constraint Check: <strong className="text-[#34765A]">{preview.constraint_warning}</strong>
            </span>
          </div>

          {/* Relational SQL Mutation State Comparison */}
          <SqlMutationDiffTableView
            oldValues={preview.current_state}
            newValues={preview.historical_state}
            tableName={tableName}
          />

          <div className="flex justify-end pt-3 border-t border-[#E2E6EC]">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#B84F52] hover:bg-[#a64346] text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Apply Restoration</span>
            </button>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-[#202833]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="content-panel w-full max-w-md p-6 border border-[#B84F52] shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-[#B84F52]">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-[#202833]">Confirm Data Restoration</h3>
            </div>
            <p className="text-xs text-[#202833] leading-relaxed">
              You are about to mutate current state of <strong>{tableName}[{recordPk}]</strong> to match its historical state at {new Date(targetTimestamp).toLocaleString()}.
            </p>
            <p className="text-xs text-[#202833] bg-[#F7F8FA] p-3 rounded-lg border border-[#E2E6EC] font-mono">
              Action: {preview?.proposed_action}<br />
              Audit Note: &ldquo;{userNote}&rdquo;
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={executing}
                className="px-5 py-2 rounded-lg bg-[#B84F52] hover:bg-[#a64346] text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
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
