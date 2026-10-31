import React, { useState } from 'react';
import { Table, Code, Copy, Check } from 'lucide-react';

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
  ORDER_ITEMS: {
    item_id: { type: 'NUMBER(10) PRIMARY KEY', category: 'key' },
    order_id: { type: 'NUMBER(10) REFERENCES ORDERS', category: 'key' },
    product_id: { type: 'NUMBER(10) REFERENCES PRODUCTS', category: 'key' },
    quantity: { type: 'NUMBER(6) NOT NULL', category: 'number' },
    unit_price: { type: 'NUMBER(10,2) NOT NULL', category: 'currency' },
    subtotal: { type: 'NUMBER(12,2) NOT NULL', category: 'currency' },
  }
};

export function formatSqlValue(val, category) {
  if (val === null || val === undefined) {
    return <span className="font-mono text-[#8C98A9] italic text-[11px]">NULL</span>;
  }
  if (category === 'currency') {
    return (
      <span className="font-mono text-[#34765A] font-semibold text-xs">
        ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  }
  if (category === 'enum') {
    const isSuccess = ['ACTIVE', 'COMPLETED', 'DELIVERED', 'VIP'].includes(String(val).toUpperCase());
    const isWarning = ['PENDING', 'PROCESSING', 'SUSPENDED'].includes(String(val).toUpperCase());
    const isDanger = ['INACTIVE', 'CANCELLED'].includes(String(val).toUpperCase());

    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
        isSuccess ? 'bg-[#EAF3EE] text-[#34765A] border-[#BDE0CE]' :
        isWarning ? 'bg-[#FEF7EC] text-[#A66B16] border-[#F6E0B5]' :
        isDanger ? 'bg-[#FDF2F2] text-[#B84F52] border-[#F8C8C9]' :
        'bg-[#F0F2F5] text-[#202833] border-[#E2E6EC]'
      }`}>
        {String(val)}
      </span>
    );
  }
  if (category === 'key') {
    return (
      <span className="px-1.5 py-0.5 rounded bg-[#EDF3FC] border border-[#C8DCF7] text-[#4263A5] font-mono text-xs font-semibold">
        #{String(val)}
      </span>
    );
  }
  if (category === 'timestamp') {
    const dateStr = new Date(val).toLocaleString();
    return (
      <span className="font-mono text-[11px] text-[#202833]">
        {dateStr !== 'Invalid Date' ? dateStr : String(val)}
      </span>
    );
  }
  if (category === 'code') {
    return <span className="font-mono text-[#A66B16] font-semibold text-xs">{String(val)}</span>;
  }
  return <span className="text-[#202833] text-xs">{String(val)}</span>;
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
  if (key.includes('price') || key.includes('amount') || key.includes('limit') || key === 'subtotal') return 'currency';
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
  const [viewMode, setViewMode] = useState('table');
  const [copied, setCopied] = useState(false);

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="p-6 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-center text-xs text-[#687386]">
        No relational record state available for this timestamp.
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
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Table className="w-3.5 h-3.5 text-[#4263A5]" />
          <h4 className="text-xs font-semibold text-[#202833] tracking-wide uppercase">
            {title}
          </h4>
          {badge && (
            <span className="px-2 py-0.5 rounded bg-[#EDF3FC] border border-[#C8DCF7] text-[10px] font-mono text-[#4263A5]">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1 bg-[#F0F2F5] border border-[#E2E6EC] p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              viewMode === 'table'
                ? 'bg-[#FFFFFF] text-[#4263A5] font-semibold shadow-xs'
                : 'text-[#687386] hover:text-[#202833]'
            }`}
          >
            <Table className="w-3 h-3" />
            <span>SQL Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('json')}
            className={`flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              viewMode === 'json'
                ? 'bg-[#FFFFFF] text-[#4263A5] font-semibold shadow-xs'
                : 'text-[#687386] hover:text-[#202833]'
            }`}
          >
            <Code className="w-3 h-3" />
            <span>Raw JSON</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-[#687386] hover:text-[#202833] transition cursor-pointer ml-1"
            title="Copy state"
          >
            {copied ? <Check className="w-3 h-3 text-[#34765A]" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-lg border border-[#E2E6EC] bg-[#FFFFFF]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F3F5F7] border-b border-[#E2E6EC] text-[#687386] text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-2 px-3.5 w-1/4">Column Name</th>
                <th className="py-2 px-3.5 w-1/3">Oracle SQL Type</th>
                <th className="py-2 px-3.5">Reconstructed Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6EC]">
              {entries.map(([colName, val]) => {
                const category = inferCategory(colName, val, tableName);
                const sqlType = inferSqlType(colName, val, tableName);
                return (
                  <tr key={colName} className="hover:bg-[#F7F8FA] transition-colors">
                    <td className="py-2 px-3.5 font-mono font-medium text-[#202833] text-xs">
                      {colName.toUpperCase()}
                    </td>
                    <td className="py-2 px-3.5 font-mono text-[11px] text-[#687386]">
                      <span className="px-1.5 py-0.5 rounded bg-[#F0F2F5] border border-[#E2E6EC]">
                        {sqlType}
                      </span>
                    </td>
                    <td className="py-2 px-3.5">
                      {formatSqlValue(val, category)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="p-3.5 rounded-lg bg-[#F3F5F7] border border-[#E2E6EC] font-mono text-xs text-[#202833] overflow-x-auto leading-relaxed">
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
  title = 'Table Historical Snapshot',
  changeMarkers = {},
  onSelectRow,
}) {
  const [viewMode, setViewMode] = useState('table');
  const [copied, setCopied] = useState(false);

  if (!rows || rows.length === 0) {
    return (
      <div className="p-6 rounded-lg bg-[#FFFFFF] border border-[#E2E6EC] text-center text-xs text-[#687386]">
        Zero rows were active in {tableName} at the requested point in time.
      </div>
    );
  }

  const columns = Object.keys(rows[0] || {});
  const showChangeMarkers = Object.keys(changeMarkers).length > 0;
  const getRecordPk = (row) => String(row.customer_id ?? row.product_id ?? row.order_id ?? row.item_id ?? '');

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Table className="w-3.5 h-3.5 text-[#4263A5]" />
          <h4 className="text-xs font-semibold text-[#202833] tracking-wide uppercase">
            {title} ({rows.length} {rows.length === 1 ? 'row' : 'rows'})
          </h4>
        </div>

        <div className="flex items-center space-x-1 bg-[#F0F2F5] border border-[#E2E6EC] p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              viewMode === 'table' ? 'bg-[#FFFFFF] text-[#4263A5] font-semibold shadow-xs' : 'text-[#687386] hover:text-[#202833]'
            }`}
          >
            <Table className="w-3 h-3" />
            <span>SQL Grid</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('json')}
            className={`flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              viewMode === 'json' ? 'bg-[#FFFFFF] text-[#4263A5] font-semibold shadow-xs' : 'text-[#687386] hover:text-[#202833]'
            }`}
          >
            <Code className="w-3 h-3" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-[#687386] hover:text-[#202833] transition cursor-pointer ml-1"
            title="Copy snapshot"
          >
            {copied ? <Check className="w-3 h-3 text-[#34765A]" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-lg border border-[#E2E6EC] bg-[#FFFFFF]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F3F5F7] border-b border-[#E2E6EC] text-[#687386] text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-2 px-3 w-10 text-[#8C98A9]">#</th>
                {columns.map((col) => (
                  <th key={col} className="py-2 px-3 font-mono">
                    {col.toUpperCase()}
                  </th>
                ))}
                {showChangeMarkers && <th className="py-2 px-3">Changed Since</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6EC]">
              {rows.map((row, idx) => {
                const marker = changeMarkers[getRecordPk(row)];
                return (
                <tr
                  key={idx}
                  onClick={() => onSelectRow?.(row)}
                  className={`transition-colors ${onSelectRow ? 'cursor-pointer' : ''} ${marker ? 'bg-[#FFF9ED] hover:bg-[#FEF3D9]' : 'hover:bg-[#F7F8FA]'}`}
                >
                  <td className="py-2 px-3 text-[10px] text-[#8C98A9] font-mono">{idx + 1}</td>
                  {columns.map((col) => {
                    const val = row[col];
                    const category = inferCategory(col, val, tableName);
                    return (
                      <td key={col} className="py-2 px-3 whitespace-nowrap">
                        {formatSqlValue(val, category)}
                      </td>
                    );
                  })}
                  {showChangeMarkers && (
                    <td className="py-2 px-3 whitespace-nowrap">
                      {marker ? (
                        <span className="inline-flex flex-col gap-0.5">
                          <span className={`w-fit px-1.5 py-0.5 rounded border text-[9px] font-bold ${marker.operation_type === 'DELETE' ? 'bg-[#FDF2F2] text-[#B84F52] border-[#F8C8C9]' : 'bg-[#FEF7EC] text-[#A66B16] border-[#F6E0B5]'}`}>
                            {marker.operation_type === 'DELETE' ? 'DELETED' : 'UPDATED'}
                          </span>
                          <span className="text-[10px] text-[#687386]">{marker.changed_columns}</span>
                        </span>
                      ) : <span className="text-[10px] text-[#8C98A9]">Unchanged</span>}
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="p-3.5 rounded-lg bg-[#F3F5F7] border border-[#E2E6EC] font-mono text-xs text-[#202833] overflow-x-auto max-h-96">
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
      <div className="p-3 text-xs text-[#687386] text-center italic">
        No state payload captured for this transaction.
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[#687386] uppercase tracking-wider">
          Column-by-Column SQL Mutation State
        </span>
        <div className="flex items-center space-x-1 bg-[#F0F2F5] border border-[#E2E6EC] p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
              viewMode === 'table' ? 'bg-[#FFFFFF] text-[#4263A5] font-semibold shadow-xs' : 'text-[#687386] hover:text-[#202833]'
            }`}
          >
            SQL Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('json')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
              viewMode === 'json' ? 'bg-[#FFFFFF] text-[#4263A5] font-semibold shadow-xs' : 'text-[#687386] hover:text-[#202833]'
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-lg border border-[#E2E6EC] bg-[#FFFFFF]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F3F5F7] border-b border-[#E2E6EC] text-[10px] font-semibold text-[#687386] uppercase tracking-wider">
                <th className="py-2 px-3 w-1/4">Column</th>
                <th className="py-2 px-3 w-1/3 text-[#B84F52]">Previous State (Before)</th>
                <th className="py-2 px-3 w-1/3 text-[#34765A]">Resulting State (After)</th>
                <th className="py-2 px-3 text-right">Delta Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6EC] font-mono text-[11px]">
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
                    className={isModified ? 'bg-[#EDF3FC]' : 'hover:bg-[#F7F8FA]'}
                  >
                    <td className="py-1.5 px-3 font-semibold text-[#202833]">
                      {col.toUpperCase()}
                    </td>
                    <td className="py-1.5 px-3">
                      {isAdded ? (
                        <span className="text-[#8C98A9] italic text-[10px]">N/A (New Record)</span>
                      ) : (
                        <span className={isModified ? 'text-[#B84F52]' : 'text-[#687386]'}>
                          {formatSqlValue(oldVal, category)}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-3">
                      {isDeleted ? (
                        <span className="text-[#B84F52] italic text-[10px]">TOMBSTONE (Deleted)</span>
                      ) : (
                        <span className={isModified ? 'text-[#34765A] font-bold' : 'text-[#202833]'}>
                          {formatSqlValue(newVal, category)}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      {isModified ? (
                        <span className="px-1.5 py-0.5 rounded bg-[#EDF3FC] text-[#4263A5] border border-[#C8DCF7] text-[9px] font-bold">
                          MODIFIED
                        </span>
                      ) : isAdded ? (
                        <span className="px-1.5 py-0.5 rounded bg-[#EAF3EE] text-[#34765A] border border-[#BDE0CE] text-[9px] font-bold">
                          INSERTED
                        </span>
                      ) : isDeleted ? (
                        <span className="px-1.5 py-0.5 rounded bg-[#FDF2F2] text-[#B84F52] border border-[#F8C8C9] text-[9px] font-bold">
                          DELETED
                        </span>
                      ) : (
                        <span className="text-[#8C98A9] text-[10px]">UNCHANGED</span>
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
          <div className="p-2.5 rounded-lg bg-[#F3F5F7] border border-[#E2E6EC]">
            <span className="text-[10px] text-[#687386] uppercase tracking-wider block mb-1">Old State</span>
            <pre className="font-mono text-[10px] text-[#202833] overflow-x-auto">
              {JSON.stringify(oldValues, null, 2)}
            </pre>
          </div>
          <div className="p-2.5 rounded-lg bg-[#F3F5F7] border border-[#E2E6EC]">
            <span className="text-[10px] text-[#34765A] uppercase tracking-wider block mb-1">New State</span>
            <pre className="font-mono text-[10px] text-[#34765A] overflow-x-auto">
              {JSON.stringify(newValues, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
