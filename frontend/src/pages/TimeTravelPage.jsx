import React, { useState, useEffect } from 'react';
import { 
  History, Play, CheckCircle2, Clock, Zap, AlertCircle, 
  Layers, Database, FileText, Table, RotateCcw, ShieldCheck, 
  ArrowRight, Check, X, RefreshCw, Eye
} from 'lucide-react';
import apiService from '../services/api';
import SqlRecordTableView, { SqlMultiRowTableView, SqlMutationDiffTableView } from '../components/SqlRecordTableView';
import { toLocalDateTimeInputValue, localInputToIsoUtc, getLocalOffsetTimeString, formatFriendlyDateTime } from '../utils/timeUtils';

export default function TimeTravelPage({ initialTable = 'CUSTOMERS', initialPk = '101' }) {
  const [scope, setScope] = useState('DATABASE'); // 'DATABASE' | 'TABLE' | 'ROW'
  const [tableName, setTableName] = useState(initialTable);
  const [recordPk, setRecordPk] = useState(initialPk);
  const [strategy, setStrategy] = useState('ADAPTIVE');
  
  // Default to CURRENT LOCAL TIME
  const [targetTimestamp, setTargetTimestamp] = useState(() => toLocalDateTimeInputValue(new Date()));

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [currentLiveRecord, setCurrentLiveRecord] = useState(null);
  const [error, setError] = useState(null);

  // Active table tab for DATABASE scope
  const [activeDbTab, setActiveDbTab] = useState('CUSTOMERS');

  // Decision & Restoration states
  const [decisionState, setDecisionState] = useState(null); // 'INSPECT_ONLY' | 'RESTORED'
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null); // { table, pk, data }
  const [restoring, setRestoring] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState(null);

  // Set quick time offsets
  const handleQuickOffset = (minutesAgo) => {
    setTargetTimestamp(getLocalOffsetTimeString(minutesAgo));
  };

  const handleReconstruct = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setDecisionState(null);
    setRestoreFeedback(null);
    setCurrentLiveRecord(null);

    try {
      const isoTs = localInputToIsoUtc(targetTimestamp);

      if (scope === 'DATABASE') {
        const data = await apiService.reconstructDatabase(isoTs, strategy);
        setResult({ ...data, scope: 'DATABASE' });
      } else if (scope === 'TABLE') {
        const data = await apiService.reconstructTable(tableName, isoTs, strategy);
        setResult({ ...data, scope: 'TABLE' });
      } else {
        // Single row
        const [historicalData, liveRec] = await Promise.all([
          apiService.reconstructRow(tableName, recordPk, isoTs, strategy),
          apiService.getRecord(tableName, recordPk).catch(() => null)
        ]);
        setResult({ ...historicalData, scope: 'ROW' });
        setCurrentLiveRecord(liveRec);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to reconstruct historical state.');
    } finally {
      setLoading(false);
    }
  };

  // Open restore confirmation modal
  const handleOpenRestoreModal = (tbl, pk, histData) => {
    setRestoreTarget({
      table: tbl,
      pk: String(pk),
      historicalState: histData,
      note: `Time travel restore to ${formatFriendlyDateTime(result?.target_timestamp)}`
    });
    setShowRestoreModal(true);
  };

  // Execute restore
  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const isoTs = localInputToIsoUtc(targetTimestamp);
      const res = await apiService.executeRestore(
        restoreTarget.table,
        restoreTarget.pk,
        isoTs,
        restoreTarget.note,
        true
      );
      setShowRestoreModal(false);
      setDecisionState('RESTORED');
      setRestoreFeedback({
        type: 'SUCCESS',
        message: `Successfully rolled live record ${restoreTarget.table} #${restoreTarget.pk} back to historical state! Committed as Transaction #${res.tx_id || 'new'}.`,
        res
      });
      // Refresh current live record if in ROW view
      if (scope === 'ROW') {
        const updatedLive = await apiService.getRecord(restoreTarget.table, restoreTarget.pk).catch(() => null);
        setCurrentLiveRecord(updatedLive);
      }
    } catch (err) {
      alert('Restoration failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRestoring(false);
    }
  };

  const handleKeepCurrentData = () => {
    setDecisionState('INSPECT_ONLY');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-[#202833]">Time Travel Explorer</h2>
            <span className="px-2 py-0.5 rounded-full bg-[#EDF3FC] border border-[#D0E0F6] text-[#4263A5] text-[10px] font-semibold uppercase">
              Oracle 21c Replay Engine
            </span>
          </div>
          <p className="text-xs text-[#687386] mt-0.5">
            Reconstruct and inspect total database tables or records at any historical point in time, with optional rollback.
          </p>
        </div>

        {/* Scope Selector: All Tables vs Single Table vs Single Row */}
        <div className="flex items-center space-x-1 bg-[#FFFFFF] border border-[#E2E6EC] p-1 rounded-lg">
          <button
            type="button"
            onClick={() => { setScope('DATABASE'); setResult(null); }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              scope === 'DATABASE'
                ? 'bg-[#4263A5] text-white shadow-xs'
                : 'text-[#687386] hover:text-[#202833]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Tables</span>
          </button>

          <button
            type="button"
            onClick={() => { setScope('TABLE'); setResult(null); }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              scope === 'TABLE'
                ? 'bg-[#4263A5] text-white shadow-xs'
                : 'text-[#687386] hover:text-[#202833]'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Single Table</span>
          </button>

          <button
            type="button"
            onClick={() => { setScope('ROW'); setResult(null); }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              scope === 'ROW'
                ? 'bg-[#4263A5] text-white shadow-xs'
                : 'text-[#687386] hover:text-[#202833]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Single Row</span>
          </button>
        </div>
      </div>

      {/* Reconstruction Parameter Form */}
      <form onSubmit={handleReconstruct} className="content-panel p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Target Table (for TABLE or ROW scope) */}
          {scope !== 'DATABASE' && (
            <div>
              <label className="block text-xs font-semibold text-[#202833] mb-1.5">Target Table</label>
              <select
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:outline-none focus:border-[#4263A5] cursor-pointer"
              >
                <option value="CUSTOMERS">CUSTOMERS</option>
                <option value="PRODUCTS">PRODUCTS</option>
                <option value="ORDERS">ORDERS</option>
                <option value="ORDER_ITEMS">ORDER_ITEMS</option>
              </select>
            </div>
          )}

          {/* Record PK (only for ROW scope) */}
          {scope === 'ROW' && (
            <div>
              <label className="block text-xs font-semibold text-[#202833] mb-1.5">Primary Key (PK)</label>
              <input
                type="text"
                value={recordPk}
                onChange={(e) => setRecordPk(e.target.value)}
                placeholder="e.g. 101"
                required
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:outline-none focus:border-[#4263A5] font-mono"
              />
            </div>
          )}

          {/* Database Mode Descriptor */}
          {scope === 'DATABASE' && (
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-[#202833] mb-1.5">Reconstruction Target</label>
              <div className="px-3 py-2 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC] text-xs text-[#4263A5] font-semibold flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-[#4263A5]" />
                <span>Entire Schema (4 Tables)</span>
              </div>
            </div>
          )}

          {/* Local Date/Time Input */}
          <div className={scope === 'ROW' ? 'md:col-span-1' : 'md:col-span-2'}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#202833]">Historical Timestamp</label>
              <span className="text-[10px] text-[#4263A5] font-mono font-medium">Local Browser Time</span>
            </div>
            <input
              type="datetime-local"
              value={targetTimestamp}
              onChange={(e) => setTargetTimestamp(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:outline-none focus:border-[#4263A5] font-mono"
            />
          </div>

          {/* Strategy */}
          <div>
            <label className="block text-xs font-semibold text-[#202833] mb-1.5">Replay Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:outline-none focus:border-[#4263A5] cursor-pointer"
            >
              <option value="ADAPTIVE">Adaptive Checkpointing (Workload-Aware)</option>
              <option value="FIXED_INTERVAL">Fixed-Interval Checkpointing</option>
              <option value="LOG_ONLY">Log-Only (Full Replay from Genesis)</option>
            </select>
          </div>
        </div>

        {/* Quick Time Offset Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E2E6EC]">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#687386] font-medium mr-1 flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1 text-[#687386]" /> Quick Times:
            </span>
            <button
              type="button"
              onClick={() => handleQuickOffset(0)}
              className="px-2.5 py-1 rounded-md bg-[#EDF3FC] hover:bg-[#D0E0F6] text-[#4263A5] font-semibold text-[11px] border border-[#D0E0F6] transition cursor-pointer"
            >
              Now (Current Time)
            </button>
            <button
              type="button"
              onClick={() => handleQuickOffset(5)}
              className="px-2 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] transition cursor-pointer"
            >
              5m ago
            </button>
            <button
              type="button"
              onClick={() => handleQuickOffset(15)}
              className="px-2 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] transition cursor-pointer"
            >
              15m ago
            </button>
            <button
              type="button"
              onClick={() => handleQuickOffset(30)}
              className="px-2 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] transition cursor-pointer"
            >
              30m ago
            </button>
            <button
              type="button"
              onClick={() => handleQuickOffset(60)}
              className="px-2 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] transition cursor-pointer"
            >
              1h ago
            </button>
            <button
              type="button"
              onClick={() => handleQuickOffset(240)}
              className="px-2 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] transition cursor-pointer"
            >
              4h ago
            </button>
            <button
              type="button"
              onClick={() => handleQuickOffset(600)}
              className="px-2 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] transition cursor-pointer"
            >
              Demo Start (10h ago)
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-[#4263A5] hover:bg-[#3977A8] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>
              {loading 
                ? 'Reconstructing Relational State...' 
                : scope === 'DATABASE' 
                  ? 'Reconstruct All Tables' 
                  : scope === 'TABLE' 
                    ? `Reconstruct ${tableName} Snapshot` 
                    : `Reconstruct Row #${recordPk}`
              }
            </span>
          </button>
        </div>
      </form>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-lg bg-[#FDF3F3] border border-[#F9D5D6] text-xs text-[#B84F52] flex items-start space-x-3">
          <AlertCircle className="w-4 h-4 text-[#B84F52] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Reconstruction Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Feedback Alert for Rollback / Keep Decision */}
      {restoreFeedback && (
        <div className="p-4 rounded-lg bg-[#EDF6F1] border border-[#C6E4D4] text-xs text-[#34765A] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#34765A]" />
            <span className="font-medium">{restoreFeedback.message}</span>
          </div>
          <button 
            onClick={() => setRestoreFeedback(null)} 
            className="text-[#34765A] hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {decisionState === 'INSPECT_ONLY' && (
        <div className="p-3.5 rounded-lg bg-[#F0F2F5] border border-[#E2E6EC] text-xs text-[#202833] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#34765A]" />
            <span><strong>Inspection Mode Active:</strong> Current database state remains completely unchanged.</span>
          </div>
          <span className="text-[11px] text-[#687386]">Read-Only Historical View</span>
        </div>
      )}

      {/* Reconstruction Result Card */}
      {result && (
        <div className="content-panel p-6 space-y-6">
          {/* Header Info */}
          <div className="flex flex-wrap items-center justify-between border-b border-[#E2E6EC] pb-4 gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-[#EDF3FC] text-[#4263A5] border border-[#D0E0F6]">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#202833]">
                  {result.scope === 'DATABASE'
                    ? 'Historical Database State: All 4 Tables'
                    : result.scope === 'TABLE'
                      ? `Reconstructed Table Snapshot: ${result.table_name}`
                      : `Reconstructed Row: ${result.table_name}[PK: #${result.record_pk}]`
                  }
                </h3>
                <p className="text-xs text-[#687386]">
                  State at Target Timestamp: <strong className="font-mono text-[#202833]">{formatFriendlyDateTime(result.target_timestamp)}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full bg-[#F0F2F5] border border-[#E2E6EC] text-xs text-[#202833]">
                Strategy: <strong className="text-[#4263A5]">{result.strategy_used}</strong>
              </span>
            </div>
          </div>

          {/* Telemetry Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC] text-xs">
              <span className="text-[#687386]">Target Scope</span>
              <p className="mt-1 font-semibold text-[#202833]">
                {result.scope === 'DATABASE' ? 'All 4 Schema Tables' : `${result.table_name}`}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC] text-xs">
              <span className="text-[#687386]">Changes Replayed</span>
              <p className="mt-1 font-semibold text-[#4263A5]">
                {result.total_changes_replayed ?? result.changes_replayed} committed delta{((result.total_changes_replayed ?? result.changes_replayed) === 1 ? '' : 's')}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC] text-xs">
              <span className="text-[#687386]">Reconstruction Latency</span>
              <p className="mt-1 font-semibold text-[#34765A] font-mono">
                {result.total_execution_time_ms ?? result.execution_time_ms} ms
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC] text-xs">
              <span className="text-[#687386]">Historical Active Records</span>
              <p className="mt-1 font-semibold text-[#202833]">
                {result.scope === 'ROW' 
                  ? (result.row_state ? '1 Record Active' : '0 (Not Yet Created / Deleted)')
                  : `${result.total_active_rows ?? (result.rows?.length || 0)} Total Rows Active`
                }
              </p>
            </div>
          </div>

          {/* ============================================================== */}
          {/* REQUIREMENT 4: INTERACTIVE DECISION BAR (RESTORE OR DO NOT CHANGE) */}
          {/* ============================================================== */}
          <div className="p-4 rounded-xl bg-[#F8F9FB] border border-[#E2E6EC] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EDF3FC] text-[#4263A5] uppercase tracking-wide border border-[#D0E0F6]">
                  Action Decision
                </span>
                <h4 className="text-xs font-bold text-[#202833]">
                  What would you like to do with this historical data?
                </h4>
              </div>
              <p className="text-[11px] text-[#687386]">
                You can restore this exact historical state to the live database (rolls forward as a new auditable transaction) or keep your current live data unchanged.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleKeepCurrentData}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#F0F2F5] text-[#202833] border border-[#E2E6EC] text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-[#34765A]" />
                <span>Keep Current Data (Inspect Only)</span>
              </button>

              {result.scope === 'ROW' && result.row_state && (
                <button
                  type="button"
                  onClick={() => handleOpenRestoreModal(result.table_name, result.record_pk, result.row_state)}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-[#4263A5] hover:bg-[#3977A8] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Live Record to This State</span>
                </button>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* SCOPE 1: DATABASE VIEW (ALL TABLES TABS) */}
          {/* ============================================================== */}
          {result.scope === 'DATABASE' && (
            <div className="space-y-4">
              {/* Table Tabs */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E6EC] pb-2">
                {['CUSTOMERS', 'PRODUCTS', 'ORDERS', 'ORDER_ITEMS'].map((tbl) => {
                  const tData = result.tables?.[tbl];
                  const count = tData?.total_active_rows ?? (tData?.rows?.length || 0);
                  const isActive = activeDbTab === tbl;
                  return (
                    <button
                      key={tbl}
                      type="button"
                      onClick={() => setActiveDbTab(tbl)}
                      className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-[#4263A5] text-white shadow-xs'
                          : 'bg-[#FFFFFF] text-[#687386] hover:text-[#202833] border border-[#E2E6EC]'
                      }`}
                    >
                      <span>{tbl}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#F0F2F5] text-[#202833]'
                      }`}>
                        {count} rows
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Tab Reconstructed Table Grid */}
              {(() => {
                const currentTableData = result.tables?.[activeDbTab];
                const rows = currentTableData?.rows || [];
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#687386]">
                      <span>Showing all active records for <strong>{activeDbTab}</strong> at {formatFriendlyDateTime(result.target_timestamp)}</span>
                      <span className="font-mono">{rows.length} record{rows.length === 1 ? '' : 's'} active</span>
                    </div>

                    <SqlMultiRowTableView
                      rows={rows}
                      tableName={activeDbTab}
                      title={`Historical Relation: ${activeDbTab}`}
                      badge={`${rows.length} rows as of ${new Date(result.target_timestamp).toLocaleTimeString()}`}
                      changeMarkers={currentTableData?.change_markers}
                      onSelectRow={(row) => {
                        const pk = row.customer_id || row.product_id || row.order_id || row.item_id || Object.values(row)[0];
                        handleOpenRestoreModal(activeDbTab, pk, row);
                      }}
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {/* ============================================================== */}
          {/* SCOPE 2: SINGLE TABLE VIEW */}
          {/* ============================================================== */}
          {result.scope === 'TABLE' && (
            <div className="space-y-3">
              <SqlMultiRowTableView
                rows={result.rows || []}
                tableName={result.table_name}
                title={`Historical Snapshot: ${result.table_name}`}
                badge={`${result.rows?.length || 0} active rows as of ${new Date(result.target_timestamp).toLocaleTimeString()}`}
                changeMarkers={result.change_markers}
                onSelectRow={(row) => {
                  const pk = row.customer_id || row.product_id || row.order_id || row.item_id || Object.values(row)[0];
                  handleOpenRestoreModal(result.table_name, pk, row);
                }}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* SCOPE 3: SINGLE ROW VIEW WITH SIDE-BY-SIDE DIFF */}
          {/* ============================================================== */}
          {result.scope === 'ROW' && (
            <div className="space-y-6">
              {result.row_state ? (
                <div className="space-y-4">
                  {/* Side by side comparison: Historical vs Current Live */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Historical Reconstructed Card */}
                    <div className="border border-[#D0E0F6] rounded-xl bg-[#F9FBFE] p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#D0E0F6] pb-2">
                        <div className="flex items-center space-x-2">
                          <History className="w-4 h-4 text-[#4263A5]" />
                          <h4 className="text-xs font-bold text-[#202833]">Historical State (Target Time)</h4>
                        </div>
                        <span className="text-[11px] font-mono text-[#4263A5]">
                          {formatFriendlyDateTime(result.target_timestamp)}
                        </span>
                      </div>
                      <SqlRecordTableView
                        data={result.row_state}
                        tableName={result.table_name}
                        title={`State at ${new Date(result.target_timestamp).toLocaleTimeString()}`}
                        badge={`Historical #${result.record_pk}`}
                      />
                    </div>

                    {/* Current Live Database Card */}
                    <div className="border border-[#E2E6EC] rounded-xl bg-[#FFFFFF] p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#E2E6EC] pb-2">
                        <div className="flex items-center space-x-2">
                          <Database className="w-4 h-4 text-[#34765A]" />
                          <h4 className="text-xs font-bold text-[#202833]">Current Live Database State</h4>
                        </div>
                        <span className="text-[11px] font-mono text-[#34765A] font-semibold">Live Right Now</span>
                      </div>
                      {currentLiveRecord ? (
                        <SqlRecordTableView
                          data={currentLiveRecord}
                          tableName={result.table_name}
                          title="Current Live Record"
                          badge={`Live #${result.record_pk}`}
                        />
                      ) : (
                        <div className="p-8 text-center text-xs text-[#687386]">
                          Record does not exist currently in the live database.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Differences Table View */}
                  {currentLiveRecord && (
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-[#202833] mb-2 flex items-center space-x-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-[#4263A5]" />
                        <span>Column-Level Differences (Historical vs Current Live)</span>
                      </h4>
                      <SqlMutationDiffTableView
                        oldValues={currentLiveRecord}
                        newValues={result.row_state}
                        tableName={result.table_name}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 rounded-lg bg-[#FDF3F3] border border-dashed border-[#F9D5D6] text-center text-xs text-[#B84F52] space-y-1">
                  <p className="font-semibold text-sm">Record Did Not Exist (or was Deleted)</p>
                  <p className="text-[#687386] text-xs">
                    At {formatFriendlyDateTime(result.target_timestamp)}, no active row with PK #{result.record_pk} existed in {result.table_name}.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Restore */}
      {showRestoreModal && restoreTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="content-panel max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between border-b border-[#E2E6EC] pb-3">
              <div className="flex items-center space-x-2">
                <RotateCcw className="w-5 h-5 text-[#4263A5]" />
                <h3 className="text-sm font-bold text-[#202833]">Confirm Historical Restoration</h3>
              </div>
              <button 
                onClick={() => setShowRestoreModal(false)}
                className="text-[#687386] hover:text-[#202833] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[#687386] space-y-2">
              <p>
                You are proposing to restore <strong className="text-[#202833]">{restoreTarget.table} #{restoreTarget.pk}</strong> to its historical values at:
              </p>
              <div className="p-2.5 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC] font-mono text-xs text-[#202833]">
                {formatFriendlyDateTime(result?.target_timestamp)}
              </div>
              <p className="text-[#A66B16]">
                This will create a new audited forward transaction in the database. The previous history will remain completely preserved.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#202833]">Audit Reason / Note</label>
              <input
                type="text"
                value={restoreTarget.note}
                onChange={(e) => setRestoreTarget({ ...restoreTarget, note: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:outline-none focus:border-[#4263A5]"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2E6EC]">
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                disabled={restoring}
                className="px-4 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs font-semibold text-[#202833] hover:bg-[#F0F2F5] transition cursor-pointer"
              >
                Cancel (Keep Current)
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-[#4263A5] hover:bg-[#3977A8] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${restoring ? 'animate-spin' : ''}`} />
                <span>{restoring ? 'Applying Restoration...' : 'Apply Restoration'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
