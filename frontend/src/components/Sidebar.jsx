import React from 'react';
import { 
  LayoutDashboard, Database, History, GitCommit, 
  GitCompare, Flag, BarChart3, RotateCcw, Settings, Server
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const groups = [
    {
      group: 'Database',
      items: [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'data', label: 'Live Tables', icon: Database },
      ]
    },
    {
      group: 'Time Travel',
      items: [
        { id: 'timetravel', label: 'Point-in-Time', icon: History },
        { id: 'timeline', label: 'Version Timeline', icon: GitCommit },
        { id: 'diff', label: 'Historical Diff', icon: GitCompare },
      ]
    },
    {
      group: 'Performance',
      items: [
        { id: 'checkpoints', label: 'Checkpoints', icon: Flag },
        { id: 'benchmarks', label: 'Benchmarks', icon: BarChart3 },
      ]
    },
    {
      group: 'Operations',
      items: [
        { id: 'restoration', label: 'Restoration Center', icon: RotateCcw },
        { id: 'settings', label: 'Settings & Connection', icon: Settings },
      ]
    }
  ];

  return (
    <aside className="w-56 border-r border-[#E2E6EC] bg-[#F0F2F5] p-3 flex flex-col justify-between shrink-0 min-h-[calc(100vh-3.5rem)] text-xs">
      <div className="space-y-4">
        {groups.map((grp) => (
          <div key={grp.group} className="space-y-1">
            <div className="text-[10px] font-semibold text-[#687386] uppercase tracking-wider px-2 py-0.5">
              {grp.group}
            </div>
            {grp.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-md font-medium transition cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#EDF3FC] text-[#4263A5] font-semibold shadow-xs border-l-3 border-[#4263A5]'
                      : 'text-[#687386] hover:bg-[#E4E8EE] hover:text-[#202833]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#4263A5]' : 'text-[#687386]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Info Box */}
      <div className="p-2.5 rounded-md bg-[#FFFFFF] border border-[#E2E6EC] text-[11px] text-[#687386] space-y-1">
        <div className="flex items-center space-x-1.5 text-[#202833] font-semibold">
          <Server className="w-3 h-3 text-[#4263A5]" />
          <span>Oracle Engine</span>
        </div>
        <p className="text-[10px] leading-relaxed text-[#687386]">
          Workload-aware adaptive checkpointing active.
        </p>
      </div>
    </aside>
  );
}
