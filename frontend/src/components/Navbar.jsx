import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Navbar({ dbStatus, activeTab = 'dashboard', onRefresh }) {
  const isConnected = dbStatus?.database_connected || false;
  const dbType = dbStatus?.database_type || (isConnected ? 'Oracle Database 21c XE' : 'Oracle Offline / Dev Fallback');
  const [lastRefreshed, setLastRefreshed] = useState(new Date().toLocaleTimeString());
  const [refreshing, setRefreshing] = useState(false);

  const tabTitles = {
    dashboard: 'Database / Overview',
    data: 'Database / Live Tables',
    timetravel: 'Time Travel / Point-in-Time Explorer',
    timeline: 'Time Travel / Version Timeline',
    diff: 'Time Travel / Historical Diff',
    checkpoints: 'Performance / Checkpoints & Policy',
    benchmarks: 'Performance / Benchmarks',
    restoration: 'Operations / Restoration Center',
    settings: 'Operations / Settings & Connection',
  };

  const handleRefreshClick = async () => {
    setRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    setLastRefreshed(new Date().toLocaleTimeString());
    setTimeout(() => setRefreshing(false), 300);
  };

  return (
    <header className="h-14 border-b border-[#E2E6EC] bg-[#FFFFFF] sticky top-0 z-40 px-6 flex items-center justify-between">
      {/* Breadcrumb / Title */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-[#4263A5]" />
          <span className="font-semibold text-sm text-[#202833]">Time Travel DB</span>
        </div>
        <span className="text-[#CBD5E1]">/</span>
        <span className="text-xs font-medium text-[#687386]">
          {tabTitles[activeTab] || 'Console'}
        </span>
      </div>

      {/* Right Controls: Refresh & Oracle Connection Status */}
      <div className="flex items-center space-x-3">
        <div className="hidden md:flex items-center space-x-1.5 text-xs text-[#687386]">
          <span>Updated:</span>
          <span className="font-mono text-[#202833]">{lastRefreshed}</span>
        </div>

        <button
          onClick={handleRefreshClick}
          disabled={refreshing}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#F0F2F5] hover:bg-[#E4E8EE] text-[#202833] text-xs font-medium border border-[#E2E6EC] transition cursor-pointer"
          title="Refresh current state"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#687386] ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>

        {/* Oracle connection indicator */}
        <div className="flex items-center space-x-2 px-2.5 py-1 rounded-md bg-[#F0F2F5] border border-[#E2E6EC] text-xs">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#34765A]' : 'bg-[#A66B16]'}`} />
          <span className="font-mono text-[11px] font-medium text-[#202833]">
            {isConnected ? 'Oracle 21c (Connected)' : 'Dev Fallback (Offline)'}
          </span>
        </div>
      </div>
    </header>
  );
}
