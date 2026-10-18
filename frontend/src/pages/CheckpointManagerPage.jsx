import React, { useState, useEffect } from 'react';
import { Flag, Play, CheckCircle2, Clock, HardDrive, RefreshCw, AlertCircle } from 'lucide-react';
import apiService from '../services/api';

export default function CheckpointManagerPage() {
  const [checkpoints, setCheckpoints] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [selectedTable, setSelectedTable] = useState('CUSTOMERS');
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [latestEval, setLatestEval] = useState(null);

  const fetchCheckpoints = async () => {
    setLoading(true);
    try {
      const [cpData, decData] = await Promise.all([
        apiService.getCheckpoints(),
        apiService.getPolicyDecisions(),
      ]);
      setCheckpoints(cpData);
      setDecisions(decData);
    } catch (err) {
      console.error('Error fetching checkpoints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckpoints();
  }, []);

  const handleCreateCheckpoint = async () => {
    try {
      await apiService.createCheckpoint(selectedTable, 'MANUAL', 'Triggered from Checkpoint Manager');
      await fetchCheckpoints();
    } catch (err) {
      alert('Failed to create checkpoint: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEvaluateAdaptive = async () => {
    setEvaluating(true);
    try {
      const dec = await apiService.evaluateAdaptivePolicy(selectedTable);
      setLatestEval(dec);
      await fetchCheckpoints();
    } catch (err) {
      alert('Policy evaluation failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Checkpoint Manager</h2>
          <p className="text-xs text-slate-400">
            Materialized boundary snapshots and workload-aware adaptive checkpoint evaluations
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
          >
            <option value="CUSTOMERS">CUSTOMERS</option>
            <option value="PRODUCTS">PRODUCTS</option>
            <option value="ORDERS">ORDERS</option>
            <option value="__ALL__">__ALL__ (Entire Scope)</option>
          </select>

          <button
            onClick={handleEvaluateAdaptive}
            disabled={evaluating}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
          >
            {evaluating ? 'Evaluating...' : 'Evaluate Adaptive Policy'}
          </button>

          <button
            onClick={handleCreateCheckpoint}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
          >
            Create Checkpoint
          </button>
        </div>
      </div>

      {/* Latest Evaluation Feedback Banner */}
      {latestEval && (
        <div className="p-4 rounded-xl bg-slate-900/90 border border-purple-800/40 text-xs text-purple-200 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-300">
              Adaptive Policy Evaluation Result: {latestEval.action_taken}
            </span>
            <span className="text-[10px] text-slate-400">
              {new Date(latestEval.evaluated_at).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-slate-300 text-[11px]">{latestEval.decision_reason}</p>
        </div>
      )}

      {/* Checkpoints Table */}
      <div className="glass-panel rounded-2xl overflow-hidden space-y-3 p-5">
        <h3 className="text-sm font-semibold text-white">Materialized Checkpoints</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5">ID</th>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Scope</th>
                <th className="px-3 py-2.5">Strategy</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Rows</th>
                <th className="px-3 py-2.5">Storage</th>
                <th className="px-3 py-2.5">Duration</th>
                <th className="px-3 py-2.5">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {checkpoints.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    No checkpoints recorded yet.
                  </td>
                </tr>
              ) : (
                checkpoints.map((cp) => (
                  <tr key={cp.checkpoint_id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2.5 text-indigo-400 font-bold">#{cp.checkpoint_id}</td>
                    <td className="px-3 py-2.5 text-slate-200 font-sans">{cp.checkpoint_name}</td>
                    <td className="px-3 py-2.5 text-slate-300">{cp.table_name}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {cp.strategy_used}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[10px]">
                        {cp.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">{cp.row_count}</td>
                    <td className="px-3 py-2.5 text-slate-400">{(cp.storage_bytes / 1024).toFixed(1)} KB</td>
                    <td className="px-3 py-2.5 text-emerald-400">{cp.creation_duration_ms} ms</td>
                    <td className="px-3 py-2.5 text-slate-500 text-[10px]">
                      {new Date(cp.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Audit Trail */}
      <div className="glass-panel p-5 rounded-2xl space-y-3">
        <h3 className="text-sm font-semibold text-white">Adaptive Decision Audit Trail</h3>
        <p className="text-xs text-slate-400">
          Transparent record explaining why each checkpoint was triggered or skipped
        </p>
        <div className="space-y-2">
          {decisions.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No decision audits yet.</p>
          ) : (
            decisions.map((d) => (
              <div key={d.decision_id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    Decision #{d.decision_id} &bull; {d.table_name}
                  </span>
                  <span className="font-mono text-slate-400 text-[10px]">
                    {new Date(d.evaluated_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-400">
                  <span>Changes since last CP: <strong>{d.changes_since_last_cp}</strong></span>
                  <span>Estimated replay cost: <strong>{d.estimated_replay_cost_ms} ms</strong></span>
                  <span>Query frequency: <strong>{d.historical_query_freq}</strong></span>
                  <span>Action: <strong className="text-indigo-400">{d.action_taken}</strong></span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 italic">
                  &ldquo;{d.decision_reason}&rdquo;
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
