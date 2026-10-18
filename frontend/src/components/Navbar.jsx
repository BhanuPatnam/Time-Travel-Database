import React from 'react';
import { Database, Clock, Activity, ShieldCheck, Server } from 'lucide-react';

export default function Navbar({ dbStatus }) {
  const isConnected = dbStatus?.database_connected || false;
  const dbType = dbStatus?.database_type || 'Connecting...';

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-6 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
          <Clock className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h1 className="text-base font-bold bg-gradient-to-r from-indigo-200 via-white to-slate-300 bg-clip-text text-transparent">
            Time Travel Database
          </h1>
          <p className="text-xs text-slate-400">
            Adaptive Checkpointing &amp; Historical Reconstruction Engine
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Connection status pill */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-amber-400 shadow-sm shadow-amber-400'}`} />
          <Server className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-200 font-medium">{dbType}</span>
        </div>

        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-300 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Oracle 21c XE Engine</span>
        </div>
      </div>
    </header>
  );
}
