import React, { useState } from 'react';
import { 
  History, Play, CheckCircle2, Clock, Zap, AlertCircle, 
  Layers, Database, FileText, Table
} from 'lucide-react';
import apiService from '../services/api';
import SqlRecordTableView, { SqlMultiRowTableView } from '../components/SqlRecordTableView';

export default function TimeTravelPage({ initialTable = 'CUSTOMERS', initialPk = '101' }) {
  const [scope, setScope] = useState('ROW'); // 'ROW' | 'TABLE'
  const [tableName, setTableName] = useState(initialTable);
  const [recordPk, setRecordPk] = useState(initialPk);
  const [strategy, setStrategy] = useState('ADAPTIVE');
  
  // Default to 45 mins ago
  const defaultTs = new Date(Date.now() - 45 * 60 * 1000).toISOString().slice(0, 16);
  const [targetTimestamp, setTargetTimestamp] = useState(defaultTs);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleReconstruct = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const isoTs = new Date(targetTimestamp).toISOString();
      if (scope === 'ROW') {
        const data = await apiService.reconstructRow(tableName, recordPk, isoTs, strategy);
        setResult({ ...data, scope: 'ROW' });
      } else {
        const data = await apiService.reconstructTable(tableName, isoTs, strategy);
        setResult({ ...data, scope: 'TABLE' });
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to reconstruct historical state.');
    } finally {
      setLoading(false);
    }
  };

  const setOffsetMinutes = (mins) => {
    const d = new Date(Date.now() - mins * 60 * 1000);
    setTargetTimestamp(d.toISOString().slice(0, 16));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-white">Time Travel Explorer</h2>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-semibold uppercase">
              Relational SQL View
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Reconstruct the exact relational SQL state of any table or row at any historical point in time
          </p>
        </div>

        {/* Scope Toggle: Single Row vs Full Table */}
        <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => { setScope('ROW'); setResult(null); }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              scope === 'ROW'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Single Row</span>
          </button>
          <button
            type="button"
            onClick={() => { setScope('TABLE'); setResult(null); }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              scope === 'TABLE'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Entire Table Snapshot</span>
          </button>
        </div>
      </div>

      {/* Query Form */}
      <form onSubmit={handleReconstruct} className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Table */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Table</label>
            <select
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="CUSTOMERS">CUSTOMERS</option>
              <option value="PRODUCTS">PRODUCTS</option>
              <option value="ORDERS">ORDERS</option>
            </select>
          </div>

          {/* Record PK (only if ROW scope) */}
          {scope === 'ROW' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Primary Key (PK)</label>
              <input
                type="text"
                value={recordPk}
                onChange={(e) => setRecordPk(e.target.value)}
                placeholder="e.g. 101"
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Reconstruction Mode</label>
              <div className="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-indigo-300 font-mono flex items-center space-x-1.5">
                <Table className="w-3.5 h-3.5 text-indigo-400" />
                <span>Full Relation Grid</span>
              </div>
            </div>
          )}

          {/* Date Time Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Historical Timestamp</label>
            <input
              type="datetime-local"
              value={targetTimestamp}
              onChange={(e) => setTargetTimestamp(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Reconstruction Strategy */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Checkpoint Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ADAPTIVE">Adaptive Checkpointing (Optimized)</option>
              <option value="FIXED_INTERVAL">Fixed-Interval Checkpointing</option>
              <option value="LOG_ONLY">Log-Only (No Checkpoints)</option>
            </select>
          </div>
        </div>

        {/* Quick time offsets & Submit */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">Quick offsets:</span>
            {[-10, -30, -60, -120].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setOffsetMinutes(Math.abs(mins))}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer"
              >
                {Math.abs(mins)}m ago
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Reconstructing Relational State...' : `Reconstruct ${scope === 'ROW' ? 'Record State' : 'Table Snapshot'}`}</span>
          </button>
        </div>
      </form>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start space-x-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Reconstruction Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Reconstruction Result Card */}
      {result && (
        <div className="glass-panel p-6 rounded-2xl space-y-5">
          {/* Header Info */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {result.scope === 'ROW' 
                    ? `Reconstructed Row: ${result.table_name}[PK: #${result.record_pk}]`
                    : `Reconstructed Table Snapshot: ${result.table_name}`
                  }
                </h3>
                <p className="text-xs text-slate-400">
                  Effective Historical Timestamp: <span className="font-mono text-slate-300">{new Date(result.target_timestamp).toLocaleString()}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">
                Strategy: <strong className="text-indigo-400">{result.strategy_used}</strong>
              </span>
            </div>
          </div>

          {/* Telemetry Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="text-slate-400">Checkpoint Used</span>
              <p className="mt-1 font-semibold text-slate-200">
                {result.checkpoint_id_used ? `Checkpoint #${result.checkpoint_id_used}` : 'None (Direct Log Replay)'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="text-slate-400">Changes Replayed</span>
              <p className="mt-1 font-semibold text-indigo-300">
                {result.changes_replayed} operation{result.changes_replayed === 1 ? '' : 's'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="text-slate-400">Execution Latency</span>
              <p className="mt-1 font-semibold text-emerald-400 font-mono">
                {result.execution_time_ms} ms
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="text-slate-400">Active Records</span>
              <p className="mt-1 font-semibold text-slate-200">
                {result.scope === 'ROW' ? (result.row_state ? '1 Row' : '0 (Deleted/Inactive)') : `${result.total_active_rows || (result.rows?.length || 0)} Rows`}
              </p>
            </div>
          </div>

          {/* Visible SQL Tables instead of JSON formats */}
          <div className="pt-2">
            {result.scope === 'ROW' ? (
              result.row_state ? (
                <SqlRecordTableView 
                  data={result.row_state} 
                  tableName={result.table_name} 
                  title={`Historical Row State: ${result.table_name}`}
                  badge={`PK #${result.record_pk}`}
                />
              ) : (
                <div className="p-8 rounded-2xl bg-slate-900/40 border border-dashed border-rose-800/40 text-center text-xs text-rose-300 space-y-1">
                  <p className="font-semibold text-sm">Record Did Not Exist (or was Deleted)</p>
                  <p className="text-slate-400 text-xs">
                    At {new Date(result.target_timestamp).toLocaleString()}, no active row with PK #{result.record_pk} existed in {result.table_name}.
                  </p>
                </div>
              )
            ) : (
              <SqlMultiRowTableView 
                rows={result.rows || []} 
                tableName={result.table_name} 
                title={`Historical Snapshot: ${result.table_name} as of ${new Date(result.target_timestamp).toLocaleTimeString()}`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
