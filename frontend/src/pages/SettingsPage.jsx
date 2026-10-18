import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, Sliders, Database } from 'lucide-react';
import apiService from '../services/api';

export default function SettingsPage() {
  const [config, setConfig] = useState({});
  const [storage, setStorage] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiService.getSettings(),
      apiService.getStorageStats(),
    ]).then(([cfg, st]) => {
      setConfig(cfg);
      setStorage(st);
    }).catch(console.error);
  }, []);

  const handleChange = (key, val) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    try {
      for (const [k, v] of Object.entries(config)) {
        await apiService.updateSetting(k, v);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to update settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">System Settings &amp; Policy Tuning</h2>
        <p className="text-xs text-slate-400">
          Configure workload-aware thresholds, retention rules, and storage budget constraints
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Configuration saved and active in reconstruction engine!</span>
        </div>
      )}

      {/* Storage Budget Meter */}
      {storage && (
        <div className="glass-panel p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white">Storage Budget Utilization</span>
            <span className="font-mono text-slate-300">
              {(storage.checkpoint_bytes / 1024).toFixed(1)} KB / {storage.budget_mb} MB ({storage.usage_percentage}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" 
              style={{ width: `${Math.min(storage.usage_percentage, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            When usage exceeds budget, the adaptive engine skips full checkpoint generation to prioritize bounded space.
          </p>
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="glass-panel p-6 rounded-2xl space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Adaptive Change Threshold
            </label>
            <input
              type="number"
              value={config.ADAPTIVE_CHANGE_THRESHOLD || '25'}
              onChange={(e) => handleChange('ADAPTIVE_CHANGE_THRESHOLD', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Minimum committed modifications before evaluating adaptive checkpoint creation.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Replay Cost Threshold (ms)
            </label>
            <input
              type="number"
              step="0.5"
              value={config.ADAPTIVE_REPLAY_COST_THRESHOLD_MS || '12.0'}
              onChange={(e) => handleChange('ADAPTIVE_REPLAY_COST_THRESHOLD_MS', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Estimated historical replay duration in ms above which a checkpoint is triggered.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Historical Query Frequency Threshold
            </label>
            <input
              type="number"
              value={config.ADAPTIVE_QUERY_FREQ_THRESHOLD || '3'}
              onChange={(e) => handleChange('ADAPTIVE_QUERY_FREQ_THRESHOLD', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Observed historical queries in 1-hour window to classify a table as frequently queried.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Fixed Interval Threshold (Operations)
            </label>
            <input
              type="number"
              value={config.FIXED_INTERVAL_CHANGES || '50'}
              onChange={(e) => handleChange('FIXED_INTERVAL_CHANGES', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Interval of operations between checkpoints in Strategy 2.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Storage Budget (MB)
            </label>
            <input
              type="number"
              value={config.STORAGE_BUDGET_MB || '250'}
              onChange={(e) => handleChange('STORAGE_BUDGET_MB', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Total storage ceiling allocated for materialized checkpoint snapshots.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Delta Encoding
            </label>
            <select
              value={config.ENABLE_DELTA_ENCODING || 'Y'}
              onChange={(e) => handleChange('ENABLE_DELTA_ENCODING', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            >
              <option value="Y">Enabled (Store only changed column deltas)</option>
              <option value="N">Disabled (Full row copies on each mutation)</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Preserves changed fields with exact old/new representation.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
          >
            <Save className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
