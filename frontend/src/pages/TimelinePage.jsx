import React, { useState, useEffect } from 'react';
import { GitCommit, Search, RefreshCw, ArrowRight } from 'lucide-react';
import apiService from '../services/api';

export default function TimelinePage({ initialTable = 'CUSTOMERS', initialPk = '101' }) {
  const [tableName, setTableName] = useState(initialTable);
  const [recordPk, setRecordPk] = useState(initialPk);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getTimeline(tableName, recordPk);
      setTimeline(data.timeline || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch timeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, []);

  const getOpBadgeClass = (op) => {
    switch (op) {
      case 'INSERT': return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40';
      case 'UPDATE': return 'bg-sky-950/60 text-sky-400 border-sky-800/40';
      case 'DELETE': return 'bg-rose-950/60 text-rose-400 border-rose-800/40';
      case 'RESTORE': return 'bg-purple-950/60 text-purple-400 border-purple-800/40';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Record Version Timeline</h2>
        <p className="text-xs text-slate-400">
          Chronological audit trail of all transactions and attribute mutations
        </p>
      </div>

      {/* Selector */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center gap-3">
        <select
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
        >
          <option value="CUSTOMERS">CUSTOMERS</option>
          <option value="PRODUCTS">PRODUCTS</option>
          <option value="ORDERS">ORDERS</option>
        </select>

        <input
          type="text"
          value={recordPk}
          onChange={(e) => setRecordPk(e.target.value)}
          placeholder="Record PK (e.g. 101)"
          className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
        />

        <button
          onClick={fetchTimeline}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Load Timeline</span>
        </button>
      </div>

      {/* Timeline Stream */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-xs text-slate-500 py-10 text-center">Loading version audit stream...</p>
        ) : timeline.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl text-center text-xs text-slate-500">
            No historical modifications found for {tableName}[{recordPk}].
          </div>
        ) : (
          <div className="relative pl-6 border-l border-slate-800 space-y-6">
            {timeline.map((entry, idx) => (
              <div key={entry.change_id} className="relative group">
                {/* Node pin */}
                <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-slate-950 border-2 border-indigo-500 shadow-sm shadow-indigo-500/50" />

                <div className="glass-panel p-4 rounded-2xl glass-panel-hover space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getOpBadgeClass(entry.operation_type)}`}>
                        {entry.operation_type}
                      </span>
                      <span className="text-xs text-slate-300 font-mono">
                        Commit #{entry.commit_order_seq} (Tx: {entry.tx_id || 'N/A'})
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(entry.change_timestamp).toLocaleString()}
                    </span>
                  </div>

                  {entry.changed_columns && (
                    <div className="text-xs text-slate-400">
                      Modified columns: <strong className="text-indigo-300">{entry.changed_columns}</strong>
                    </div>
                  )}

                  {/* Before / After */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {entry.old_values && (
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Previous State
                        </span>
                        <pre className="font-mono text-[11px] text-slate-400 overflow-x-auto">
                          {JSON.stringify(entry.old_values, null, 2)}
                        </pre>
                      </div>
                    )}
                    {entry.new_values && (
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                          Resulting State
                        </span>
                        <pre className="font-mono text-[11px] text-emerald-300 overflow-x-auto">
                          {JSON.stringify(entry.new_values, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
