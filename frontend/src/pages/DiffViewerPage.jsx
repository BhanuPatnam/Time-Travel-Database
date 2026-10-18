import React, { useState } from 'react';
import { GitCompare, Play, PlusCircle, MinusCircle, Edit, AlertCircle, Table } from 'lucide-react';
import apiService from '../services/api';
import { SqlMutationDiffTableView } from '../components/SqlRecordTableView';

export default function DiffViewerPage() {
  const [tableName, setTableName] = useState('CUSTOMERS');
  
  // T1: 90 mins ago, T2: now
  const defaultT1 = new Date(Date.now() - 90 * 60 * 1000).toISOString().slice(0, 16);
  const defaultT2 = new Date().toISOString().slice(0, 16);

  const [t1, setT1] = useState(defaultT1);
  const [t2, setT2] = useState(defaultT2);
  const [loading, setLoading] = useState(false);
  const [diffResult, setDiffResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCompare = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDiffResult(null);

    try {
      const data = await apiService.compareStates(
        tableName,
        new Date(t1).toISOString(),
        new Date(t2).toISOString()
      );
      setDiffResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to compute diff.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-white">Historical Diff Viewer</h2>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-semibold uppercase">
              SQL Relation Diffs
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Compare relational states between any two historical timestamps with structured SQL column diffs
          </p>
        </div>
      </div>

      <form onSubmit={handleCompare} className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Table</label>
            <select
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 cursor-pointer"
            >
              <option value="CUSTOMERS">CUSTOMERS</option>
              <option value="PRODUCTS">PRODUCTS</option>
              <option value="ORDERS">ORDERS</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Baseline Timestamp (T1)</label>
            <input
              type="datetime-local"
              value={t1}
              onChange={(e) => setT1(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Comparison Timestamp (T2)</label>
            <input
              type="datetime-local"
              value={t2}
              onChange={(e) => setT2(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <GitCompare className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Computing SQL Relational Diff...' : 'Compare Relational States'}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {diffResult && (
        <div className="space-y-4">
          {/* Summary counters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel p-4 rounded-2xl flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400">Added Rows</span>
                <p className="text-xl font-bold text-white">{diffResult.added_count}</p>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-2xl flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-sky-950/60 text-sky-400 border border-sky-800/40">
                <Edit className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400">Modified Rows</span>
                <p className="text-xl font-bold text-white">{diffResult.modified_count}</p>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-2xl flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-rose-950/60 text-rose-400 border border-rose-800/40">
                <MinusCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400">Deleted Rows</span>
                <p className="text-xl font-bold text-white">{diffResult.deleted_count}</p>
              </div>
            </div>
          </div>

          {/* List of changes */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">Relational Column-by-Column Mutations</h3>
              <span className="text-xs text-slate-400">
                Showing {diffResult.changes.length} row modifications
              </span>
            </div>

            {diffResult.changes.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Zero structural or data modifications between the two selected timestamps.
              </p>
            ) : (
              diffResult.changes.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 font-mono font-bold text-xs">
                        #{item.record_pk}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 uppercase">
                        {item.operation_type}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(item.change_timestamp).toLocaleString()}
                    </span>
                  </div>

                  {item.changed_columns && (
                    <p className="text-slate-400 text-xs">
                      Altered Columns: <span className="text-indigo-300 font-semibold font-mono">{item.changed_columns}</span>
                    </p>
                  )}

                  {/* Relational SQL Diff Table */}
                  <SqlMutationDiffTableView
                    oldValues={item.old_values}
                    newValues={item.new_values}
                    changedColumns={item.changed_columns}
                    tableName={tableName}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
