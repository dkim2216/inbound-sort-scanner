import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';

export default function Scan({ sessionId, sessions }) {
  const [step, setStep] = useState(1); // 1: select case, 2: select sku, 3: mark done
  const [cases, setCases] = useState([]);
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
      setStep(1);
      setSelectedCase('');
      setSelectedSku('');
    }
  }, [sessionId]);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}/cases`);
      const data = await res.json();
      setCases(data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load cases' });
    } finally {
      setLoading(false);
    }
  };

  const handleCaseSelect = async (caseId) => {
    try {
      setLoading(true);
      setSelectedCase(caseId);
      const res = await fetch(`/api/sessions/${sessionId}/case/${caseId}/skus`);
      const data = await res.json();
      setSkus(data);
      setStep(2);
      setMessage(null);
    } catch (err) {
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
      const data = await res.json();
      setDestinations(data);
      setStep(3);
      setMessage(null);
    } catch (err) {
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
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update' });
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedCase('');
    setSelectedSku('');
    setSkus([]);
    setDestinations([]);
    setMessage(null);
  };

  if (!sessionId) {
    return (
      <div className="p-8 text-center">
        <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Please select a session first</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Scan Workflow</h2>
        <p className="text-gray-600 mt-2">Session: <span className="font-semibold">{sessionName}</span></p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-4 mb-8">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          1
        </div>
        <div className={`flex-1 h-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
        <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          2
        </div>
        <div className={`flex-1 h-1 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
        <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          3
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <p>{message.text}</p>
        </div>
      )}

      {/* Step 1: Select Case */}
      {step === 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Step 1: Select Case ID</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cases.map(caseId => (
              <button
                key={caseId}
                onClick={() => handleCaseSelect(caseId)}
                disabled={loading}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all font-medium text-gray-900 disabled:opacity-50"
              >
                {caseId}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select SKU */}
      {step === 2 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Step 2: Select SKU</h3>
              <p className="text-gray-600 text-sm mt-1">Case: <span className="font-semibold">{selectedCase}</span></p>
            </div>
            <button
              onClick={handleReset}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Change Case
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {skus.map(sku => (
              <button
                key={sku}
                onClick={() => handleSkuSelect(sku)}
                disabled={loading}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all font-medium text-gray-900 disabled:opacity-50"
              >
                {sku}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Mark Done */}
      {step === 3 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Step 3: Mark as Sorted</h3>
              <p className="text-gray-600 text-sm mt-1">
                Case: <span className="font-semibold">{selectedCase}</span> | SKU: <span className="font-semibold">{selectedSku}</span>
              </p>
            </div>
            <button
              onClick={handleReset}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Start Over
            </button>
          </div>

          <div className="space-y-3">
            {destinations.map(dest => (
              <div
                key={dest.id}
                className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                  dest.done
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200 hover:border-blue-400'
                }`}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{dest.dealer}</p>
                  <div className="flex gap-4 text-sm text-gray-600 mt-1">
                    <span>Group: {dest.sort_group}</span>
                    <span>Qty: {dest.qty}</span>
                  </div>
                </div>
                {dest.done ? (
                  <div className="flex items-center gap-2 text-green-700 font-medium">
                    <CheckCircle size={20} />
                    Done
                  </div>
                ) : (
                  <button
                    onClick={() => handleMarkDone(dest.id)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Mark Done
                    <ChevronRight size={16} />
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
