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
        <h2 className="text-xl font-bold text-[#202833]">Benchmark Center</h2>
        <p className="text-xs text-[#687386]">
          Empirical evaluation comparing Log-Only, Fixed-Interval, and Workload-Aware Adaptive Checkpointing
        </p>
      </div>

      {/* Configuration & Controls */}
      <div className="content-panel p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-[#202833] mb-1.5">
              Workload Scale
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['SMALL', 'MEDIUM', 'LARGE'].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setWorkloadSize(size)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    workloadSize === size
                      ? 'bg-[#4263A5] text-white border-[#4263A5] shadow-xs'
                      : 'bg-[#FFFFFF] text-[#687386] border-[#E2E6EC] hover:text-[#202833] hover:bg-[#F7F8FA]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-[#687386]">
              {workloadSize === 'SMALL' ? '30 operations' : workloadSize === 'MEDIUM' ? '80 operations' : '200 operations'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#202833]">Read / Write Ratio</label>
              <span className="text-xs font-mono text-[#4263A5] font-semibold">
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
              className="w-full accent-[#4263A5] bg-[#E2E6EC] rounded-lg cursor-pointer"
            />
            <p className="mt-1 text-[11px] text-[#687386]">Higher ratio tests read-heavy historical inquiry.</p>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleRunBenchmark}
              disabled={running}
              className="w-full flex items-center justify-center space-x-2 py-3 rounded-lg bg-[#4263A5] hover:bg-[#3977A8] text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
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
          <div className="p-4 rounded-lg bg-[#EDF3FC] border border-[#D0E0F6] text-xs text-[#202833] flex items-start space-x-3">
            <Award className="w-5 h-5 text-[#4263A5] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#4263A5] text-sm">Research Findings &amp; Policy Evaluation</p>
              <p className="mt-1 leading-relaxed text-[#202833]">
                {benchmarkResult.recommendation}
              </p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Reconstruction Latency */}
            <div className="content-panel p-5">
              <h3 className="text-sm font-semibold text-[#202833] mb-1">Reconstruction Latency (ms)</h3>
              <p className="text-xs text-[#687386] mb-4">Lower is better &bull; Avg vs p95 tail latency</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EC" />
                    <XAxis dataKey="strategy" stroke="#687386" textAnchor="middle" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#687386" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E6EC', borderRadius: '8px', fontSize: '11px', color: '#202833', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="avg_reconstruction_latency_ms" name="Avg Latency (ms)" fill="#4263A5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="p95_reconstruction_latency_ms" name="p95 Latency (ms)" fill="#7955A1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Changes Replayed */}
            <div className="content-panel p-5">
              <h3 className="text-sm font-semibold text-[#202833] mb-1">Changes Replayed per Query</h3>
              <p className="text-xs text-[#687386] mb-4">Operations replayed from closest boundary</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EC" />
                    <XAxis dataKey="strategy" stroke="#687386" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#687386" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E6EC', borderRadius: '8px', fontSize: '11px', color: '#202833', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="avg_changes_replayed" name="Avg Replayed Changes" fill="#3977A8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Storage Overhead */}
            <div className="content-panel p-5">
              <h3 className="text-sm font-semibold text-[#202833] mb-1">Storage Footprint (Bytes)</h3>
              <p className="text-xs text-[#687386] mb-4">Materialized checkpoints vs change log</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EC" />
                    <XAxis dataKey="strategy" stroke="#687386" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#687386" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E6EC', borderRadius: '8px', fontSize: '11px', color: '#202833', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="checkpoint_storage_bytes" name="Checkpoint Bytes" fill="#B84F52" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="history_storage_bytes" name="Change Log Bytes" fill="#687386" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Normal Write Throughput */}
            <div className="content-panel p-5">
              <h3 className="text-sm font-semibold text-[#202833] mb-1">Write Throughput (TPS)</h3>
              <p className="text-xs text-[#687386] mb-4">Transactions committed per second during workload</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EC" />
                    <XAxis dataKey="strategy" stroke="#687386" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#687386" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E6EC', borderRadius: '8px', fontSize: '11px', color: '#202833', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="write_throughput_tps" name="Write TPS" fill="#34765A" radius={[4, 4, 0, 0]} />
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
