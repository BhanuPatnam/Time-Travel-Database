import React, { useState, useEffect } from 'react';
import { BarChart3, Play, Download, Award, Sliders, CheckCircle2 } from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend 
} from 'recharts';
import apiService from '../services/api';

export default function BenchmarkCenterPage() {
  const [workloadSize, setWorkloadSize] = useState('MEDIUM');
  const [readWriteRatio, setReadWriteRatio] = useState(0.7);
  const [running, setRunning] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [pastRuns, setPastRuns] = useState([]);

  useEffect(() => {
    apiService.getBenchmarkHistory().then((runs) => {
      setPastRuns(runs);
      if (runs.length > 0) {
        setBenchmarkResult(runs[0]);
      }
    }).catch(console.error);
  }, []);

  const handleRunBenchmark = async () => {
    setRunning(true);
    try {
      const result = await apiService.runBenchmark({
        workload_size: workloadSize,
        iterations: workloadSize === 'SMALL' ? 15 : (workloadSize === 'MEDIUM' ? 35 : 80),
        read_write_ratio: readWriteRatio,
        include_strategies: ['LOG_ONLY', 'FIXED_INTERVAL', 'ADAPTIVE']
      });
      setBenchmarkResult(result);
      setPastRuns((prev) => [result, ...prev]);
    } catch (err) {
      alert('Benchmark execution failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRunning(false);
    }
  };

  const chartData = benchmarkResult?.comparisons || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Benchmark Center</h2>
        <p className="text-xs text-slate-400">
          Empirical evaluation comparing Log-Only, Fixed-Interval, and Workload-Aware Adaptive Checkpointing
        </p>
      </div>

      {/* Configuration & Controls */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Workload Scale
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['SMALL', 'MEDIUM', 'LARGE'].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setWorkloadSize(size)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition ${
                    workloadSize === size
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {workloadSize === 'SMALL' ? '30 operations' : workloadSize === 'MEDIUM' ? '80 operations' : '200 operations'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">Read / Write Ratio</label>
              <span className="text-xs font-mono text-indigo-400">
                {Math.round(readWriteRatio * 100)}% Read / {Math.round((1 - readWriteRatio) * 100)}% Write
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="0.9"
              step="0.05"
              value={readWriteRatio}
              onChange={(e) => setReadWriteRatio(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800 rounded-lg cursor-pointer"
            />
            <p className="mt-1 text-[11px] text-slate-400">Higher ratio tests read-heavy historical inquiry.</p>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleRunBenchmark}
              disabled={running}
              className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
              <span>{running ? 'Benchmarking Workloads...' : 'Run Benchmark Comparison'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Benchmark Results */}
      {benchmarkResult && (
        <div className="space-y-6">
          {/* Recommendation Banner */}
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 text-xs text-indigo-200 flex items-start space-x-3">
            <Award className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Research Findings &amp; Policy Evaluation</p>
              <p className="mt-1 leading-relaxed text-indigo-300">
                {benchmarkResult.recommendation}
              </p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Reconstruction Latency */}
            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-white mb-1">Reconstruction Latency (ms)</h3>
              <p className="text-xs text-slate-400 mb-4">Lower is better &bull; Avg vs p95 tail latency</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="strategy" stroke="#94a3b8" textAnchor="middle" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="avg_reconstruction_latency_ms" name="Avg Latency (ms)" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="p95_reconstruction_latency_ms" name="p95 Latency (ms)" fill="#c084fc" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Changes Replayed */}
            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-white mb-1">Changes Replayed per Query</h3>
              <p className="text-xs text-slate-400 mb-4">Operations replayed from closest boundary</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="strategy" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="avg_changes_replayed" name="Avg Replayed Changes" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Storage Overhead */}
            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-white mb-1">Storage Footprint (Bytes)</h3>
              <p className="text-xs text-slate-400 mb-4">Materialized checkpoints vs change log</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="strategy" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="checkpoint_storage_bytes" name="Checkpoint Bytes" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="history_storage_bytes" name="Change Log Bytes" fill="#64748b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Normal Write Throughput */}
            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-white mb-1">Write Throughput (TPS)</h3>
              <p className="text-xs text-slate-400 mb-4">Transactions committed per second during workload</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="strategy" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="write_throughput_tps" name="Write TPS" fill="#34d399" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
