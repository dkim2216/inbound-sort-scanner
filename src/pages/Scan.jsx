import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';

export default function Scan({ sessionId, sessions }) {
  const [step, setStep] = useState(1);
  const [cases, setCases] = useState([]);
  const [caseProgress, setCaseProgress] = useState({});
  const [skus, setSkus] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const sessionName = sessions.find(s => s.id === sessionId)?.name || '';

  useEffect(() => {
    if (sessionId) {
      fetchCases();
      fetchCaseProgress();
      setStep(1);
      setSelectedCase('');
      setSelectedSku('');
    }
  }, [sessionId]);

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
      data.forEach(item => { map[item.case_id] = item; });
      setCaseProgress(map);
    } catch (err) {
      console.error('Failed to load case progress:', err);
    }
  };

  const getCaseStatus = (caseId) => {
    const p = caseProgress[caseId];
    if (!p) return 'pending';
    if (p.percentage === 100) return 'completed';
    if (p.percentage > 0) return 'in-progress';
    return 'pending';
  };

  const handleCaseSelect = async (caseId) => {
    try {
      setLoading(true);
      setSelectedCase(caseId);
      const res = await fetch(`/api/sessions/${sessionId}/case/${caseId}/skus`);
      setSkus(await res.json());
      setStep(2);
      setMessage(null);
    } catch {
      setMessage({ type: 'error', text: 'Case not found' });
    } finally {
      setLoading(false);
    }
  };

  const handleSkuSelect = async (sku) => {
    try {
      setLoading(true);
      setSelectedSku(sku);
      const res = await fetch(`/api/sessions/${sessionId}/case/${selectedCase}/sku/${sku}`);
      setDestinations(await res.json());
      setStep(3);
      setMessage(null);
    } catch {
      setMessage({ type: 'error', text: 'SKU not found' });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDone = async (id) => {
    try {
      const res = await fetch(`/api/manifest/${id}/done`, { method: 'PATCH' });
      if (res.ok) {
        setDestinations(destinations.map(d => d.id === id ? { ...d, done: true } : d));
        setMessage({ type: 'success', text: 'Marked as sorted!' });
        fetchCaseProgress();
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update' });
    }
  };

  const handleBack = () => {
    if (step === 3) { setStep(2); setSelectedSku(''); setDestinations([]); }
    else if (step === 2) { setStep(1); setSelectedCase(''); setSkus([]); }
    setMessage(null);
  };

  const handleReset = () => {
    setStep(1); setSelectedCase(''); setSelectedSku('');
    setSkus([]); setDestinations([]); setMessage(null);
    fetchCases(); fetchCaseProgress();
  };

  if (!sessionId) {
    return (
      <div className="p-8 text-center">
        <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">Please select a session first</p>
      </div>
    );
  }

  const NavBar = () => (
    <div className="flex items-center gap-2 md:gap-4 mb-6">
      {[1, 2, 3].map((n, i) => (
        <>
          <div
            key={n}
            className="flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm flex-shrink-0 transition-all"
            style={step >= n
              ? { background: CS_TEAL, color: 'white' }
              : { background: '#F3F4F6', color: '#9CA3AF' }}
          >
            {step > n ? <CheckCircle size={18} /> : n}
          </div>
          {i < 2 && (
            <div
              key={`line-${n}`}
              className="flex-1 h-1 rounded-full transition-all"
              style={{ background: step > n ? CS_TEAL : '#E5E7EB' }}
            />
          )}
        </>
      ))}
    </div>
  );

  const BackBar = ({ label }) => (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h3 className="text-lg md:text-xl font-semibold" style={{ color: CS_NAVY }}>{label}</h3>
        <p className="text-gray-500 text-sm mt-0.5">
          {step === 2 && <>Case: <span className="font-semibold">{selectedCase}</span></>}
          {step === 3 && <>Case: <span className="font-semibold">{selectedCase}</span> · SKU: <span className="font-semibold">{selectedSku}</span></>}
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={handleBack} className="text-sm font-medium flex items-center gap-1 transition-colors" style={{ color: CS_TEAL }}>
          <ChevronLeft size={16} /> Back
        </button>
        <button onClick={handleReset} className="text-sm text-gray-400 hover:text-gray-600 font-medium">Start Over</button>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold" style={{ color: CS_NAVY }}>Scan Workflow</h2>
        <p className="text-gray-500 mt-1">Session: <span className="font-semibold">{sessionName}</span></p>
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

      {/* Step 1: Select Case */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-8 shadow-sm">
          <h3 className="text-lg font-semibold mb-5" style={{ color: CS_NAVY }}>Step 1: Select Case ID</h3>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw size={28} className="mx-auto animate-spin" style={{ color: CS_TEAL }} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {cases.map(caseId => {
                const status = getCaseStatus(caseId);
                const progress = caseProgress[caseId];
                return (
                  <button
                    key={caseId}
                    onClick={() => handleCaseSelect(caseId)}
                    disabled={loading}
                    className={`p-4 border-2 rounded-xl transition-all font-medium text-gray-900 disabled:opacity-50 ${
                      status === 'completed'   ? 'bg-green-50 border-green-400' :
                      status === 'in-progress' ? 'bg-yellow-50 border-yellow-400' :
                                                 'bg-white border-gray-200 hover:border-opacity-100'
                    }`}
                    style={status === 'pending' ? {} : {}}
                    onMouseEnter={e => { if (status === 'pending') e.currentTarget.style.borderColor = CS_TEAL; }}
                    onMouseLeave={e => { if (status === 'pending') e.currentTarget.style.borderColor = '#E5E7EB'; }}
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

      {/* Step 2: Select SKU */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-8 shadow-sm">
          <BackBar label="Step 2: Select SKU" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {skus.map(sku => (
              <button
                key={sku}
                onClick={() => handleSkuSelect(sku)}
                disabled={loading}
                className="p-4 border-2 border-gray-200 rounded-xl font-medium text-gray-800 disabled:opacity-50 transition-all"
                onMouseEnter={e => { e.currentTarget.style.borderColor = CS_TEAL; e.currentTarget.style.background = '#E6FAF7'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = 'white'; }}
              >
                {sku}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Mark Done */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-8 shadow-sm">
          <BackBar label="Step 3: Mark as Sorted" />
          <div className="space-y-3">
            {destinations.map(dest => (
              <div
                key={dest.id}
                className={`flex flex-col md:flex-row md:items-center md:justify-between p-4 md:p-6 rounded-xl border-2 transition-all ${
                  dest.done ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
                style={!dest.done ? {} : {}}
              >
                <div className="flex-1 mb-4 md:mb-0">
                  <p className="font-bold text-lg md:text-xl" style={{ color: CS_NAVY }}>{dest.dealer}</p>
                  <div className="grid grid-cols-2 gap-4 mt-3 md:flex md:gap-6">
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Group</p>
                      <p className="font-bold text-xl mt-0.5" style={{ color: CS_TEAL }}>{dest.sort_group}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Quantity</p>
                      <p className="font-bold text-xl text-green-600 mt-0.5">{dest.qty}</p>
                    </div>
                  </div>
                </div>
                {dest.done ? (
                  <div className="flex items-center gap-2 text-green-600 font-semibold">
                    <CheckCircle size={22} />
                    <span>Done</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleMarkDone(dest.id)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold transition-opacity"
                    style={{ background: CS_TEAL }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    Mark Done <ChevronRight size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
