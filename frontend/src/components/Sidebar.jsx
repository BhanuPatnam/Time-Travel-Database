import React from 'react';
import { 
  LayoutDashboard, Database, History, GitCommit, 
  GitCompare, Flag, BarChart3, RotateCcw, Settings 
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'data', label: 'Current Data', icon: Database },
    { id: 'timetravel', label: 'Time Travel', icon: History },
    { id: 'timeline', label: 'Version Timeline', icon: GitCommit },
    { id: 'diff', label: 'Historical Diff', icon: GitCompare },
    { id: 'checkpoints', label: 'Checkpoints', icon: Flag },
    { id: 'benchmarks', label: 'Benchmark Center', icon: BarChart3 },
    { id: 'restoration', label: 'Restoration', icon: RotateCcw },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur p-4 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <nav className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Engine Workspaces
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs text-slate-400">
        <p className="font-semibold text-slate-300">Workload-Aware Policy</p>
        <p className="mt-1 text-[11px] leading-relaxed">
          Dynamic cost evaluation balancing storage vs reconstruction latency.
        </p>
      </div>
    </aside>
  );
}
