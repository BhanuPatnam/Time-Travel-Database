import React, { useState, useEffect } from 'react';
import {
  GitBranch, GitCommit, GitMerge, GitCompare, Plus, Trash2, 
  Search, Check, AlertCircle, ArrowRight, RefreshCw, ZoomIn, 
  ZoomOut, Maximize2, Shield, Eye, Layers, User, Calendar, 
  Tag, Clock, Database, ChevronRight, X, AlertTriangle, CheckCircle2
} from 'lucide-react';
import apiService from '../services/api';

const BRANCH_COLORS = [
  '#4263A5', // Main / Core (Theme Primary)
  '#0D8A5B', // Feature (Theme Emerald)
  '#7C3AED', // Subfeature (Violet)
  '#D97706', // Experiments (Amber)
  '#0284C7', // Bugfix (Sky)
  '#E11D48', // Hotfix (Rose)
  '#059669', // Staging (Teal)
  '#475569'  // Archive (Slate)
];

export default function BranchingPage() {
  // Primary state
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranch] = useState('main');
  const [commits, setCommits] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [timelineData, setTimelineData] = useState({ branches: [], nodes: [], links: [] });
  const [branchState, setBranchState] = useState([]);
  const [activeStateTable, setActiveStateTable] = useState('CUSTOMERS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // View mode: 'graph' | 'commits' | 'state'
  const [centerView, setCenterView] = useState('graph');
  const [searchQuery, setSearchQuery] = useState('');

  // Graph zoom/pan state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    branch_name: '',
    parent_branch_name: 'main',
    origin_type: 'HEAD', // 'HEAD' | 'TIMESTAMP' | 'COMMIT'
    base_timestamp: '',
    base_commit_id: '',
    description: '',
    created_by: 'developer'
  });

  const [commitForm, setCommitForm] = useState({
    table_name: 'CUSTOMERS',
    record_id: '101',
    operation_type: 'UPDATE',
    commit_message: '',
    author: 'developer',
    // Customer fields
    name: 'Acme Industrial Corp',
    email: 'procurement@acmeind.com',
    phone: '+1-555-0101',
    status: 'ACTIVE',
    credit_limit: 75000.0,
    // Product fields
    sku: 'SKU-SRV-01',
    category: 'Hardware',
    unit_price: 4250.0,
    stock_quantity: 35
  });

  const [compareForm, setCompareForm] = useState({
    base_branch: 'main',
    compare_branch: ''
  });
  const [compareResult, setCompareResult] = useState(null);

  const [mergeForm, setMergeForm] = useState({
    source_branch: '',
    target_branch: 'main',
    merge_message: ''
  });
  const [mergeResult, setMergeResult] = useState(null);
  const [pendingResolutions, setPendingResolutions] = useState({});

  // 1. Initial Load
  useEffect(() => {
    loadBranches();
  }, []);

  // 2. When active branch changes
  useEffect(() => {
    if (activeBranch) {
      loadBranchDetails(activeBranch);
    }
  }, [activeBranch]);

  const showToast = (msg, isErr = false) => {
    if (isErr) {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const loadBranches = async () => {
    try {
      setLoading(true);
      const data = await apiService.getBranches();
      setBranches(data);
      if (!data.find(b => b.branch_name === activeBranch) && data.length > 0) {
        setActiveBranch(data[0].branch_name);
      }
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const loadBranchDetails = async (bName) => {
    try {
      const [commitsData, timeline, stateData] = await Promise.all([
        apiService.getBranchCommits(bName),
        apiService.getBranchTimeline(bName),
        apiService.getBranchState(bName, '__ALL__')
      ]);
      setCommits(commitsData);
      setTimelineData(timeline);
      setBranchState(stateData.records || []);
      if (commitsData.length > 0 && !selectedCommit) {
        setSelectedCommit(commitsData[0]);
      }
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    }
  };

  // --- ACTIONS ---

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!createForm.branch_name.trim()) {
      showToast('Branch name is required', true);
      return;
    }
    try {
      setLoading(true);
      const payload = {
        branch_name: createForm.branch_name.trim(),
        parent_branch_name: createForm.parent_branch_name,
        description: createForm.description,
        created_by: createForm.created_by,
        base_timestamp: createForm.origin_type === 'TIMESTAMP' ? createForm.base_timestamp : null,
        base_commit_id: createForm.origin_type === 'COMMIT' ? createForm.base_commit_id : null,
      };
      const newB = await apiService.createBranch(payload);
      showToast(`Branch '${newB.branch_name}' created successfully!`);
      setShowCreateModal(false);
      setCreateForm({
        branch_name: '', parent_branch_name: 'main', origin_type: 'HEAD',
        base_timestamp: '', base_commit_id: '', description: '', created_by: 'developer'
      });
      await loadBranches();
      setActiveBranch(newB.branch_name);
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = async (branchId, branchName) => {
    if (!window.confirm(`Are you sure you want to delete branch '${branchName}'?`)) return;
    try {
      setLoading(true);
      await apiService.deleteBranch(branchId);
      showToast(`Branch '${branchName}' deleted.`);
      await loadBranches();
      setActiveBranch('main');
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleCommitSubmit = async (e) => {
    e.preventDefault();
    if (!commitForm.commit_message.trim()) {
      showToast('Commit message is required', true);
      return;
    }
    try {
      setLoading(true);
      const afterValues = commitForm.table_name === 'CUSTOMERS' ? {
        customer_id: Number(commitForm.record_id),
        name: commitForm.name,
        email: commitForm.email,
        phone: commitForm.phone,
        status: commitForm.status,
        credit_limit: parseFloat(commitForm.credit_limit)
      } : {
        product_id: Number(commitForm.record_id),
        sku: commitForm.sku,
        name: commitForm.name,
        category: commitForm.category,
        unit_price: parseFloat(commitForm.unit_price),
        stock_quantity: parseInt(commitForm.stock_quantity, 10)
      };

      const changeItem = {
        table_name: commitForm.table_name,
        record_id: String(commitForm.record_id),
        operation_type: commitForm.operation_type,
        after_values: commitForm.operation_type === 'DELETE' ? null : afterValues,
        before_values: null
      };

      const res = await apiService.createBranchCommit(activeBranch, {
        commit_message: commitForm.commit_message.trim(),
        author: commitForm.author || 'developer',
        changes: [changeItem]
      });

      showToast(`Commit '${res.commit_id}' recorded on branch '${activeBranch}'!`);
      setShowCommitModal(false);
      setCommitForm(prev => ({ ...prev, commit_message: '' }));
      await loadBranchDetails(activeBranch);
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!compareForm.compare_branch) {
      showToast('Please select a compare branch', true);
      return;
    }
    try {
      setLoading(true);
      const res = await apiService.compareBranches(compareForm.base_branch, compareForm.compare_branch);
      setCompareResult(res);
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleMergeSubmit = async () => {
    if (!mergeForm.source_branch) {
      showToast('Please select a source branch to merge', true);
      return;
    }
    try {
      setLoading(true);
      const res = await apiService.mergeBranches({
        source_branch: mergeForm.source_branch,
        target_branch: mergeForm.target_branch,
        merge_message: mergeForm.merge_message || `Merge branch '${mergeForm.source_branch}' into '${mergeForm.target_branch}'`
      });
      setMergeResult(res);

      if (res.status === 'SUCCESS') {
        showToast(`Merged successfully! Commit: ${res.merge_commit_id}`);
        await loadBranches();
        await loadBranchDetails(activeBranch);
      } else if (res.status === 'CONFLICT') {
        const initialResolutions = {};
        res.conflicts.forEach(c => {
          const key = `${c.table_name}:${c.record_id}`;
          initialResolutions[key] = {
            table_name: c.table_name,
            record_id: c.record_id,
            chosen_source: 'source',
            resolved_values: c.source_values || c.target_values
          };
        });
        setPendingResolutions(initialResolutions);
      }
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveConflicts = async () => {
    if (!mergeResult || !mergeResult.merge_id) return;
    try {
      setLoading(true);
      const resolutionsList = Object.values(pendingResolutions).map(r => ({
        table_name: r.table_name,
        record_id: r.record_id,
        operation_type: 'UPDATE',
        resolved_values: r.resolved_values
      }));

      const res = await apiService.resolveMergeConflict(mergeResult.merge_id, {
        resolutions: resolutionsList,
        author: 'developer'
      });

      showToast(`Conflicts resolved! Merge Commit: ${res.merge_commit_id}`);
      setShowMergeModal(false);
      setMergeResult(null);
      await loadBranches();
      await loadBranchDetails(activeBranch);
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleAbortMerge = async () => {
    if (!mergeResult || !mergeResult.merge_id) return;
    try {
      await apiService.abortMerge(mergeResult.merge_id);
      showToast('Merge aborted.');
      setShowMergeModal(false);
      setMergeResult(null);
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    }
  };

  // --- GRAPH RENDERING ---
  const nodes = timelineData.nodes || [];
  const links = timelineData.links || [];

  // Graph geometry
  const X_SPACING = 140;
  const Y_SPACING = 60;
  const PADDING_X = 70;
  const PADDING_Y = 50;

  const positionedNodes = nodes.map((n, idx) => {
    const x = PADDING_X + idx * X_SPACING;
    const y = PADDING_Y + n.lane * Y_SPACING;
    return { ...n, x, y };
  });
  const posMap = new Map(positionedNodes.map(n => [n.commit_id, n]));

  const graphWidth = Math.max(900, PADDING_X * 2 + nodes.length * X_SPACING);
  const maxLane = Math.max(1, ...nodes.map(n => n.lane || 0));
  const graphHeight = Math.max(260, PADDING_Y * 2 + (maxLane + 1) * Y_SPACING);

  const filteredBranches = branches.filter(b => 
    b.branch_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 1. TOP PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-[#202833]">Temporal Branching & Merge Engine</h2>
            <span className="px-2 py-0.5 rounded-full bg-[#EDF3FC] border border-[#D0E0F6] text-[#4263A5] text-[10px] font-semibold uppercase tracking-wider">
              SQL Git-Engine
            </span>
          </div>
          <p className="text-xs text-[#687386] mt-0.5">
            Isolated branch workspaces, immutable commit DAG graph, copy-on-write changesets, and 3-way conflict resolution
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Branch Pill & Selector */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#FFFFFF] rounded-lg border border-[#E2E6EC] shadow-xs">
            <GitBranch className="w-3.5 h-3.5 text-[#4263A5]" />
            <select
              value={activeBranch}
              onChange={(e) => setActiveBranch(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#202833] focus:outline-none cursor-pointer pr-1"
            >
              {branches.map(b => (
                <option key={b.branch_id} value={b.branch_name}>
                  {b.branch_name} {b.is_default === 'Y' ? '(main)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setCreateForm(prev => ({ ...prev, parent_branch_name: activeBranch }));
              setShowCreateModal(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#4263A5] hover:bg-[#345188] text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Branch</span>
          </button>

          <button
            onClick={() => setShowCommitModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#202833] rounded-lg text-xs font-semibold border border-[#E2E6EC] transition cursor-pointer shadow-xs"
          >
            <GitCommit className="w-3.5 h-3.5 text-[#D97706]" />
            <span>Commit Change</span>
          </button>

          <button
            onClick={() => {
              setCompareForm({ base_branch: 'main', compare_branch: activeBranch });
              setShowCompareModal(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#202833] rounded-lg text-xs font-semibold border border-[#E2E6EC] transition cursor-pointer shadow-xs"
          >
            <GitCompare className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>Compare</span>
          </button>

          <button
            onClick={() => {
              setMergeForm({ source_branch: activeBranch, target_branch: 'main', merge_message: '' });
              setMergeResult(null);
              setShowMergeModal(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0D8A5B] hover:bg-[#0A7049] text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Merge Engine</span>
          </button>
        </div>
      </div>

      {/* TOAST ALERTS */}
      {error && (
        <div className="px-4 py-3 bg-[#FCE8E6] border border-[#FAD2CF] text-[#C5221F] rounded-lg text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-[#C5221F] shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)}><X className="w-4 h-4 text-[#C5221F] cursor-pointer" /></button>
        </div>
      )}
      {successMsg && (
        <div className="px-4 py-3 bg-[#E6F4EA] border border-[#CEEAD6] text-[#0D8A5B] rounded-lg text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#0D8A5B] shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}><X className="w-4 h-4 text-[#0D8A5B] cursor-pointer" /></button>
        </div>
      )}

      {/* 2. THREE-PANEL WORKSPACE CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT PANEL: Branches Directory (3 cols) */}
        <div className="lg:col-span-3 content-panel p-4 flex flex-col space-y-3 bg-[#FFFFFF] border border-[#E2E6EC] rounded-xl shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E6EC]">
            <h3 className="text-xs font-bold text-[#202833] uppercase tracking-wider flex items-center space-x-1.5">
              <GitBranch className="w-3.5 h-3.5 text-[#4263A5]" />
              <span>Branches ({branches.length})</span>
            </h3>
            <span className="text-[10px] font-semibold text-[#687386] bg-[#F0F2F5] px-2 py-0.5 rounded-full">
              Isolated
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#687386] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-xs text-[#202833] placeholder-[#687386] focus:border-[#4263A5] outline-none"
            />
          </div>

          <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
            {filteredBranches.map(b => {
              const isSelected = b.branch_name === activeBranch;
              return (
                <div
                  key={b.branch_id}
                  onClick={() => setActiveBranch(b.branch_name)}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition cursor-pointer border ${
                    isSelected
                      ? 'bg-[#EDF3FC] border-[#D0E0F6] text-[#4263A5] font-semibold shadow-xs'
                      : 'bg-[#FFFFFF] border-transparent text-[#202833] hover:bg-[#F7F8FA] hover:border-[#E2E6EC]'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <GitBranch className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#4263A5]' : 'text-[#687386]'}`} />
                    <span className="truncate">{b.branch_name}</span>
                    {b.is_default === 'Y' && (
                      <span className="text-[10px] bg-[#EDF3FC] text-[#4263A5] px-1.5 py-0.2 rounded font-mono font-medium">
                        main
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <span className="text-[11px] font-mono text-[#687386]">{b.commit_count} commits</span>
                    {b.is_default !== 'Y' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBranch(b.branch_id, b.branch_name);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-[#C5221F] transition p-0.5 cursor-pointer"
                        title="Delete branch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Left Footer Summary */}
          <div className="pt-3 border-t border-[#E2E6EC] text-[11px] text-[#687386] space-y-1">
            <div className="flex justify-between items-center">
              <span>Active Workspace:</span>
              <span className="font-mono text-[#4263A5] font-semibold truncate max-w-[120px]">{activeBranch}</span>
            </div>
            <div className="flex items-center space-x-1 text-[10px] text-[#0D8A5B] pt-1">
              <Shield className="w-3 h-3 text-[#0D8A5B]" />
              <span>Production Main Protected (COW)</span>
            </div>
          </div>
        </div>

        {/* CENTER PANEL: Dynamic Workspace (6 cols) */}
        <div className="lg:col-span-6 content-panel flex flex-col bg-[#FFFFFF] border border-[#E2E6EC] rounded-xl shadow-xs overflow-hidden">
          
          {/* Subheader: View Selector & Tooling */}
          <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-[#E2E6EC] bg-[#F7F8FA]">
            <div className="flex items-center space-x-1 bg-[#FFFFFF] p-0.5 rounded-lg border border-[#E2E6EC] shadow-xs text-xs">
              <button
                onClick={() => setCenterView('graph')}
                className={`px-3 py-1 rounded-md transition cursor-pointer font-medium ${
                  centerView === 'graph' ? 'bg-[#4263A5] text-white shadow-xs' : 'text-[#687386] hover:text-[#202833]'
                }`}
              >
                Commit Graph
              </button>
              <button
                onClick={() => setCenterView('commits')}
                className={`px-3 py-1 rounded-md transition cursor-pointer font-medium ${
                  centerView === 'commits' ? 'bg-[#4263A5] text-white shadow-xs' : 'text-[#687386] hover:text-[#202833]'
                }`}
              >
                Commits ({commits.length})
              </button>
              <button
                onClick={() => setCenterView('state')}
                className={`px-3 py-1 rounded-md transition cursor-pointer font-medium ${
                  centerView === 'state' ? 'bg-[#4263A5] text-white shadow-xs' : 'text-[#687386] hover:text-[#202833]'
                }`}
              >
                Branch Rows ({branchState.length})
              </button>
            </div>

            {/* View specific controls */}
            {centerView === 'graph' && (
              <div className="flex items-center space-x-1 text-[#687386]">
                <button
                  onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 2.0))}
                  className="p-1 hover:text-[#202833] hover:bg-[#E4E8EE] rounded cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.6))}
                  className="p-1 hover:text-[#202833] hover:bg-[#E4E8EE] rounded cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
                  className="p-1 hover:text-[#202833] hover:bg-[#E4E8EE] rounded cursor-pointer"
                  title="Reset Zoom"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {centerView === 'state' && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-[#687386]">Table:</span>
                <select
                  value={activeStateTable}
                  onChange={(e) => setActiveStateTable(e.target.value)}
                  className="bg-[#FFFFFF] text-xs text-[#202833] font-medium rounded px-2 py-1 border border-[#E2E6EC] focus:border-[#4263A5] outline-none"
                >
                  <option value="CUSTOMERS">CUSTOMERS</option>
                  <option value="PRODUCTS">PRODUCTS</option>
                  <option value="ORDERS">ORDERS</option>
                  <option value="__ALL__">ALL TABLES</option>
                </select>
              </div>
            )}
          </div>

          {/* VIEW CONTENT */}
          <div className="min-h-[460px] max-h-[520px] overflow-auto relative bg-[#FAFAFC]">
            
            {/* VIEW A: INTERACTIVE SVG COMMIT GRAPH */}
            {centerView === 'graph' && (
              <div
                className="w-full h-full min-h-[460px] overflow-auto p-4 cursor-grab active:cursor-grabbing select-none"
                onMouseDown={(e) => {
                  setIsDragging(true);
                  setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
                }}
                onMouseMove={(e) => {
                  if (isDragging) {
                    setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                  }
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                <svg
                  width={graphWidth}
                  height={graphHeight}
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                    transformOrigin: 'top left',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                  }}
                  className="overflow-visible"
                >
                  {/* Lane Guide Lines */}
                  {timelineData.branches.map((b, idx) => {
                    const y = PADDING_Y + idx * Y_SPACING;
                    const color = BRANCH_COLORS[idx % BRANCH_COLORS.length];
                    return (
                      <g key={b.branch_id}>
                        <line
                          x1={20}
                          y1={y}
                          x2={graphWidth - 20}
                          y2={y}
                          stroke="#E2E6EC"
                          strokeDasharray="4 4"
                          strokeWidth="1.5"
                        />
                        <text
                          x={25}
                          y={y - 8}
                          fill={color}
                          fontSize="11"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {b.branch_name}
                        </text>
                      </g>
                    );
                  })}

                  {/* Connectors (Links) */}
                  {links.map((link, idx) => {
                    const source = posMap.get(link.source);
                    const target = posMap.get(link.target);
                    if (!source || !target) return null;

                    const isMerge = link.type === 'merge';
                    const strokeColor = isMerge ? '#0D8A5B' : (target.color || '#4263A5');

                    // Cubic Bezier curved path
                    const dx = target.x - source.x;
                    const pathData = `
                      M ${source.x} ${source.y}
                      C ${source.x + dx * 0.5} ${source.y},
                        ${source.x + dx * 0.5} ${target.y},
                        ${target.x} ${target.y}
                    `;

                    return (
                      <path
                        key={`link-${idx}`}
                        d={pathData}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isMerge ? '2.5' : '2'}
                        strokeDasharray={isMerge ? '4 4' : 'none'}
                        opacity="0.85"
                      />
                    );
                  })}

                  {/* Commit Nodes */}
                  {positionedNodes.map((n) => {
                    const isSelected = selectedCommit?.commit_id === n.commit_id;
                    const isMerge = n.commit_type === 'MERGE' || n.commit_type === 'FAST_FORWARD';
                    const nodeColor = isMerge ? '#0D8A5B' : (n.color || '#4263A5');

                    return (
                      <g
                        key={n.commit_id}
                        transform={`translate(${n.x}, ${n.y})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCommit(n);
                        }}
                        className="cursor-pointer group"
                      >
                        {/* Outer Glow on selection */}
                        {isSelected && (
                          <circle
                            r="15"
                            fill="none"
                            stroke={nodeColor}
                            strokeWidth="2.5"
                            strokeDasharray="3 3"
                            opacity="0.9"
                          />
                        )}

                        {/* Node Circle */}
                        <circle
                          r={isMerge ? "9" : "7"}
                          fill="#FFFFFF"
                          stroke={nodeColor}
                          strokeWidth={isSelected ? "3" : "2.5"}
                          className="transition-all hover:scale-125"
                        />

                        {isMerge && (
                          <circle r="3.5" fill="#0D8A5B" />
                        )}

                        {/* Commit ID Label */}
                        <text
                          y="-13"
                          textAnchor="middle"
                          fill={isSelected ? '#202833' : '#687386'}
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight={isSelected ? 'bold' : 'normal'}
                        >
                          {n.commit_id}
                        </text>

                        {/* Commit Message Label */}
                        <text
                          y="22"
                          textAnchor="middle"
                          fill="#475569"
                          fontSize="9.5"
                          fontWeight="500"
                        >
                          {n.commit_message.length > 18 ? n.commit_message.substring(0, 16) + '...' : n.commit_message}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            {/* VIEW B: CHRONOLOGICAL COMMIT HISTORY */}
            {centerView === 'commits' && (
              <div className="p-4 space-y-2.5">
                {commits.map(c => {
                  const isSelected = selectedCommit?.commit_id === c.commit_id;
                  const isMerge = c.commit_type === 'MERGE' || c.commit_type === 'FAST_FORWARD';
                  return (
                    <div
                      key={c.commit_id}
                      onClick={() => setSelectedCommit(c)}
                      className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#EDF3FC] border-[#D0E0F6] shadow-xs'
                          : 'bg-[#FFFFFF] border-[#E2E6EC] hover:bg-[#F7F8FA]'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg mt-0.5 ${isMerge ? 'bg-[#E6F4EA] text-[#0D8A5B]' : 'bg-[#EDF3FC] text-[#4263A5]'}`}>
                          {isMerge ? <GitMerge className="w-4 h-4" /> : <GitCommit className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm text-[#202833]">{c.commit_message}</span>
                            <span className="text-[10px] font-mono bg-[#F0F2F5] text-[#202833] px-1.5 py-0.5 rounded font-semibold border border-[#E2E6EC]">
                              {c.commit_id}
                            </span>
                            {isMerge && (
                              <span className="text-[10px] bg-[#E6F4EA] text-[#0D8A5B] px-1.5 py-0.5 rounded font-mono font-semibold border border-[#CEEAD6]">
                                {c.commit_type}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-[#687386] mt-1">
                            <span className="flex items-center space-x-1">
                              <User className="w-3 h-3 text-[#687386]" />
                              <span>{c.author}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-[#687386]" />
                              <span>{new Date(c.commit_timestamp).toLocaleTimeString()}</span>
                            </span>
                            {c.changeset_count > 0 && (
                              <span className="text-[#D97706] font-mono text-[11px] font-semibold">
                                {c.changeset_count} mutation(s)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-[#687386]" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW C: BRANCH STATE ROW EXPLORER */}
            {centerView === 'state' && (
              <div className="p-4">
                <div className="rounded-lg border border-[#E2E6EC] overflow-hidden bg-[#FFFFFF] shadow-xs">
                  <table className="w-full text-left text-xs text-[#202833]">
                    <thead className="bg-[#F7F8FA] text-[11px] uppercase tracking-wider text-[#687386] border-b border-[#E2E6EC]">
                      <tr>
                        <th className="px-3.5 py-2.5 font-semibold">Workspace</th>
                        <th className="px-3.5 py-2.5 font-semibold">Key</th>
                        <th className="px-3.5 py-2.5 font-semibold">Name / Sku</th>
                        <th className="px-3.5 py-2.5 font-semibold">Status / Price</th>
                        <th className="px-3.5 py-2.5 font-semibold">Credit / Stock</th>
                        <th className="px-3.5 py-2.5 font-semibold">Relation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E6EC]">
                      {branchState
                        .filter(r => activeStateTable === '__ALL__' || (r._table || 'CUSTOMERS') === activeStateTable)
                        .map((row, idx) => {
                          const pk = row.customer_id || row.product_id || row.order_id || row.item_id || idx;
                          return (
                            <tr key={idx} className="hover:bg-[#F9FAFB]">
                              <td className="px-3.5 py-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#EDF3FC] text-[#4263A5] border border-[#D0E0F6]">
                                  Branch Isolated
                                </span>
                              </td>
                              <td className="px-3.5 py-2 font-mono font-bold text-[#202833]">{pk}</td>
                              <td className="px-3.5 py-2 font-medium">{row.name || row.sku || '-'}</td>
                              <td className="px-3.5 py-2 font-mono">
                                {row.status ? (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    row.status === 'ACTIVE' ? 'bg-[#E6F4EA] text-[#0D8A5B] border border-[#CEEAD6]' : 'bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF]'
                                  }`}>
                                    {row.status}
                                  </span>
                                ) : (
                                  row.unit_price ? `$${row.unit_price}` : '-'
                                )}
                              </td>
                              <td className="px-3.5 py-2 font-mono text-[#687386]">
                                {row.credit_limit ? `$${row.credit_limit.toLocaleString()}` : (row.stock_quantity ?? '-')}
                              </td>
                              <td className="px-3.5 py-2">
                                <span className="text-[10px] font-mono font-semibold text-[#687386]">
                                  {row._table || 'CUSTOMERS'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Selected Commit Inspector (3 cols) */}
        <div className="lg:col-span-3 content-panel p-4 flex flex-col space-y-3 bg-[#FFFFFF] border border-[#E2E6EC] rounded-xl shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E6EC]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#202833] flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-[#4263A5]" />
              <span>Commit Inspector</span>
            </h3>
            <span className="text-[10px] font-mono font-semibold text-[#687386] bg-[#F0F2F5] px-2 py-0.5 rounded-full">
              Audit Node
            </span>
          </div>

          {selectedCommit ? (
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <span className="text-[#687386] text-[11px] font-medium">Commit Message</span>
                <p className="text-sm font-bold text-[#202833] leading-snug">
                  {selectedCommit.commit_message}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC]">
                <div>
                  <span className="text-[#687386] block text-[10px]">Hash</span>
                  <span className="font-mono text-[#4263A5] font-bold">{selectedCommit.commit_id}</span>
                </div>
                <div>
                  <span className="text-[#687386] block text-[10px]">Type</span>
                  <span className="font-mono text-[#202833] font-semibold">{selectedCommit.commit_type}</span>
                </div>
                <div>
                  <span className="text-[#687386] block text-[10px]">Author</span>
                  <span className="text-[#202833] font-medium">{selectedCommit.author}</span>
                </div>
                <div>
                  <span className="text-[#687386] block text-[10px]">Parent</span>
                  <span className="font-mono text-[#687386]">{selectedCommit.parent_commit_id || 'root'}</span>
                </div>
              </div>

              {selectedCommit.merge_parent_commit_id && (
                <div className="p-2 rounded bg-[#E6F4EA] border border-[#CEEAD6] text-[11px] text-[#0D8A5B] font-semibold">
                  <span>Merge Parent: </span>
                  <span className="font-mono">{selectedCommit.merge_parent_commit_id}</span>
                </div>
              )}

              {/* Changeset Breakdown */}
              <div className="space-y-2 pt-1 border-t border-[#E2E6EC]">
                <span className="text-[#687386] text-[11px] font-bold uppercase tracking-wider block">
                  Mutated Records ({selectedCommit.changes?.length || 0})
                </span>

                {selectedCommit.changes && selectedCommit.changes.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedCommit.changes.map((cs, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC] space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-[#202833]">
                            {cs.table_name} #{cs.record_id}
                          </span>
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${
                            cs.operation_type === 'INSERT' ? 'bg-[#E6F4EA] text-[#0D8A5B] border border-[#CEEAD6]' :
                            cs.operation_type === 'DELETE' ? 'bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF]' :
                            'bg-[#FEF3D6] text-[#B06000] border border-[#FEE3A2]'
                          }`}>
                            {cs.operation_type}
                          </span>
                        </div>

                        {cs.changed_columns && (
                          <div className="text-[10px] text-[#687386]">
                            <span>Columns: </span>
                            <span className="font-mono font-semibold text-[#202833]">{cs.changed_columns}</span>
                          </div>
                        )}

                        {cs.after_values && (
                          <div className="mt-1">
                            <span className="text-[10px] text-[#687386] block">State Values:</span>
                            <pre className="p-2 bg-[#FFFFFF] rounded text-[10px] font-mono text-[#0D8A5B] overflow-x-auto border border-[#E2E6EC]">
                              {JSON.stringify(cs.after_values, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-[#687386] bg-[#F7F8FA] rounded-lg border border-[#E2E6EC] text-xs">
                    Initial root checkpoint or zero mutations in this commit.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-[#687386] text-xs">
              Select any commit circle from the visual DAG graph to inspect mutations.
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: CREATE NEW BRANCH
      ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#E2E6EC] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#E2E6EC] pb-3">
              <h3 className="font-bold text-[#202833] text-sm flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-[#4263A5]" />
                <span>Create Temporal Branch</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)}><X className="w-4 h-4 text-[#687386] hover:text-[#202833] cursor-pointer" /></button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#202833] font-semibold mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. experiment/pricing-v2"
                  value={createForm.branch_name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, branch_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] focus:border-[#4263A5] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#202833] font-semibold mb-1">Parent Branch</label>
                <select
                  value={createForm.parent_branch_name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, parent_branch_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] focus:border-[#4263A5] outline-none cursor-pointer"
                >
                  {branches.map(b => (
                    <option key={b.branch_id} value={b.branch_name}>{b.branch_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#202833] font-semibold mb-1">Branch Origin Point</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm(prev => ({ ...prev, origin_type: 'HEAD' }))}
                    className={`p-2 rounded-lg text-center border font-semibold cursor-pointer text-xs transition ${
                      createForm.origin_type === 'HEAD'
                        ? 'bg-[#EDF3FC] border-[#D0E0F6] text-[#4263A5]'
                        : 'bg-[#FFFFFF] border-[#E2E6EC] text-[#687386] hover:bg-[#F7F8FA]'
                    }`}
                  >
                    Parent HEAD
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm(prev => ({ ...prev, origin_type: 'TIMESTAMP' }))}
                    className={`p-2 rounded-lg text-center border font-semibold cursor-pointer text-xs transition ${
                      createForm.origin_type === 'TIMESTAMP'
                        ? 'bg-[#EDF3FC] border-[#D0E0F6] text-[#4263A5]'
                        : 'bg-[#FFFFFF] border-[#E2E6EC] text-[#687386] hover:bg-[#F7F8FA]'
                    }`}
                  >
                    Historical Timestamp
                  </button>
                </div>

                {createForm.origin_type === 'TIMESTAMP' && (
                  <input
                    type="datetime-local"
                    step="1"
                    value={createForm.base_timestamp}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, base_timestamp: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] text-xs focus:border-[#4263A5] outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block text-[#202833] font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Explain the purpose of this branch..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] focus:border-[#4263A5] outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#E2E6EC]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F7F8FA] border border-[#E2E6EC] text-[#202833] rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-[#4263A5] hover:bg-[#345188] text-white font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  {loading ? 'Creating...' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: COMMIT CHANGES TO BRANCH
      ========================================================================= */}
      {showCommitModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#E2E6EC] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#E2E6EC] pb-3">
              <h3 className="font-bold text-[#202833] text-sm flex items-center space-x-2">
                <GitCommit className="w-4 h-4 text-[#D97706]" />
                <span>Record Commit on '{activeBranch}'</span>
              </h3>
              <button onClick={() => setShowCommitModal(false)}><X className="w-4 h-4 text-[#687386] hover:text-[#202833] cursor-pointer" /></button>
            </div>

            <form onSubmit={handleCommitSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#202833] font-semibold mb-1">Target Relation</label>
                  <select
                    value={commitForm.table_name}
                    onChange={(e) => setCommitForm(prev => ({ ...prev, table_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] focus:border-[#4263A5] outline-none cursor-pointer"
                  >
                    <option value="CUSTOMERS">CUSTOMERS</option>
                    <option value="PRODUCTS">PRODUCTS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#202833] font-semibold mb-1">Operation Type</label>
                  <select
                    value={commitForm.operation_type}
                    onChange={(e) => setCommitForm(prev => ({ ...prev, operation_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] focus:border-[#4263A5] outline-none cursor-pointer"
                  >
                    <option value="UPDATE">UPDATE</option>
                    <option value="INSERT">INSERT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#202833] font-semibold mb-1">Record ID (Primary Key) *</label>
                <input
                  type="text"
                  required
                  value={commitForm.record_id}
                  onChange={(e) => setCommitForm(prev => ({ ...prev, record_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] font-mono font-bold focus:border-[#4263A5] outline-none"
                />
              </div>

              {commitForm.operation_type !== 'DELETE' && (
                <div className="p-3 bg-[#F7F8FA] rounded-lg border border-[#E2E6EC] space-y-2.5">
                  <span className="text-[11px] font-bold text-[#4263A5] uppercase tracking-wider block">
                    {commitForm.table_name} Entity Columns
                  </span>

                  {commitForm.table_name === 'CUSTOMERS' ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Name</label>
                        <input
                          type="text"
                          value={commitForm.name}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Email</label>
                        <input
                          type="email"
                          value={commitForm.email}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Status</label>
                        <select
                          value={commitForm.status}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, status: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-medium"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="SUSPENDED">SUSPENDED</option>
                          <option value="INACTIVE">INACTIVE</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Credit Limit ($)</label>
                        <input
                          type="number"
                          step="1000"
                          value={commitForm.credit_limit}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, credit_limit: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-mono font-bold"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">SKU</label>
                        <input
                          type="text"
                          value={commitForm.sku}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, sku: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Product Name</label>
                        <input
                          type="text"
                          value={commitForm.name}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Unit Price ($)</label>
                        <input
                          type="number"
                          step="10"
                          value={commitForm.unit_price}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, unit_price: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Stock Quantity</label>
                        <input
                          type="number"
                          value={commitForm.stock_quantity}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, stock_quantity: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-mono font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[#202833] font-semibold mb-1">Commit Message *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modify customer credit limit for branch experiment"
                  value={commitForm.commit_message}
                  onChange={(e) => setCommitForm(prev => ({ ...prev, commit_message: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] focus:border-[#4263A5] outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#E2E6EC]">
                <button
                  type="button"
                  onClick={() => setShowCommitModal(false)}
                  className="px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F7F8FA] border border-[#E2E6EC] text-[#202833] rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-[#4263A5] hover:bg-[#345188] text-white font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  {loading ? 'Recording...' : 'Commit to Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: COMPARE BRANCHES
      ========================================================================= */}
      {showCompareModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#E2E6EC] rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#E2E6EC] pb-3">
              <h3 className="font-bold text-[#202833] text-sm flex items-center space-x-2">
                <GitCompare className="w-4 h-4 text-[#0284C7]" />
                <span>Compare Branch Diffs</span>
              </h3>
              <button onClick={() => setShowCompareModal(false)}><X className="w-4 h-4 text-[#687386] hover:text-[#202833] cursor-pointer" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[#202833] font-semibold mb-1">Base Branch</label>
                <select
                  value={compareForm.base_branch}
                  onChange={(e) => setCompareForm(prev => ({ ...prev, base_branch: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] focus:border-[#4263A5] outline-none"
                >
                  {branches.map(b => (
                    <option key={b.branch_id} value={b.branch_name}>{b.branch_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#202833] font-semibold mb-1">Compare Branch</label>
                <select
                  value={compareForm.compare_branch}
                  onChange={(e) => setCompareForm(prev => ({ ...prev, compare_branch: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] focus:border-[#4263A5] outline-none"
                >
                  <option value="">Select branch...</option>
                  {branches.filter(b => b.branch_name !== compareForm.base_branch).map(b => (
                    <option key={b.branch_id} value={b.branch_name}>{b.branch_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleCompare}
              className="w-full py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition"
            >
              Run Three-Way Diff Comparison
            </button>

            {compareResult && (
              <div className="space-y-3 pt-3 border-t border-[#E2E6EC]">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-[#F7F8FA] rounded-lg border border-[#E2E6EC]">
                    <span className="text-[#687386] block text-[10px] font-semibold uppercase">Total Changes</span>
                    <span className="font-mono text-[#202833] font-bold text-sm">{compareResult.total_changes}</span>
                  </div>
                  <div className="p-2.5 bg-[#E6F4EA] rounded-lg border border-[#CEEAD6]">
                    <span className="text-[#0D8A5B] block text-[10px] font-semibold uppercase">Added</span>
                    <span className="font-mono text-[#0D8A5B] font-bold text-sm">+{compareResult.added_count}</span>
                  </div>
                  <div className="p-2.5 bg-[#FEF3D6] rounded-lg border border-[#FEE3A2]">
                    <span className="text-[#B06000] block text-[10px] font-semibold uppercase">Modified</span>
                    <span className="font-mono text-[#B06000] font-bold text-sm">~{compareResult.modified_count}</span>
                  </div>
                  <div className="p-2.5 bg-[#FCE8E6] rounded-lg border border-[#FAD2CF]">
                    <span className="text-[#C5221F] block text-[10px] font-semibold uppercase">Deleted</span>
                    <span className="font-mono text-[#C5221F] font-bold text-sm">-{compareResult.deleted_count}</span>
                  </div>
                </div>

                {compareResult.changes && compareResult.changes.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {compareResult.changes.map((chg, i) => (
                      <div key={i} className="p-3 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC] text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-[#202833]">
                            {chg.table_name} #{chg.record_id}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            chg.operation_type === 'INSERT' ? 'bg-[#E6F4EA] text-[#0D8A5B] border border-[#CEEAD6]' :
                            chg.operation_type === 'DELETE' ? 'bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF]' :
                            'bg-[#FEF3D6] text-[#B06000] border border-[#FEE3A2]'
                          }`}>
                            {chg.operation_type}
                          </span>
                        </div>
                        {chg.changed_columns && (
                          <div className="text-[11px] text-[#687386]">
                            Altered Columns: <span className="text-[#4263A5] font-mono font-semibold">{chg.changed_columns}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-[#687386] text-xs bg-[#F7F8FA] rounded-lg border border-[#E2E6EC]">
                    Both branches are in identical states (0 differences).
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: THREE-WAY MERGE & CONFLICT RESOLVER
      ========================================================================= */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#E2E6EC] rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#E2E6EC] pb-3">
              <h3 className="font-bold text-[#202833] text-sm flex items-center space-x-2">
                <GitMerge className="w-4 h-4 text-[#0D8A5B]" />
                <span>Three-Way Temporal Merge Engine</span>
              </h3>
              <button onClick={() => setShowMergeModal(false)}><X className="w-4 h-4 text-[#687386] hover:text-[#202833] cursor-pointer" /></button>
            </div>

            {/* Merge Config */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[#202833] font-semibold mb-1">Source Branch (Incoming)</label>
                <select
                  value={mergeForm.source_branch}
                  onChange={(e) => setMergeForm(prev => ({ ...prev, source_branch: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] focus:border-[#4263A5] outline-none cursor-pointer"
                >
                  <option value="">Select branch...</option>
                  {branches.map(b => (
                    <option key={b.branch_id} value={b.branch_name}>{b.branch_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#202833] font-semibold mb-1">Target Branch (Destination)</label>
                <select
                  value={mergeForm.target_branch}
                  onChange={(e) => setMergeForm(prev => ({ ...prev, target_branch: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] focus:border-[#4263A5] outline-none cursor-pointer"
                >
                  {branches.map(b => (
                    <option key={b.branch_id} value={b.branch_name}>{b.branch_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[#202833] font-semibold text-xs mb-1">Merge Commit Message</label>
              <input
                type="text"
                placeholder={`Merge branch '${mergeForm.source_branch}' into '${mergeForm.target_branch}'`}
                value={mergeForm.merge_message}
                onChange={(e) => setMergeForm(prev => ({ ...prev, merge_message: e.target.value }))}
                className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] text-xs focus:border-[#4263A5] outline-none"
              />
            </div>

            {!mergeResult && (
              <button
                onClick={handleMergeSubmit}
                disabled={loading || !mergeForm.source_branch}
                className="w-full py-2 bg-[#0D8A5B] hover:bg-[#0A7049] text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs transition"
              >
                {loading ? 'Evaluating Three-Way Merge...' : 'Run Merge Analysis'}
              </button>
            )}

            {/* CONFLICT RESOLUTION INTERFACE */}
            {mergeResult && mergeResult.status === 'CONFLICT' && (
              <div className="space-y-3 pt-3 border-t border-[#E2E6EC]">
                <div className="p-3 bg-[#FEF3D6] border border-[#FEE3A2] rounded-lg flex items-center justify-between text-xs text-[#B06000]">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-[#B06000] shrink-0" />
                    <span className="font-medium">
                      Detected <strong>{mergeResult.conflicts_count}</strong> conflict(s). Choose which version to accept before committing the merge.
                    </span>
                  </div>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {mergeResult.conflicts.map((c, i) => {
                    const key = `${c.table_name}:${c.record_id}`;
                    const currRes = pendingResolutions[key] || {};

                    return (
                      <div key={i} className="p-3 bg-[#F7F8FA] border border-[#E2E6EC] rounded-lg space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#202833] font-mono">
                            {c.table_name} #{c.record_id}
                          </span>
                          <span className="text-[10px] bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF] px-2 py-0.5 rounded font-mono font-semibold">
                            {c.conflict_type}
                          </span>
                        </div>

                        {/* Three-Way Comparison Grid */}
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div className="p-2 bg-[#FFFFFF] rounded border border-[#E2E6EC]">
                            <span className="text-[#687386] block text-[10px] font-semibold uppercase">Base (Ancestor)</span>
                            <pre className="text-[#687386] font-mono text-[10px] mt-1 overflow-x-auto">
                              {JSON.stringify(c.base_values || 'NULL', null, 2)}
                            </pre>
                          </div>
                          <div className={`p-2 rounded border ${currRes.chosen_source === 'source' ? 'bg-[#EDF3FC] border-[#4263A5]' : 'bg-[#FFFFFF] border-[#E2E6EC]'}`}>
                            <div className="flex justify-between items-center">
                              <span className="text-[#4263A5] font-bold text-[10px] uppercase">Source ({mergeForm.source_branch})</span>
                              <button
                                type="button"
                                onClick={() => setPendingResolutions(prev => ({
                                  ...prev,
                                  [key]: { ...prev[key], chosen_source: 'source', resolved_values: c.source_values }
                                }))}
                                className="text-[10px] font-bold text-[#4263A5] underline cursor-pointer"
                              >
                                Accept
                              </button>
                            </div>
                            <pre className="text-[#4263A5] font-mono text-[10px] mt-1 overflow-x-auto font-medium">
                              {JSON.stringify(c.source_values || 'NULL', null, 2)}
                            </pre>
                          </div>
                          <div className={`p-2 rounded border ${currRes.chosen_source === 'target' ? 'bg-[#E6F4EA] border-[#0D8A5B]' : 'bg-[#FFFFFF] border-[#E2E6EC]'}`}>
                            <div className="flex justify-between items-center">
                              <span className="text-[#0D8A5B] font-bold text-[10px] uppercase">Target ({mergeForm.target_branch})</span>
                              <button
                                type="button"
                                onClick={() => setPendingResolutions(prev => ({
                                  ...prev,
                                  [key]: { ...prev[key], chosen_source: 'target', resolved_values: c.target_values }
                                }))}
                                className="text-[10px] font-bold text-[#0D8A5B] underline cursor-pointer"
                              >
                                Accept
                              </button>
                            </div>
                            <pre className="text-[#0D8A5B] font-mono text-[10px] mt-1 overflow-x-auto font-medium">
                              {JSON.stringify(c.target_values || 'NULL', null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-[#E2E6EC]">
                  <button
                    onClick={handleAbortMerge}
                    className="px-3 py-1.5 bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#E11D48] border border-[#FECDD3] rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Abort Merge
                  </button>
                  <button
                    onClick={handleResolveConflicts}
                    disabled={loading}
                    className="px-4 py-1.5 bg-[#0D8A5B] hover:bg-[#0A7049] text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs"
                  >
                    {loading ? 'Committing Resolutions...' : 'Confirm & Complete Merge'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
