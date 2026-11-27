import React, { useState, useEffect, useMemo } from 'react';
import {
  GitBranch, GitCommit, GitMerge, GitCompare, Plus, Trash2, 
  Search, AlertCircle, ZoomIn, ZoomOut, Maximize2, Shield, 
  Layers, User, Clock, Database, ChevronRight, X, AlertTriangle, 
  CheckCircle2, Edit3, Eye, RotateCcw, ArrowLeft, ArrowRight
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

function getRowPk(row, tableName) {
  const t = (tableName || row?._table || '').toUpperCase();
  if (t === 'CUSTOMERS') return String(row.customer_id ?? '');
  if (t === 'PRODUCTS') return String(row.product_id ?? '');
  if (t === 'ORDERS') return String(row.order_id ?? '');
  if (t === 'ORDER_ITEMS') return String(row.item_id ?? '');
  return String(row.customer_id ?? row.product_id ?? row.order_id ?? row.item_id ?? '');
}

export default function BranchingPage() {
  // Primary state
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranch] = useState('main');
  const [branchBackStack, setBranchBackStack] = useState([]);
  const [branchForwardStack, setBranchForwardStack] = useState([]);
  const [commits, setCommits] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [timelineData, setTimelineData] = useState({ branches: [], nodes: [], links: [] });
  const [branchState, setBranchState] = useState([]);
  const [viewingCommitId, setViewingCommitId] = useState(null);
  const [activeStateTable, setActiveStateTable] = useState('CUSTOMERS');
  const [stateSearch, setStateSearch] = useState('');
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
  const [stagedChanges, setStagedChanges] = useState([]);
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
    before_values: null,
    // Customer fields
    name: 'Acme Industrial Corp',
    email: 'procurement@acmeind.com',
    phone: '+1-555-0999',
    status: 'ACTIVE',
    credit_limit: 75000.0,
    // Product fields
    sku: 'SKU-SRV-01',
    category: 'Hardware',
    unit_price: 4250.0,
    stock_quantity: 35,
    // Order fields
    customer_id: 101,
    order_status: 'PROCESSING',
    total_amount: 21000.0,
    notes: '',
    // Order Item fields
    order_id: 501,
    product_id: 201,
    quantity: 1,
    subtotal: 4500.0
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
      setViewingCommitId(null);
      loadBranchDetails(activeBranch, null, null);
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
      const data = await apiService.getBranches();
      setBranches(data);
      if (!data.find(b => b.branch_name === activeBranch) && data.length > 0) {
        setActiveBranch(data[0].branch_name);
      }
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    }
  };

  const loadBranchDetails = async (bName, preferredCommitId = null, targetStateCommitId = null) => {
    try {
      const [commitsData, timeline, stateData] = await Promise.all([
        apiService.getBranchCommits(bName),
        apiService.getBranchTimeline(bName),
        apiService.getBranchState(bName, '__ALL__', targetStateCommitId)
      ]);
      setCommits(commitsData);
      setTimelineData(timeline);
      setBranchState(stateData.records || []);
      setViewingCommitId(targetStateCommitId);

      if (commitsData.length > 0) {
        if (preferredCommitId) {
          const found = commitsData.find(c => c.commit_id === preferredCommitId);
          setSelectedCommit(found || commitsData[0]);
        } else {
          setSelectedCommit(commitsData[0]);
        }
      } else {
        setSelectedCommit(null);
      }
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    }
  };

  // Track which records were modified or inserted on this branch
  const branchChangeMap = useMemo(() => {
    const map = {};
    // Process oldest to newest so latest op wins
    const ordered = [...commits].reverse();
    for (const c of ordered) {
      for (const cs of (c.changes || [])) {
        const key = `${cs.table_name}:${cs.record_id}`;
        map[key] = cs.operation_type;
      }
    }
    return map;
  }, [commits]);

  // Helper to populate Commit Modal from a row in current branchState
  const populateCommitFormFromRow = (tableName, recordId, operationType = 'UPDATE', customRow = null) => {
    const tbl = tableName.toUpperCase();
    const row = customRow || branchState.find(
      r => (r._table || 'CUSTOMERS') === tbl && getRowPk(r, tbl) === String(recordId)
    );

    if (row) {
      const cleanBefore = { ...row };
      delete cleanBefore._table;
      setCommitForm(prev => ({
        ...prev,
        table_name: tbl,
        record_id: String(recordId),
        operation_type: operationType,
        before_values: cleanBefore,
        // Customer
        name: row.name ?? prev.name,
        email: row.email ?? prev.email,
        phone: row.phone ?? '+1-555-0100',
        status: row.status ?? 'ACTIVE',
        credit_limit: row.credit_limit ?? 50000,
        // Product
        sku: row.sku ?? `SKU-${recordId}`,
        category: row.category ?? 'Hardware',
        unit_price: row.unit_price ?? 1000,
        stock_quantity: row.stock_quantity ?? 25,
        // Order
        customer_id: row.customer_id ?? 101,
        order_status: row.status ?? 'PROCESSING',
        total_amount: row.total_amount ?? 1500,
        notes: row.notes ?? '',
        // Order Item
        order_id: row.order_id ?? 501,
        product_id: row.product_id ?? 201,
        quantity: row.quantity ?? 1,
        subtotal: row.subtotal ?? 4500
      }));
    } else {
      setCommitForm(prev => ({
        ...prev,
        table_name: tbl,
        record_id: String(recordId),
        operation_type: operationType,
        before_values: null
      }));
    }
  };

  const openCommitModalForRow = (row, opType = 'UPDATE') => {
    const tbl = (row?._table || activeStateTable === '__ALL__' ? (row?._table || 'CUSTOMERS') : activeStateTable).toUpperCase();
    const pk = row ? getRowPk(row, tbl) : String(tbl === 'CUSTOMERS' ? 151 : tbl === 'PRODUCTS' ? 251 : tbl === 'ORDERS' ? 551 : 1051);
    setStagedChanges([]);
    populateCommitFormFromRow(tbl, pk, opType, row);
    setCommitForm(prev => ({
      ...prev,
      commit_message: opType === 'DELETE'
        ? `Delete ${tbl} #${pk}`
        : opType === 'INSERT'
        ? `Insert new ${tbl} #${pk}`
        : `Update ${tbl} #${pk}`
    }));
    setShowCommitModal(true);
  };

  // --- ACTIONS ---

  const switchBranch = (targetBranch) => {
    if (!targetBranch || targetBranch === activeBranch) return;
    setBranchBackStack(prev => [...prev, activeBranch]);
    setBranchForwardStack([]);
    setActiveBranch(targetBranch);
  };

  const handleBranchBack = () => {
    if (branchBackStack.length > 0) {
      const prevBranch = branchBackStack[branchBackStack.length - 1];
      setBranchBackStack(prev => prev.slice(0, -1));
      setBranchForwardStack(prev => [activeBranch, ...prev]);
      setActiveBranch(prevBranch);
      return;
    }
    const curBranchObj = branches.find(b => b.branch_name === activeBranch);
    const parentTarget = curBranchObj?.parent_name || (activeBranch !== 'main' ? 'main' : null);
    if (parentTarget) {
      setBranchForwardStack(prev => [activeBranch, ...prev]);
      setActiveBranch(parentTarget);
    }
  };

  const handleBranchForward = () => {
    if (branchForwardStack.length === 0) return;
    const nextBranch = branchForwardStack[0];
    setBranchForwardStack(prev => prev.slice(1));
    setBranchBackStack(prev => [...prev, activeBranch]);
    setActiveBranch(nextBranch);
  };

  const handleInspectCommitDb = async (commitObj) => {
    if (!commitObj) return;
    const targetBranch = commitObj.branch_name || activeBranch;
    try {
      setLoading(true);
      if (targetBranch !== activeBranch) {
        setActiveBranch(targetBranch);
      }
      const stateData = await apiService.getBranchState(targetBranch, '__ALL__', commitObj.commit_id);
      setBranchState(stateData.records || []);
      setViewingCommitId(commitObj.commit_id);
      setCenterView('state');
      showToast(`Loaded branch database snapshot at commit ${commitObj.commit_id}`);
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleStateCommitSelect = async (commitIdOrHead) => {
    const cid = commitIdOrHead === '__HEAD__' ? null : commitIdOrHead;
    try {
      setLoading(true);
      const stateData = await apiService.getBranchState(activeBranch, '__ALL__', cid);
      setBranchState(stateData.records || []);
      setViewingCommitId(cid);
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleRevertToCommit = async (targetCommitId) => {
    if (!window.confirm(`Restore branch '${activeBranch}' back to commit ${targetCommitId}? This creates a new revert commit while preserving full history.`)) {
      return;
    }
    try {
      setLoading(true);
      const res = await apiService.revertBranchToCommit(activeBranch, targetCommitId, 'developer');
      showToast(`Branch '${activeBranch}' restored to ${targetCommitId} (commit ${res.commit_id})`);
      await Promise.all([
        loadBranches(),
        loadBranchDetails(activeBranch, res.commit_id, null)
      ]);
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message, true);
    } finally {
      setLoading(false);
    }
  };

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

  const buildChangeFromForm = () => {
    let afterValues = null;
    if (commitForm.operation_type !== 'DELETE') {
      if (commitForm.table_name === 'CUSTOMERS') {
        afterValues = {
          customer_id: Number(commitForm.record_id),
          name: commitForm.name,
          email: commitForm.email,
          phone: commitForm.phone,
          status: commitForm.status,
          credit_limit: parseFloat(commitForm.credit_limit)
        };
      } else if (commitForm.table_name === 'PRODUCTS') {
        afterValues = {
          product_id: Number(commitForm.record_id),
          sku: commitForm.sku,
          name: commitForm.name,
          category: commitForm.category,
          unit_price: parseFloat(commitForm.unit_price),
          stock_quantity: parseInt(commitForm.stock_quantity, 10)
        };
      } else if (commitForm.table_name === 'ORDERS') {
        afterValues = {
          order_id: Number(commitForm.record_id),
          customer_id: Number(commitForm.customer_id),
          status: commitForm.order_status,
          total_amount: parseFloat(commitForm.total_amount),
          notes: commitForm.notes
        };
      } else if (commitForm.table_name === 'ORDER_ITEMS') {
        afterValues = {
          item_id: Number(commitForm.record_id),
          order_id: Number(commitForm.order_id),
          product_id: Number(commitForm.product_id),
          quantity: parseInt(commitForm.quantity, 10),
          unit_price: parseFloat(commitForm.unit_price),
          subtotal: parseFloat(commitForm.subtotal)
        };
      }
    }

    return {
      table_name: commitForm.table_name,
      record_id: String(commitForm.record_id),
      operation_type: commitForm.operation_type,
      after_values: afterValues,
      before_values: commitForm.before_values
    };
  };

  const handleAddOperationToCommit = () => {
    if (!String(commitForm.record_id).trim()) {
      showToast('Record ID is required to stage an operation', true);
      return;
    }
    const item = buildChangeFromForm();
    setStagedChanges(prev => {
      const filtered = prev.filter(
        c => !(c.table_name === item.table_name && c.record_id === item.record_id)
      );
      return [...filtered, item];
    });
    showToast(`Staged ${item.operation_type} on ${item.table_name} #${item.record_id}`);
  };

  const handleRemoveStagedOperation = (idx) => {
    setStagedChanges(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCommitSubmit = async (e) => {
    e.preventDefault();
    if (!commitForm.commit_message.trim()) {
      showToast('Commit message is required', true);
      return;
    }
    try {
      setLoading(true);
      const changesToSubmit = stagedChanges.length > 0 ? stagedChanges : [buildChangeFromForm()];

      const res = await apiService.createBranchCommit(activeBranch, {
        commit_message: commitForm.commit_message.trim(),
        author: commitForm.author || 'developer',
        changes: changesToSubmit
      });

      showToast(`Commit '${res.commit_id}' (${changesToSubmit.length} operation${changesToSubmit.length > 1 ? 's' : ''}) recorded on '${activeBranch}'!`);
      setShowCommitModal(false);
      setStagedChanges([]);
      setCommitForm(prev => ({ ...prev, commit_message: '' }));
      // Refresh BOTH branch list (commit counts) and branch details (selectedCommit = new commit)
      await Promise.all([
        loadBranches(),
        loadBranchDetails(activeBranch, res.commit_id, null)
      ]);
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
        await Promise.all([
          loadBranches(),
          loadBranchDetails(activeBranch, res.merge_commit_id, null)
        ]);
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
      await Promise.all([
        loadBranches(),
        loadBranchDetails(activeBranch, res.merge_commit_id, null)
      ]);
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

  const displayedRows = useMemo(() => {
    return branchState.filter(r => {
      const tbl = r._table || 'CUSTOMERS';
      if (activeStateTable !== '__ALL__' && tbl !== activeStateTable) return false;
      if (stateSearch.trim()) {
        const q = stateSearch.toLowerCase();
        return Object.values(r).some(v => String(v).toLowerCase().includes(q));
      }
      return true;
    });
  }, [branchState, activeStateTable, stateSearch]);

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
          {(() => {
            const curBranchObj = branches.find(b => b.branch_name === activeBranch);
            const fallbackParent = curBranchObj?.parent_name || (activeBranch !== 'main' ? 'main' : null);
            const backTarget = branchBackStack.length > 0 ? branchBackStack[branchBackStack.length - 1] : fallbackParent;
            const forwardTarget = branchForwardStack.length > 0 ? branchForwardStack[0] : null;
            if (!backTarget && !forwardTarget) return null;
            return (
              <div className="flex items-center space-x-1">
                {backTarget && (
                  <button
                    onClick={handleBranchBack}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#4263A5] rounded-lg text-xs font-semibold border border-[#D0E0F6] transition cursor-pointer shadow-xs"
                    title={`Go back to '${backTarget}'`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back ({backTarget})</span>
                  </button>
                )}
                {forwardTarget && (
                  <button
                    onClick={handleBranchForward}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#0D8A5B] rounded-lg text-xs font-semibold border border-[#CEEAD6] transition cursor-pointer shadow-xs"
                    title={`Go forward to '${forwardTarget}'`}
                  >
                    <span>Forward ({forwardTarget})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })()}

          <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#FFFFFF] rounded-lg border border-[#E2E6EC] shadow-xs">
            <GitBranch className="w-3.5 h-3.5 text-[#4263A5]" />
            <select
              value={activeBranch}
              onChange={(e) => switchBranch(e.target.value)}
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
            onClick={() => {
              const defaultTbl = activeStateTable === '__ALL__' ? 'CUSTOMERS' : activeStateTable;
              const defaultPk = defaultTbl === 'CUSTOMERS' ? '101' : defaultTbl === 'PRODUCTS' ? '201' : '501';
              populateCommitFormFromRow(defaultTbl, defaultPk, 'UPDATE');
              setShowCommitModal(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#202833] rounded-lg text-xs font-semibold border border-[#E2E6EC] transition cursor-pointer shadow-xs"
          >
            <GitCommit className="w-3.5 h-3.5 text-[#D97706]" />
            <span>Commit Change</span>
          </button>

          <button
            onClick={() => {
              setCompareForm({ base_branch: 'main', compare_branch: activeBranch });
              setCompareResult(null);
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
              const displayCommitCount = isSelected ? commits.length : b.commit_count;
              return (
                <div
                  key={b.branch_id}
                  onClick={() => switchBranch(b.branch_name)}
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
                    <span className="text-[11px] font-mono text-[#687386]">
                      {displayCommitCount} {displayCommitCount === 1 ? 'commit' : 'commits'}
                    </span>
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
          <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-[#E2E6EC] bg-[#F7F8FA] gap-2">
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
                Branch Database ({branchState.length})
              </button>
            </div>

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
                <select
                  value={activeStateTable}
                  onChange={(e) => setActiveStateTable(e.target.value)}
                  className="bg-[#FFFFFF] text-xs text-[#202833] font-medium rounded px-2 py-1 border border-[#E2E6EC] focus:border-[#4263A5] outline-none cursor-pointer"
                >
                  <option value="CUSTOMERS">CUSTOMERS</option>
                  <option value="PRODUCTS">PRODUCTS</option>
                  <option value="ORDERS">ORDERS</option>
                  <option value="__ALL__">ALL TABLES</option>
                </select>
                {!viewingCommitId && (
                  <button
                    onClick={() => openCommitModalForRow(null, 'INSERT')}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-[#4263A5] hover:bg-[#345188] text-white rounded text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Insert Row</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* VIEW CONTENT */}
          <div className="min-h-[460px] max-h-[560px] overflow-auto relative bg-[#FAFAFC]">
            
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

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCommit(c);
                            handleInspectCommitDb(c);
                          }}
                          className="px-2 py-1 rounded bg-[#FFFFFF] hover:bg-[#EDF3FC] border border-[#E2E6EC] text-[10px] font-semibold text-[#4263A5] flex items-center space-x-1 cursor-pointer"
                          title="View database state at this commit"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View DB</span>
                        </button>
                        <ChevronRight className="w-4 h-4 text-[#687386]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW C: BRANCH DATABASE EXPLORER (AT HEAD OR PARTICULAR COMMIT) */}
            {centerView === 'state' && (
              <div className="p-4 space-y-3">
                {/* Snapshot Commit Selector & Search Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FFFFFF] p-2.5 rounded-lg border border-[#E2E6EC]">
                  <div className="flex items-center space-x-2 text-xs">
                    <Database className="w-3.5 h-3.5 text-[#4263A5]" />
                    <span className="font-semibold text-[#202833]">Snapshot:</span>
                    <select
                      value={viewingCommitId || '__HEAD__'}
                      onChange={(e) => handleStateCommitSelect(e.target.value)}
                      className="px-2.5 py-1 bg-[#F7F8FA] border border-[#E2E6EC] rounded text-xs font-mono text-[#202833] focus:border-[#4263A5] outline-none cursor-pointer"
                    >
                      <option value="__HEAD__">HEAD (Latest on {activeBranch})</option>
                      {commits.map(c => (
                        <option key={c.commit_id} value={c.commit_id}>
                          {c.commit_id} — {c.commit_message.substring(0, 32)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative flex-1 min-w-[160px] max-w-[220px]">
                    <Search className="w-3 h-3 text-[#687386] absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Search rows..."
                      value={stateSearch}
                      onChange={(e) => setStateSearch(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-1 bg-[#F7F8FA] border border-[#E2E6EC] rounded text-xs text-[#202833] outline-none focus:border-[#4263A5]"
                    />
                  </div>
                </div>

                {/* Historical Commit Banner with Back / Forward Commit Stepper */}
                {viewingCommitId && (() => {
                  const idx = commits.findIndex(c => c.commit_id === viewingCommitId);
                  const olderCommit = idx >= 0 && idx < commits.length - 1 ? commits[idx + 1] : null;
                  const newerCommit = idx > 0 ? commits[idx - 1] : null;
                  return (
                    <div className="px-3 py-2 bg-[#FEF3D6] border border-[#FEE3A2] rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-[#B06000]">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Viewing snapshot at <strong className="font-mono">{viewingCommitId}</strong> (read-only).
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {olderCommit && (
                          <button
                            onClick={() => handleStateCommitSelect(olderCommit.commit_id)}
                            className="flex items-center space-x-1 px-2 py-0.5 bg-[#FFFFFF] border border-[#FEE3A2] rounded text-[11px] font-semibold text-[#B06000] hover:bg-[#FFFBEB] cursor-pointer"
                            title={`Go back to older commit ${olderCommit.commit_id}`}
                          >
                            <ArrowLeft className="w-3 h-3" />
                            <span>Older ({olderCommit.commit_id})</span>
                          </button>
                        )}
                        {newerCommit && (
                          <button
                            onClick={() => handleStateCommitSelect(newerCommit.commit_id)}
                            className="flex items-center space-x-1 px-2 py-0.5 bg-[#FFFFFF] border border-[#CEEAD6] rounded text-[11px] font-semibold text-[#0D8A5B] hover:bg-[#E6F4EA] cursor-pointer"
                            title={`Go forward to newer commit ${newerCommit.commit_id}`}
                          >
                            <span>Newer ({newerCommit.commit_id})</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => handleStateCommitSelect('__HEAD__')}
                          className="flex items-center space-x-1 px-2 py-0.5 bg-[#FFFFFF] border border-[#FEE3A2] rounded text-[11px] font-semibold text-[#4263A5] hover:bg-[#EDF3FC] cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>HEAD</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Table Data Grid */}
                <div className="rounded-lg border border-[#E2E6EC] overflow-x-auto bg-[#FFFFFF] shadow-xs">
                  <table className="w-full text-left text-xs text-[#202833]">
                    <thead className="bg-[#F7F8FA] text-[11px] uppercase tracking-wider text-[#687386] border-b border-[#E2E6EC]">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Branch State</th>
                        <th className="px-3 py-2.5 font-semibold">PK</th>
                        {activeStateTable === 'CUSTOMERS' && (
                          <>
                            <th className="px-3 py-2.5 font-semibold">Name</th>
                            <th className="px-3 py-2.5 font-semibold">Email</th>
                            <th className="px-3 py-2.5 font-semibold">Status</th>
                            <th className="px-3 py-2.5 font-semibold">Credit Limit</th>
                          </>
                        )}
                        {activeStateTable === 'PRODUCTS' && (
                          <>
                            <th className="px-3 py-2.5 font-semibold">SKU</th>
                            <th className="px-3 py-2.5 font-semibold">Name</th>
                            <th className="px-3 py-2.5 font-semibold">Category</th>
                            <th className="px-3 py-2.5 font-semibold">Price / Stock</th>
                          </>
                        )}
                        {activeStateTable === 'ORDERS' && (
                          <>
                            <th className="px-3 py-2.5 font-semibold">Customer</th>
                            <th className="px-3 py-2.5 font-semibold">Status</th>
                            <th className="px-3 py-2.5 font-semibold">Total</th>
                            <th className="px-3 py-2.5 font-semibold">Notes</th>
                          </>
                        )}
                        {activeStateTable === '__ALL__' && (
                          <>
                            <th className="px-3 py-2.5 font-semibold">Table</th>
                            <th className="px-3 py-2.5 font-semibold">Summary</th>
                            <th className="px-3 py-2.5 font-semibold">Value / Status</th>
                          </>
                        )}
                        {!viewingCommitId && <th className="px-3 py-2.5 font-semibold text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E6EC]">
                      {displayedRows.map((row, idx) => {
                        const tbl = row._table || 'CUSTOMERS';
                        const pk = getRowPk(row, tbl);
                        const branchOp = branchChangeMap[`${tbl}:${pk}`];

                        return (
                          <tr key={`${tbl}-${pk}-${idx}`} className="hover:bg-[#F9FAFB]">
                            <td className="px-3 py-2">
                              {branchOp === 'INSERT' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#E6F4EA] text-[#0D8A5B] border border-[#CEEAD6]">
                                  Inserted on Branch
                                </span>
                              ) : branchOp === 'UPDATE' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#FEF3D6] text-[#B06000] border border-[#FEE3A2]">
                                  Modified on Branch
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#F0F2F5] text-[#687386] border border-[#E2E6EC]">
                                  Inherited
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-[#202833]">{pk}</td>

                            {activeStateTable === 'CUSTOMERS' && (
                              <>
                                <td className="px-3 py-2 font-medium">{row.name}</td>
                                <td className="px-3 py-2 text-[#687386]">{row.email}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    row.status === 'ACTIVE' ? 'bg-[#E6F4EA] text-[#0D8A5B]' : 'bg-[#FCE8E6] text-[#C5221F]'
                                  }`}>
                                    {row.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-mono font-semibold">
                                  ${Number(row.credit_limit || 0).toLocaleString()}
                                </td>
                              </>
                            )}

                            {activeStateTable === 'PRODUCTS' && (
                              <>
                                <td className="px-3 py-2 font-mono text-[#4263A5]">{row.sku}</td>
                                <td className="px-3 py-2 font-medium">{row.name}</td>
                                <td className="px-3 py-2 text-[#687386]">{row.category}</td>
                                <td className="px-3 py-2 font-mono">
                                  ${Number(row.unit_price || 0).toLocaleString()} · <span className="text-[#687386]">{row.stock_quantity} qty</span>
                                </td>
                              </>
                            )}

                            {activeStateTable === 'ORDERS' && (
                              <>
                                <td className="px-3 py-2 font-mono">#{row.customer_id}</td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EDF3FC] text-[#4263A5]">
                                    {row.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-mono font-semibold">${Number(row.total_amount || 0).toLocaleString()}</td>
                                <td className="px-3 py-2 text-[#687386] truncate max-w-[140px]">{row.notes}</td>
                              </>
                            )}

                            {activeStateTable === '__ALL__' && (
                              <>
                                <td className="px-3 py-2 font-mono font-semibold text-[#4263A5]">{tbl}</td>
                                <td className="px-3 py-2 font-medium">{row.name || row.sku || row.notes || `Order #${pk}`}</td>
                                <td className="px-3 py-2 font-mono text-[#687386]">
                                  {row.credit_limit != null ? `$${Number(row.credit_limit).toLocaleString()}` :
                                   row.unit_price != null ? `$${Number(row.unit_price).toLocaleString()}` :
                                   row.total_amount != null ? `$${Number(row.total_amount).toLocaleString()}` : '-'}
                                </td>
                              </>
                            )}

                            {!viewingCommitId && (
                              <td className="px-3 py-2 text-right whitespace-nowrap space-x-1">
                                <button
                                  onClick={() => openCommitModalForRow(row, 'UPDATE')}
                                  className="p-1 rounded hover:bg-[#EDF3FC] text-[#4263A5] cursor-pointer"
                                  title="Modify & Commit on Branch"
                                >
                                  <Edit3 className="w-3.5 h-3.5 inline" />
                                </button>
                                <button
                                  onClick={() => openCommitModalForRow(row, 'DELETE')}
                                  className="p-1 rounded hover:bg-[#FCE8E6] text-[#C5221F] cursor-pointer"
                                  title="Delete & Commit on Branch"
                                >
                                  <Trash2 className="w-3.5 h-3.5 inline" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {displayedRows.length === 0 && (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-[#687386]">
                            No matching records found in this snapshot.
                          </td>
                        </tr>
                      )}
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

              {/* Action: View Database / Step Older-Newer / Revert or Advance / Branch */}
              <div className="space-y-1.5">
                {(() => {
                  const idx = commits.findIndex(c => c.commit_id === selectedCommit.commit_id);
                  const olderCommit = idx >= 0 && idx < commits.length - 1 ? commits[idx + 1] : null;
                  const newerCommit = idx > 0 ? commits[idx - 1] : null;
                  if (idx === -1) return null;
                  return (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        disabled={!olderCommit}
                        onClick={() => olderCommit && setSelectedCommit(olderCommit)}
                        className={`py-1 px-2 rounded border text-[11px] font-semibold flex items-center justify-center space-x-1 ${
                          olderCommit
                            ? 'bg-[#FFFFFF] hover:bg-[#F7F8FA] border-[#E2E6EC] text-[#202833] cursor-pointer'
                            : 'bg-[#F7F8FA] border-[#E2E6EC] text-[#CBD5E1] cursor-not-allowed'
                        }`}
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>Older</span>
                      </button>
                      <button
                        disabled={!newerCommit}
                        onClick={() => newerCommit && setSelectedCommit(newerCommit)}
                        className={`py-1 px-2 rounded border text-[11px] font-semibold flex items-center justify-center space-x-1 ${
                          newerCommit
                            ? 'bg-[#FFFFFF] hover:bg-[#F7F8FA] border-[#E2E6EC] text-[#0D8A5B] cursor-pointer'
                            : 'bg-[#F7F8FA] border-[#E2E6EC] text-[#CBD5E1] cursor-not-allowed'
                        }`}
                      >
                        <span>Newer</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })()}

                <button
                  onClick={() => handleInspectCommitDb(selectedCommit)}
                  className="w-full py-2 px-3 bg-[#EDF3FC] hover:bg-[#DCE7F9] border border-[#D0E0F6] text-[#4263A5] rounded-lg font-semibold text-xs flex items-center justify-center space-x-1.5 cursor-pointer transition"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>View Database at {selectedCommit.commit_id}</span>
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  {commits.length > 0 && selectedCommit.commit_id !== commits[0]?.commit_id && (selectedCommit.branch_name || activeBranch) === activeBranch && (
                    <button
                      onClick={() => handleRevertToCommit(selectedCommit.commit_id)}
                      disabled={loading}
                      className="py-1.5 px-2 bg-[#FEF3D6] hover:bg-[#FDE68A] border border-[#FEE3A2] text-[#B06000] rounded-lg font-semibold text-[11px] flex items-center justify-center space-x-1 cursor-pointer transition"
                      title="Non-destructively revert branch back to this commit"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Revert to Here</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setCreateForm(prev => ({
                        ...prev,
                        parent_branch_name: selectedCommit.branch_name || activeBranch,
                        origin_type: 'COMMIT',
                        base_commit_id: selectedCommit.commit_id
                      }));
                      setShowCreateModal(true);
                    }}
                    className={`py-1.5 px-2 bg-[#FFFFFF] hover:bg-[#F7F8FA] border border-[#E2E6EC] text-[#202833] rounded-lg font-semibold text-[11px] flex items-center justify-center space-x-1 cursor-pointer transition ${
                      !(commits.length > 0 && selectedCommit.commit_id !== commits[0]?.commit_id && (selectedCommit.branch_name || activeBranch) === activeBranch)
                        ? 'col-span-2'
                        : ''
                    }`}
                    title="Create a new branch starting at this exact commit"
                  >
                    <GitBranch className="w-3 h-3 text-[#4263A5]" />
                    <span>Branch from {selectedCommit.commit_id}</span>
                  </button>
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
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
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

                        {cs.delta_values && Object.keys(cs.delta_values).length > 0 && (
                          <div className="space-y-1 bg-[#FFFFFF] p-2 rounded border border-[#E2E6EC]">
                            {Object.entries(cs.delta_values).map(([col, vals]) => (
                              <div key={col} className="text-[10px] font-mono flex flex-wrap items-center gap-1">
                                <span className="font-bold text-[#202833]">{col}:</span>
                                <span className="text-[#C5221F] line-through">{String(vals?.old ?? 'NULL')}</span>
                                <span className="text-[#687386]">→</span>
                                <span className="text-[#0D8A5B] font-semibold">{String(vals?.new ?? 'NULL')}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {cs.after_values && (
                          <div className="mt-1">
                            <span className="text-[10px] text-[#687386] block">After State:</span>
                            <pre className="p-2 bg-[#FFFFFF] rounded text-[10px] font-mono text-[#0D8A5B] overflow-x-auto border border-[#E2E6EC]">
                              {JSON.stringify(cs.after_values, null, 2)}
                            </pre>
                          </div>
                        )}

                        {cs.operation_type === 'DELETE' && cs.before_values && (
                          <div className="mt-1">
                            <span className="text-[10px] text-[#687386] block">Deleted Record:</span>
                            <pre className="p-2 bg-[#FFFFFF] rounded text-[10px] font-mono text-[#C5221F] overflow-x-auto border border-[#E2E6EC]">
                              {JSON.stringify(cs.before_values, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-[#687386] bg-[#F7F8FA] rounded-lg border border-[#E2E6EC] text-xs">
                    Initial branch baseline commit (zero record mutations).
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
                <div className="grid grid-cols-3 gap-2 mb-2">
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
                    onClick={() => setCreateForm(prev => ({ ...prev, origin_type: 'COMMIT' }))}
                    className={`p-2 rounded-lg text-center border font-semibold cursor-pointer text-xs transition ${
                      createForm.origin_type === 'COMMIT'
                        ? 'bg-[#EDF3FC] border-[#D0E0F6] text-[#4263A5]'
                        : 'bg-[#FFFFFF] border-[#E2E6EC] text-[#687386] hover:bg-[#F7F8FA]'
                    }`}
                  >
                    Specific Commit
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
                    Timestamp
                  </button>
                </div>

                {createForm.origin_type === 'COMMIT' && (
                  <input
                    type="text"
                    placeholder="e.g. c102"
                    value={createForm.base_commit_id}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, base_commit_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] text-xs font-mono focus:border-[#4263A5] outline-none"
                  />
                )}

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
          <div className="bg-[#FFFFFF] border border-[#E2E6EC] rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
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
                    onChange={(e) => {
                      const nextTbl = e.target.value;
                      const nextPk = nextTbl === 'CUSTOMERS' ? '101' : nextTbl === 'PRODUCTS' ? '201' : nextTbl === 'ORDERS' ? '501' : '1001';
                      populateCommitFormFromRow(nextTbl, nextPk, commitForm.operation_type);
                    }}
                    className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] focus:border-[#4263A5] outline-none cursor-pointer"
                  >
                    <option value="CUSTOMERS">CUSTOMERS</option>
                    <option value="PRODUCTS">PRODUCTS</option>
                    <option value="ORDERS">ORDERS</option>
                    <option value="ORDER_ITEMS">ORDER_ITEMS</option>
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
                <div className="flex space-x-2">
                  <input
                    type="text"
                    required
                    value={commitForm.record_id}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      populateCommitFormFromRow(commitForm.table_name, nextId, commitForm.operation_type);
                    }}
                    className="flex-1 px-3 py-2 bg-[#FFFFFF] border border-[#E2E6EC] rounded-lg text-[#202833] font-mono font-bold focus:border-[#4263A5] outline-none"
                  />
                  {commitForm.operation_type !== 'INSERT' && (
                    <select
                      value={commitForm.record_id}
                      onChange={(e) => populateCommitFormFromRow(commitForm.table_name, e.target.value, commitForm.operation_type)}
                      className="px-2 py-2 bg-[#F7F8FA] border border-[#E2E6EC] rounded-lg text-[#202833] text-xs cursor-pointer max-w-[180px]"
                    >
                      <option value="">Pick existing...</option>
                      {branchState
                        .filter(r => (r._table || 'CUSTOMERS') === commitForm.table_name)
                        .map(r => {
                          const pk = getRowPk(r, commitForm.table_name);
                          return (
                            <option key={pk} value={pk}>
                              #{pk} {r.name || r.sku || ''}
                            </option>
                          );
                        })}
                    </select>
                  )}
                </div>
              </div>

              {commitForm.operation_type !== 'DELETE' && (
                <div className="p-3 bg-[#F7F8FA] rounded-lg border border-[#E2E6EC] space-y-2.5">
                  <span className="text-[11px] font-bold text-[#4263A5] uppercase tracking-wider block">
                    {commitForm.table_name} Entity Columns
                  </span>

                  {commitForm.table_name === 'CUSTOMERS' && (
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
                  )}

                  {commitForm.table_name === 'PRODUCTS' && (
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

                  {commitForm.table_name === 'ORDERS' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Customer ID</label>
                        <input
                          type="number"
                          value={commitForm.customer_id}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, customer_id: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Status</label>
                        <select
                          value={commitForm.order_status}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, order_status: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-medium"
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="PROCESSING">PROCESSING</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="CANCELLED">CANCELLED</option>
                          <option value="REFUNDED">REFUNDED</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Total Amount ($)</label>
                        <input
                          type="number"
                          step="100"
                          value={commitForm.total_amount}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, total_amount: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Notes</label>
                        <input
                          type="text"
                          value={commitForm.notes}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, notes: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-medium"
                        />
                      </div>
                    </div>
                  )}

                  {commitForm.table_name === 'ORDER_ITEMS' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Order ID</label>
                        <input
                          type="number"
                          value={commitForm.order_id}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, order_id: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Product ID</label>
                        <input
                          type="number"
                          value={commitForm.product_id}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, product_id: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Quantity</label>
                        <input
                          type="number"
                          value={commitForm.quantity}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, quantity: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#687386] font-semibold">Subtotal ($)</label>
                        <input
                          type="number"
                          step="10"
                          value={commitForm.subtotal}
                          onChange={(e) => setCommitForm(prev => ({ ...prev, subtotal: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E2E6EC] rounded text-[#202833] font-mono font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between bg-[#F7F8FA] border border-[#E2E6EC] rounded-lg px-3 py-2">
                <span className="text-[11px] text-[#687386]">
                  Stage multiple INSERT / UPDATE / DELETE operations across tables into one commit:
                </span>
                <button
                  type="button"
                  onClick={handleAddOperationToCommit}
                  className="px-2.5 py-1 bg-[#FFFFFF] hover:bg-[#EEF2FF] border border-[#4263A5] text-[#4263A5] font-semibold rounded-md flex items-center space-x-1 cursor-pointer shrink-0 ml-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Operation to Commit</span>
                </button>
              </div>

              {stagedChanges.length > 0 && (
                <div className="p-3 bg-[#F7F8FA] rounded-lg border border-[#E2E6EC] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#202833] uppercase tracking-wider">
                      Staged Operations ({stagedChanges.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setStagedChanges([])}
                      className="text-[10px] text-[#687386] hover:text-[#DC2626] cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {stagedChanges.map((item, idx) => (
                      <div
                        key={`${item.table_name}-${item.record_id}-${idx}`}
                        className="flex items-center justify-between bg-[#FFFFFF] border border-[#E2E6EC] rounded px-2.5 py-1.5 text-[11px]"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              item.operation_type === 'INSERT'
                                ? 'bg-emerald-100 text-emerald-700'
                                : item.operation_type === 'DELETE'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {item.operation_type}
                          </span>
                          <span className="font-mono font-bold text-[#202833]">
                            {item.table_name} #{item.record_id}
                          </span>
                          {item.after_values && (
                            <span className="text-[#687386] truncate max-w-[260px]">
                              {JSON.stringify(item.after_values)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedOperation(idx)}
                          className="text-[#687386] hover:text-[#DC2626] ml-2 cursor-pointer"
                          title="Remove operation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[#202833] font-semibold mb-1">Commit Message *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Batch update customer credit limits and product pricing"
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
                  {loading
                    ? 'Recording...'
                    : stagedChanges.length > 0
                    ? `Commit ${stagedChanges.length} Operation${stagedChanges.length > 1 ? 's' : ''} to Branch`
                    : 'Commit to Branch'}
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
