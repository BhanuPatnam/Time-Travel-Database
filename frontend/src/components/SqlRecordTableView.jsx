import React, { useState } from 'react';
import { Table, Code, Copy, Check, Eye } from 'lucide-react';

const COLUMN_METADATA = {
  CUSTOMERS: {
    customer_id: { type: 'NUMBER(10) PRIMARY KEY', category: 'key' },
    name: { type: 'VARCHAR2(100) NOT NULL', category: 'text' },
    email: { type: 'VARCHAR2(100) UNIQUE', category: 'text' },
    phone: { type: 'VARCHAR2(20)', category: 'text' },
    status: { type: 'VARCHAR2(20) CHECK', category: 'enum' },
    credit_limit: { type: 'NUMBER(12,2)', category: 'currency' },
    created_at: { type: 'TIMESTAMP(6) WITH TIME ZONE', category: 'timestamp' },
    updated_at: { type: 'TIMESTAMP(6) WITH TIME ZONE', category: 'timestamp' },
  },
  PRODUCTS: {
    product_id: { type: 'NUMBER(10) PRIMARY KEY', category: 'key' },
    sku: { type: 'VARCHAR2(50) UNIQUE', category: 'code' },
    name: { type: 'VARCHAR2(100) NOT NULL', category: 'text' },
    category: { type: 'VARCHAR2(50)', category: 'enum' },
    unit_price: { type: 'NUMBER(10,2) NOT NULL', category: 'currency' },
    stock_quantity: { type: 'NUMBER(8) NOT NULL', category: 'number' },
    created_at: { type: 'TIMESTAMP(6) WITH TIME ZONE', category: 'timestamp' },
    updated_at: { type: 'TIMESTAMP(6) WITH TIME ZONE', category: 'timestamp' },
  },
  ORDERS: {
    order_id: { type: 'NUMBER(10) PRIMARY KEY', category: 'key' },
    customer_id: { type: 'NUMBER(10) REFERENCES CUSTOMERS', category: 'key' },
    order_date: { type: 'TIMESTAMP(6) WITH TIME ZONE', category: 'timestamp' },
    status: { type: 'VARCHAR2(20) CHECK', category: 'enum' },
    total_amount: { type: 'NUMBER(12,2) NOT NULL', category: 'currency' },
    notes: { type: 'VARCHAR2(500)', category: 'text' },
    created_at: { type: 'TIMESTAMP(6) WITH TIME ZONE', category: 'timestamp' },
    updated_at: { type: 'TIMESTAMP(6) WITH TIME ZONE', category: 'timestamp' },
  },
};

export function formatSqlValue(val, category) {
  if (val === null || val === undefined) {
    return <span className="font-mono text-slate-500 italic text-[11px]">NULL</span>;
  }
  if (category === 'currency') {
    return (
      <span className="font-mono text-emerald-300 font-semibold text-xs">
        ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  }
  if (category === 'enum') {
    const isSuccess = ['ACTIVE', 'COMPLETED', 'DELIVERED', 'VIP'].includes(String(val).toUpperCase());
    const isWarning = ['PENDING', 'PROCESSING', 'SUSPENDED'].includes(String(val).toUpperCase());
    const isDanger = ['INACTIVE', 'CANCELLED'].includes(String(val).toUpperCase());

    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
        isSuccess ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50' :
        isWarning ? 'bg-amber-950/60 text-amber-300 border-amber-800/50' :
        isDanger ? 'bg-rose-950/60 text-rose-300 border-rose-800/50' :
        'bg-slate-800 text-slate-300 border-slate-700'
      }`}>
        {String(val)}
      </span>
    );
  }
  if (category === 'key') {
    return (
      <span className="px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 font-mono text-xs font-semibold">
        #{String(val)}
      </span>
    );
  }
  if (category === 'timestamp') {
    const dateStr = new Date(val).toLocaleString();
    return (
      <span className="font-mono text-[11px] text-slate-300">
        {dateStr !== 'Invalid Date' ? dateStr : String(val)}
      </span>
    );
  }
  if (category === 'code') {
    return <span className="font-mono text-amber-300 text-xs">{String(val)}</span>;
  }
  return <span className="text-slate-200 text-xs">{String(val)}</span>;
}

export function inferSqlType(key, val, tableName) {
  const tableMeta = COLUMN_METADATA[tableName] || {};
  if (tableMeta[key]) return tableMeta[key].type;
  if (typeof val === 'number') {
    return Number.isInteger(val) ? 'NUMBER(10)' : 'NUMBER(12,2)';
  }
  if (typeof val === 'boolean') return 'NUMBER(1)';
  if (typeof val === 'string' && val.includes('T') && !isNaN(Date.parse(val))) {
    return 'TIMESTAMP WITH TIME ZONE';
  }
  return 'VARCHAR2(255)';
}

export function inferCategory(key, val, tableName) {
  const tableMeta = COLUMN_METADATA[tableName] || {};
  if (tableMeta[key]) return tableMeta[key].category;
  if (key.endsWith('_id')) return 'key';
  if (key.includes('price') || key.includes('amount') || key.includes('limit')) return 'currency';
  if (key === 'status') return 'enum';
  if (key.includes('date') || key.endsWith('_at')) return 'timestamp';
  return 'text';
}

/**
 * Renders a single database record as an Oracle SQL Relational Table.
 */
export default function SqlRecordTableView({ 
  data, 
  tableName = 'CUSTOMERS',
  title = 'Materialized SQL Row State',
  badge = null
}) {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'json'
  const [copied, setCopied] = useState(false);

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center text-xs text-slate-500">
        No relational data available to display.
      </div>
    );
  }

  const entries = Object.entries(data);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Header bar with view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Table className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-semibold text-white tracking-wide uppercase">
            {title}
          </h4>
          {badge && (
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              viewMode === 'table'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-3 h-3" />
            <span>SQL Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('json')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              viewMode === 'json'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3 h-3" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer ml-1"
            title="Copy state"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-md">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-4 w-1/4">Column Name</th>
                <th className="py-2.5 px-4 w-1/4">Oracle SQL Data Type</th>
                <th className="py-2.5 px-4 w-1/2">Materialized Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/50">
              {entries.map(([colName, val]) => {
                const category = inferCategory(colName, val, tableName);
                const sqlType = inferSqlType(colName, val, tableName);
                return (
                  <tr key={colName} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-4 font-mono font-medium text-slate-200 text-xs">
                      {colName.toUpperCase()}
                    </td>
                    <td className="py-2 px-4 font-mono text-[11px] text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {sqlType}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      {formatSqlValue(val, category)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

/**
 * Renders an entire table snapshot as an interactive Relational SQL Table Grid.
 */
export function SqlMultiRowTableView({
  rows = [],
  tableName = 'CUSTOMERS',
  title = 'Table Historical Snapshot'
}) {
  const [viewMode, setViewMode] = useState('table');
  const [copied, setCopied] = useState(false);

  if (!rows || rows.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center text-xs text-slate-500">
        Zero rows were active in {tableName} at the requested point in time.
      </div>
    );
  }

  const columns = Object.keys(rows[0] || {});

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Table className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-semibold text-white tracking-wide uppercase">
            {title} ({rows.length} {rows.length === 1 ? 'row' : 'rows'})
          </h4>
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              viewMode === 'table' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-3 h-3" />
            <span>SQL Grid</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('json')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              viewMode === 'json' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3 h-3" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer ml-1"
            title="Copy snapshot"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-md">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3 w-10 text-slate-500">#</th>
                {columns.map((col) => (
                  <th key={col} className="py-2.5 px-4 font-mono">
                    {col.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/50">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-3 text-[10px] text-slate-500 font-mono">{idx + 1}</td>
                  {columns.map((col) => {
                    const val = row[col];
                    const category = inferCategory(col, val, tableName);
                    return (
                      <td key={col} className="py-2 px-4 whitespace-nowrap">
                        {formatSqlValue(val, category)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto max-h-96">
          {JSON.stringify(rows, null, 2)}
        </pre>
      )}
    </div>
  );
}

/**
 * Renders a side-by-side SQL Mutation Diff Table for Old Values vs New Values.
 */
export function SqlMutationDiffTableView({
  oldValues = null,
  newValues = null,
  changedColumns = '',
  tableName = 'CUSTOMERS'
}) {
  const [viewMode, setViewMode] = useState('table');

  const allKeys = Array.from(new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {})
  ]));

  const changedList = (changedColumns || '').split(',').map(s => s.trim().toLowerCase());

  if (allKeys.length === 0) {
    return (
      <div className="p-3 text-xs text-slate-500 text-center italic">
        No state payload captured for this transaction.
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Column-by-Column SQL Mutation State
        </span>
        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
              viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SQL Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('json')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
              viewMode === 'json' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2 px-3 w-1/4">Column</th>
                <th className="py-2 px-3 w-1/3 text-rose-300">Previous State (Before)</th>
                <th className="py-2 px-3 w-1/3 text-emerald-300">Resulting State (After)</th>
                <th className="py-2 px-3 text-right">Delta Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/60 font-mono text-[11px]">
              {allKeys.map((col) => {
                const oldVal = oldValues ? oldValues[col] : null;
                const newVal = newValues ? newValues[col] : null;
                const category = inferCategory(col, newVal !== null ? newVal : oldVal, tableName);

                const isModified = changedList.includes(col.toLowerCase()) || 
                  (oldValues && newValues && JSON.stringify(oldVal) !== JSON.stringify(newVal));

                const isAdded = oldVal === undefined || (oldValues === null && newVal !== null);
                const isDeleted = newVal === undefined || (newValues === null && oldVal !== null);

                return (
                  <tr 
                    key={col} 
                    className={isModified ? 'bg-indigo-950/20' : 'hover:bg-slate-800/20'}
                  >
                    <td className="py-2 px-3 font-semibold text-slate-200">
                      {col.toUpperCase()}
                    </td>
                    <td className="py-2 px-3">
                      {isAdded ? (
                        <span className="text-slate-500 italic text-[10px]">N/A (New Record)</span>
                      ) : (
                        <span className={isModified ? 'text-rose-400' : 'text-slate-400'}>
                          {formatSqlValue(oldVal, category)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isDeleted ? (
                        <span className="text-rose-500 italic text-[10px]">TOMBSTONE (Deleted)</span>
                      ) : (
                        <span className={isModified ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
                          {formatSqlValue(newVal, category)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {isModified ? (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 text-[9px] font-bold">
                          MODIFIED
                        </span>
                      ) : isAdded ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50 text-[9px] font-bold">
                          INSERTED
                        </span>
                      ) : isDeleted ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/50 text-[9px] font-bold">
                          DELETED
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">UNCHANGED</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Old State</span>
            <pre className="font-mono text-[10px] text-slate-400 overflow-x-auto">
              {JSON.stringify(oldValues, null, 2)}
            </pre>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider block mb-1">New State</span>
            <pre className="font-mono text-[10px] text-emerald-300 overflow-x-auto">
              {JSON.stringify(newValues, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
