import { Fragment, useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertCircle, CheckCircle, ChevronRight, ChevronLeft,
  RefreshCw, PackageCheck, ScanLine, XCircle, Lock, Unlock,
} from 'lucide-react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';

export default function Scan({ sessionId, sessions, user }) {
  const [step, setStep] = useState(1);
  const [cases, setCases] = useState([]);
  const [caseProgress, setCaseProgress] = useState({});
  const [skus, setSkus] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState(null);

  // Item confirmation scan
  const [confirmScan, setConfirmScan] = useState('');
  const [itemConfirmed, setItemConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const confirmRef = useRef(null);

  // Lock tracking — what THIS operator currently holds
  const activeLockRef = useRef(null); // { session_id, case_id, sku }

  const sessionName = sessions.find((s) => s.id === sessionId)?.name || '';

  // ── Lock helpers ───────────────────────────────────────────────
  const acquireLock = async (caseId, sku) => {
    const res = await fetch('/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, case_id: caseId, sku, operator: user }),
    });
    const data = await res.json();
    if (!res.ok) {
      // 409 = locked by someone else
      throw { status: res.status, ...data };
    }
    activeLockRef.current = { session_id: sessionId, case_id: caseId, sku };
    return data;
  };

  const releaseLock = useCallback(async () => {
    const lock = activeLockRef.current;
    if (!lock) return;
    activeLockRef.current = null;
    try {
      await fetch('/api/lock', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lock, operator: user }),
      });
    } catch (e) {
      console.warn('Could not release lock', e);
    }
  }, [user]);

  // Release lock if component unmounts while holding one
  useEffect(() => {
    return () => { releaseLock(); };
  }, [releaseLock]);

  // ── Session change ─────────────────────────────────────────────
  useEffect(() => {
    if (sessionId) {
      releaseLock();
      fetchCases();
      fetchCaseProgress();
      setStep(1);
      setSelectedCase('');
      setSelectedSku('');
      setSkus([]);
      setDestinations([]);
      setMessage(null);
      resetConfirm();
    }
  }, [sessionId]);

  useEffect(() => {
    if (step === 3 && !itemConfirmed) {
      setTimeout(() => confirmRef.current?.focus(), 100);
    }
  }, [step, itemConfirmed]);

  const resetConfirm = () => {
    setConfirmScan('');
    setItemConfirmed(false);
    setConfirmError('');
  };

  // ── Data fetching ──────────────────────────────────────────────
  const fetchCases = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}/cases`);
      setCases(await res.json());
    } catch {
      setMessage({ type: 'error', text: 'Failed to load cases' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCaseProgress = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/case-progress`);
      const data = await res.json();
      const map = {};
      data.forEach((item) => { map[item.case_id] = item; });
      setCaseProgress(map);
    } catch (err) {
      console.error('Failed to load case progress:', err);
    }
  };

  const fetchSkusByCase = async (caseId) => {
    const res = await fetch(`/api/sessions/${sessionId}/case/${caseId}/skus`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Case not found');
    setSkus(data);
    return data;
  };

  // ── Step handlers ──────────────────────────────────────────────
  const getProgressStatus = (percentage) => {
    if (percentage === 100) return 'completed';
    if (percentage > 0) return 'in-progress';
    return 'pending';
  };

  const getCaseStatus = (caseId) => {
    const p = caseProgress[caseId];
    if (!p) return 'pending';
    return getProgressStatus(p.percentage);
  };

  const handleCaseSelect = async (caseId) => {
    try {
      setLoading(true);
      setSelectedCase(caseId);
      setSelectedSku('');
      setDestinations([]);
      await fetchSkusByCase(caseId);
      setStep(2);
      setMessage(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Case not found' });
    } finally {
      setLoading(false);
    }
  };

  const handleSkuSelect = async (sku, lockedBy) => {
    // If locked by someone else, block
    if (lockedBy && lockedBy !== user) {
      setMessage({ type: 'error', text: `🔒 Locked by ${lockedBy} — wait for them to finish` });
      return;
    }

    try {
      setLoading(true);

      // Acquire lock first
      await acquireLock(selectedCase, sku);

      setSelectedSku(sku);
      resetConfirm();

      const res = await fetch(`/api/sessions/${sessionId}/case/${selectedCase}/sku/${sku}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'SKU not found');

      setDestinations(
        data.map((dest) => ({
          ...dest,
          actual_qty: dest.actual_qty ?? dest.qty,
          remark: dest.remark ?? '',
        }))
      );

      setStep(3);
      setMessage(null);
    } catch (err) {
      if (err.status === 409) {
        setMessage({
          type: 'error',
          text: `🔒 Locked by ${err.locked_by} — wait for them to finish`,
        });
      } else {
        setMessage({ type: 'error', text: err.message || 'SKU not found' });
      }
      activeLockRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  // ── Item confirmation ──────────────────────────────────────────
  const handleConfirmScan = (e) => {
    if (e.key !== 'Enter') return;
    const scanned = confirmScan.trim().toUpperCase();
    const expected = selectedSku.trim().toUpperCase();
    if (scanned === expected) {
      setItemConfirmed(true);
      setConfirmError('');
      setMessage({ type: 'success', text: `✓ Item confirmed — ${scanned}` });
    } else {
      setConfirmError(`Scanned: ${scanned} — Expected: ${expected}`);
      setConfirmScan('');
      setMessage({ type: 'error', text: 'Item mismatch! Check the item you are holding.' });
    }
  };

  // ── Destination handlers ───────────────────────────────────────
  const handleQuantityChange = (id, value) => {
    setDestinations((prev) =>
      prev.map((dest) =>
        dest.id === id
          ? { ...dest, actual_qty: value === '' ? '' : Math.max(0, parseInt(value, 10) || 0) }
          : dest
      )
    );
  };

  const handleRemarkChange = (id, value) => {
    setDestinations((prev) =>
      prev.map((dest) => (dest.id === id ? { ...dest, remark: value } : dest))
    );
  };

  const getDiscrepancy = (dest) => {
    const actual = dest.actual_qty === '' ? 0 : Number(dest.actual_qty ?? dest.qty);
    return actual - Number(dest.qty || 0);
  };

  const handleMarkDone = async (id) => {
    if (!itemConfirmed) {
      setMessage({ type: 'error', text: 'Scan the physical item first to confirm.' });
      confirmRef.current?.focus();
      return;
    }

    const dest = destinations.find((row) => row.id === id);
    if (!dest) return;

    const actualQty = dest.actual_qty === '' ? NaN : parseInt(dest.actual_qty, 10);
    if (isNaN(actualQty) || actualQty < 0) {
      setMessage({ type: 'error', text: 'Actual qty must be a valid non-negative number' });
      return;
    }

    const discrepancy = actualQty - Number(dest.qty || 0);
    if (discrepancy !== 0 && !String(dest.remark || '').trim()) {
      setMessage({ type: 'error', text: 'Please add a remark when there is a discrepancy' });
      return;
    }

    try {
      setSavingId(id);
      const res = await fetch(`/api/manifest/${id}/done`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_qty: actualQty, remark: dest.remark || '', done: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update item');

      setDestinations((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...data } : row))
      );

      await Promise.all([fetchCaseProgress(), fetchSkusByCase(selectedCase)]);
      setMessage({
        type: 'success',
        text: discrepancy === 0 ? 'Marked as sorted!' : 'Saved with discrepancy and remark!',
      });

      // If all destinations done, release lock
      const updatedDests = destinations.map((row) => (row.id === id ? { ...row, done: true } : row));
      if (updatedDests.every((d) => d.done)) {
        await releaseLock();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update' });
    } finally {
      setSavingId(null);
    }
  };

  const handleBack = async () => {
    if (step === 3) {
      await releaseLock();
      setStep(2);
      setSelectedSku('');
      setDestinations([]);
      resetConfirm();
      // Refresh SKU list so lock indicators update
      fetchSkusByCase(selectedCase);
    } else if (step === 2) {
      setStep(1);
      setSelectedCase('');
      setSkus([]);
    }
    setMessage(null);
  };

  const handleReset = async () => {
    await releaseLock();
    setStep(1);
    setSelectedCase('');
    setSelectedSku('');
    setSkus([]);
    setDestinations([]);
    setMessage(null);
    resetConfirm();
    fetchCases();
    fetchCaseProgress();
  };

  if (!sessionId) {
    return (
      <div className="p-8 text-center">
        <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">Please select a session first</p>
      </div>
    );
  }

  // ── UI Components ──────────────────────────────────────────────
  const NavBar = () => (
    <div className="flex items-center gap-2 md:gap-4 mb-6">
      {[1, 2, 3].map((n, i) => (
        <Fragment key={n}>
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm flex-shrink-0 transition-all"
            style={
              step >= n
                ? { background: CS_TEAL, color: 'white' }
                : { background: '#F3F4F6', color: '#9CA3AF' }
            }
          >
            {step > n ? <CheckCircle size={18} /> : n}
          </div>
          {i < 2 && (
            <div
              className="flex-1 h-1 rounded-full transition-all"
              style={{ background: step > n ? CS_TEAL : '#E5E7EB' }}
            />
          )}
        </Fragment>
      ))}
    </div>
  );

  const BackBar = ({ label }) => (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h3 className="text-lg md:text-xl font-semibold" style={{ color: CS_NAVY }}>{label}</h3>
        <p className="text-gray-500 text-sm mt-0.5">
          {step === 2 && <>Case: <span className="font-semibold">{selectedCase}</span></>}
          {step === 3 && (
            <>Case: <span className="font-semibold">{selectedCase}</span> · SKU:{' '}
              <span className="font-semibold">{selectedSku}</span></>
          )}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleBack}
          className="text-sm font-medium flex items-center gap-1"
          style={{ color: CS_TEAL }}
        >
          <ChevronLeft size={16} /> Back
        </button>
        <button onClick={handleReset} className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          Start Over
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold" style={{ color: CS_NAVY }}>Scan Workflow</h2>
        <p className="text-gray-500 mt-1">
          Session: <span className="font-semibold">{sessionName}</span>
          {user && <span className="ml-3 text-xs text-gray-400">· Operator: <span className="font-semibold">{user}</span></span>}
        </p>
      </div>

      <NavBar />

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* ── STEP 1: Select Case ── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-8 shadow-sm">
          <h3 className="text-lg font-semibold mb-5" style={{ color: CS_NAVY }}>Step 1: Select Case ID</h3>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw size={28} className="mx-auto animate-spin" style={{ color: CS_TEAL }} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {cases.map((caseId) => {
                const status = getCaseStatus(caseId);
                const progress = caseProgress[caseId];
                return (
                  <button
                    key={caseId}
                    onClick={() => handleCaseSelect(caseId)}
                    disabled={loading}
                    className={`p-4 border-2 rounded-xl transition-all font-medium text-gray-900 disabled:opacity-50 ${
                      status === 'completed' ? 'bg-green-50 border-green-400'
                      : status === 'in-progress' ? 'bg-yellow-50 border-yellow-400'
                      : 'bg-white border-gray-200'
                    }`}
                    onMouseEnter={(e) => { if (status === 'pending') e.currentTarget.style.borderColor = CS_TEAL; }}
                    onMouseLeave={(e) => { if (status === 'pending') e.currentTarget.style.borderColor = '#E5E7EB'; }}
                  >
                    <div className="text-base font-bold" style={{ color: CS_NAVY }}>{caseId}</div>
                    {progress && (
                      <div className="text-xs text-gray-400 mt-1">{progress.completed}/{progress.total}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Select SKU — with lock indicators ── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-8 shadow-sm">
          <BackBar label="Step 2: Select SKU" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {skus.map((item) => {
              const status = getProgressStatus(item.percentage);
              const isLockedByOther = item.locked_by && item.locked_by !== user;
              const isLockedByMe = item.locked_by === user;

              return (
                <button
                  key={item.sku}
                  onClick={() => handleSkuSelect(item.sku, item.locked_by)}
                  disabled={loading || isLockedByOther}
                  className={`p-4 border-2 rounded-xl font-medium disabled:cursor-not-allowed transition-all text-left ${
                    isLockedByOther ? 'bg-gray-50 border-gray-200 opacity-60'
                    : status === 'completed' ? 'bg-green-50 border-green-400'
                    : status === 'in-progress' ? 'bg-yellow-50 border-yellow-400'
                    : 'bg-white border-gray-200'
                  }`}
                  onMouseEnter={(e) => {
                    if (!isLockedByOther && status === 'pending') {
                      e.currentTarget.style.borderColor = CS_TEAL;
                      e.currentTarget.style.background = '#E6FAF7';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLockedByOther && status === 'pending') {
                      e.currentTarget.style.borderColor = '#E5E7EB';
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold" style={{ color: CS_NAVY }}>{item.sku}</div>
                    {isLockedByOther && <Lock size={13} className="text-gray-400 flex-shrink-0" />}
                    {isLockedByMe && <Unlock size={13} style={{ color: CS_TEAL }} className="flex-shrink-0" />}
                  </div>
                  <div className="text-xs text-gray-400">{item.completed}/{item.total}</div>
                  {isLockedByOther && (
                    <div className="mt-1.5 text-xs font-semibold text-gray-400 truncate">
                      🔒 {item.locked_by}
                    </div>
                  )}
                  {isLockedByMe && (
                    <div className="mt-1.5 text-xs font-semibold truncate" style={{ color: CS_TEAL }}>
                      ✏️ You
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 3: Destinations + Confirm scan ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 shadow-sm">
            <BackBar label="Step 3: Confirm Item & Mark Done" />

            {/* Item confirmation scan box */}
            <div
              className="rounded-xl p-4 mb-6 border-2 transition-all"
              style={{
                borderColor: itemConfirmed ? '#4ADE80' : confirmError ? '#F87171' : '#E5E7EB',
                background: itemConfirmed ? '#F0FDF4' : confirmError ? '#FEF2F2' : '#FAFAFA',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <ScanLine size={18} style={{ color: itemConfirmed ? '#16A34A' : CS_TEAL }} />
                <p className="text-sm font-semibold" style={{ color: CS_NAVY }}>
                  {itemConfirmed ? '✓ Item Verified' : 'Scan Physical Item to Confirm'}
                </p>
                {itemConfirmed && (
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    CONFIRMED
                  </span>
                )}
              </div>

              {!itemConfirmed ? (
                <>
                  <p className="text-xs text-gray-400 mb-3">
                    Scan the barcode on the physical item. Must match{' '}
                    <span className="font-bold" style={{ color: CS_NAVY }}>{selectedSku}</span>.
                  </p>
                  <input
                    ref={confirmRef}
                    type="text"
                    value={confirmScan}
                    onChange={(e) => { setConfirmScan(e.target.value.toUpperCase()); setConfirmError(''); }}
                    onKeyDown={handleConfirmScan}
                    placeholder="Scan barcode or type SKU + Enter"
                    className="w-full px-4 py-3 border rounded-xl text-sm font-mono tracking-widest focus:outline-none"
                    style={{ borderColor: confirmError ? '#F87171' : '#E5E7EB', color: CS_NAVY }}
                    onFocus={(e) => (e.target.style.borderColor = CS_TEAL)}
                    onBlur={(e) => (e.target.style.borderColor = confirmError ? '#F87171' : '#E5E7EB')}
                  />
                  {confirmError && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-red-600">
                      <XCircle size={13} />{confirmError}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-700 font-semibold">
                    ✓ Scanned item matches <span className="font-mono">{selectedSku}</span>
                  </p>
                  <button onClick={resetConfirm} className="text-xs text-gray-400 hover:text-gray-600 underline">
                    Re-scan
                  </button>
                </div>
              )}
            </div>

            {/* Destination rows */}
            <div className="space-y-4">
              {destinations.map((dest) => {
                const discrepancy = getDiscrepancy(dest);
                const hasDiscrepancy = discrepancy !== 0;
                const isSaving = savingId === dest.id;
                const isLocked = !itemConfirmed;

                return (
                  <div
                    key={dest.id}
                    className={`p-4 md:p-6 rounded-xl border-2 transition-all ${
                      isLocked ? 'opacity-50'
                      : dest.done
                        ? hasDiscrepancy ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-200'
                        : hasDiscrepancy ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#E6FAF7' }}>
                            <PackageCheck size={18} style={{ color: CS_TEAL }} />
                          </div>
                          <div>
                            <p className="font-bold text-lg md:text-xl" style={{ color: CS_NAVY }}>{dest.dealer}</p>
                            {dest.item_description && (
                              <p className="text-sm text-gray-500 mt-1">{dest.item_description}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Group</p>
                            <p className="font-bold text-lg mt-0.5" style={{ color: CS_TEAL }}>{dest.sort_group}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Original Qty</p>
                            <p className="font-bold text-lg text-gray-700 mt-0.5">{dest.qty}</p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1">Actual Qty</label>
                            <input
                              type="number" min="0"
                              value={dest.actual_qty}
                              onChange={(e) => handleQuantityChange(dest.id, e.target.value)}
                              disabled={isLocked}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none disabled:opacity-50"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Discrepancy</p>
                            <p className={`font-bold text-lg mt-0.5 ${
                              discrepancy === 0 ? 'text-gray-700'
                              : discrepancy > 0 ? 'text-blue-600' : 'text-red-600'
                            }`}>
                              {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1">Remark</label>
                          <textarea
                            rows={2}
                            value={dest.remark}
                            onChange={(e) => handleRemarkChange(dest.id, e.target.value)}
                            disabled={isLocked}
                            placeholder={hasDiscrepancy ? 'Explain shortage / overage / issue...' : 'Optional remark'}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none resize-none disabled:opacity-50"
                          />
                          {hasDiscrepancy && !String(dest.remark || '').trim() && (
                            <p className="text-xs text-amber-600 mt-2">Remark is required when discrepancy exists.</p>
                          )}
                        </div>
                      </div>

                      <div className="lg:w-56 flex flex-col gap-3">
                        {isLocked && (
                          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                            <ScanLine size={13} /> Scan item to unlock
                          </div>
                        )}
                        {dest.done && (
                          <div className={`flex items-center justify-center gap-2 font-semibold rounded-xl px-4 py-2.5 ${
                            hasDiscrepancy ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-700'
                          }`}>
                            <CheckCircle size={18} />
                            <span>{hasDiscrepancy ? 'Done w/ Discrepancy' : 'Done'}</span>
                          </div>
                        )}
                        <button
                          onClick={() => handleMarkDone(dest.id)}
                          disabled={isSaving || isLocked}
                          className="w-full flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold transition-opacity disabled:opacity-30"
                          style={{ background: CS_TEAL }}
                          onMouseEnter={(e) => { if (!isSaving && !isLocked) e.currentTarget.style.opacity = '0.85'; }}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                        >
                          {isSaving ? 'Saving...' : dest.done ? 'Update' : 'Save & Mark Done'}
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
