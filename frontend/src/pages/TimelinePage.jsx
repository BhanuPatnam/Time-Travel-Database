import React, { useState, useEffect } from 'react';
import { GitCommit, Search, RefreshCw, ArrowRight, Table, Layers, History } from 'lucide-react';
import apiService from '../services/api';
import { SqlMutationDiffTableView } from '../components/SqlRecordTableView';

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
      case 'INSERT': return 'bg-[#EDF6F1] text-[#34765A] border-[#C6E4D4]';
      case 'UPDATE': return 'bg-[#EDF3FC] text-[#4263A5] border-[#D0E0F6]';
      case 'DELETE': return 'bg-[#FDF3F3] text-[#B84F52] border-[#F9D5D6]';
      case 'RESTORE': return 'bg-[#F8F4FD] text-[#7955A1] border-[#E8DCF8]';
      default: return 'bg-[#F0F2F5] text-[#687386] border-[#E2E6EC]';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold text-[#202833]">Record Version Timeline</h2>
          <span className="px-2 py-0.5 rounded-full bg-[#EDF3FC] border border-[#D0E0F6] text-[#4263A5] text-[10px] font-semibold uppercase">
            SQL Column Diff
          </span>
        </div>
        <p className="text-xs text-[#687386] mt-0.5">
          Chronological audit trail of all transactions and row mutations rendered as relational SQL column diffs
        </p>
      </div>

      {/* Selector */}
      <div className="content-panel p-4 flex flex-wrap items-center gap-3">
        <select
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:border-[#4263A5] outline-none cursor-pointer"
        >
          <option value="CUSTOMERS">CUSTOMERS</option>
          <option value="PRODUCTS">PRODUCTS</option>
          <option value="ORDERS">ORDERS</option>
          <option value="ORDER_ITEMS">ORDER_ITEMS</option>
        </select>

        <input
          type="text"
          value={recordPk}
          onChange={(e) => setRecordPk(e.target.value)}
          placeholder="Record PK (e.g. 101)"
          className="px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] font-mono focus:border-[#4263A5] outline-none"
        />

        <button
          onClick={fetchTimeline}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-[#4263A5] hover:bg-[#3977A8] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Load Timeline</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-[#FDF3F3] border border-[#F9D5D6] text-xs text-[#B84F52]">
          {error}
        </div>
      )}

      {/* Timeline Stream */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-xs text-[#687386] py-10 text-center font-mono">Loading version audit stream...</p>
        ) : timeline.length === 0 ? (
          <div className="content-panel p-8 text-center text-xs text-[#687386]">
            No historical modifications found for {tableName}[{recordPk}].
          </div>
        ) : (
          <div className="relative pl-6 border-l border-[#E2E6EC] space-y-6">
            {timeline.map((entry) => (
              <div key={entry.change_id} className="relative group">
                {/* Node pin */}
                <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-[#FFFFFF] border-2 border-[#4263A5] shadow-xs" />

                <div className="content-panel p-4 glass-panel-hover space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E6EC] pb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getOpBadgeClass(entry.operation_type)}`}>
                        {entry.operation_type}
                      </span>
                      <span className="text-xs text-[#202833] font-mono">
                        Commit Order #{entry.commit_order_seq} &bull; Tx #{entry.tx_id || 'N/A'}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#687386] font-mono">
                      {new Date(entry.change_timestamp).toLocaleString()}
                    </span>
                  </div>

                  {entry.changed_columns && (
                    <div className="text-xs text-[#687386]">
                      Modified columns: <span className="text-[#4263A5] font-semibold font-mono">{entry.changed_columns}</span>
                    </div>
                  )}

                  {/* Relational SQL Mutation Diff Table instead of raw JSON */}
                  <SqlMutationDiffTableView
                    oldValues={entry.old_values}
                    newValues={entry.new_values}
                    changedColumns={entry.changed_columns}
                    tableName={tableName}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
