import React, { useState } from 'react';
import { GitCompare, Play, PlusCircle, MinusCircle, Edit, AlertCircle, Table, Clock } from 'lucide-react';
import apiService from '../services/api';
import { SqlMutationDiffTableView } from '../components/SqlRecordTableView';
import { toLocalDateTimeInputValue, localInputToIsoUtc, getLocalOffsetTimeString, formatFriendlyDateTime } from '../utils/timeUtils';

export default function DiffViewerPage() {
  const [tableName, setTableName] = useState('CUSTOMERS');
  
  // T1: 30 mins ago, T2: current local time
  const [t1, setT1] = useState(() => getLocalOffsetTimeString(30));
  const [t2, setT2] = useState(() => toLocalDateTimeInputValue(new Date()));
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
        localInputToIsoUtc(t1),
        localInputToIsoUtc(t2)
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
            <h2 className="text-xl font-bold text-[#202833]">Historical Diff Viewer</h2>
            <span className="px-2 py-0.5 rounded-full bg-[#EDF3FC] border border-[#D0E0F6] text-[#4263A5] text-[10px] font-semibold uppercase">
              SQL Relation Diffs
            </span>
          </div>
          <p className="text-xs text-[#687386] mt-0.5">
            Compare relational states between any two historical timestamps with structured SQL column diffs
          </p>
        </div>
      </div>

      <form onSubmit={handleCompare} className="content-panel p-6 space-y-4">
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
            <label className="block text-xs font-semibold text-[#202833] mb-1.5">Baseline Timestamp (T1)</label>
            <input
              type="datetime-local"
              value={t1}
              onChange={(e) => setT1(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:border-[#4263A5] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202833] mb-1.5">Comparison Timestamp (T2)</label>
            <input
              type="datetime-local"
              value={t2}
              onChange={(e) => setT2(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-xs text-[#202833] focus:border-[#4263A5] outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E2E6EC]">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#687386] flex items-center mr-1">
              <Clock className="w-3.5 h-3.5 mr-1" /> Quick Presets:
            </span>
            <button
              type="button"
              onClick={() => {
                setT1(getLocalOffsetTimeString(15));
                setT2(toLocalDateTimeInputValue(new Date()));
              }}
              className="px-2.5 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] cursor-pointer"
            >
              Last 15m vs Now
            </button>
            <button
              type="button"
              onClick={() => {
                setT1(getLocalOffsetTimeString(60));
                setT2(toLocalDateTimeInputValue(new Date()));
              }}
              className="px-2.5 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] cursor-pointer"
            >
              Last 1h vs Now
            </button>
            <button
              type="button"
              onClick={() => {
                setT1(getLocalOffsetTimeString(600));
                setT2(toLocalDateTimeInputValue(new Date()));
              }}
              className="px-2.5 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E2E6EC] text-[#202833] text-[11px] border border-[#E2E6EC] cursor-pointer"
            >
              Demo Start vs Now
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#4263A5] hover:bg-[#3977A8] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <GitCompare className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Computing SQL Relational Diff...' : 'Compare Relational States'}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 rounded-lg bg-[#FDF3F3] border border-[#F9D5D6] text-xs text-[#B84F52] flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {diffResult && (
        <div className="space-y-4">
          {/* Summary counters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="content-panel p-4 flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-[#EDF6F1] text-[#34765A] border border-[#C6E4D4]">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-[#687386]">Added Rows</span>
                <p className="text-xl font-bold text-[#202833]">{diffResult.added_count}</p>
              </div>
            </div>

            <div className="content-panel p-4 flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-[#EDF3FC] text-[#4263A5] border border-[#D0E0F6]">
                <Edit className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-[#687386]">Modified Rows</span>
                <p className="text-xl font-bold text-[#202833]">{diffResult.modified_count}</p>
              </div>
            </div>

            <div className="content-panel p-4 flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-[#FDF3F3] text-[#B84F52] border border-[#F9D5D6]">
                <MinusCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-[#687386]">Deleted Rows</span>
                <p className="text-xl font-bold text-[#202833]">{diffResult.deleted_count}</p>
              </div>
            </div>
          </div>

          {/* List of changes */}
          <div className="content-panel p-5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#202833]">Relational Column-by-Column Mutations</h3>
              <span className="text-xs text-[#687386]">
                Showing {diffResult.changes.length} row modifications
              </span>
            </div>

            {diffResult.changes.length === 0 ? (
              <p className="text-xs text-[#687386] py-6 text-center">
                Zero structural or data modifications between the two selected timestamps.
              </p>
            ) : (
              diffResult.changes.map((item, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC] text-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E2E6EC] pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-md bg-[#EDF3FC] text-[#4263A5] border border-[#D0E0F6] font-mono font-bold text-xs">
                        #{item.record_pk}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFFFFF] border border-[#E2E6EC] text-[#202833] uppercase">
                        {item.operation_type}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#687386] font-mono">
                      {new Date(item.change_timestamp).toLocaleString()}
                    </span>
                  </div>

                  {item.changed_columns && (
                    <p className="text-[#687386] text-xs">
                      Altered Columns: <span className="text-[#4263A5] font-semibold font-mono">{item.changed_columns}</span>
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
