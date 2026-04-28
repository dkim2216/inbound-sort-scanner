import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Dealers({ sessionId, sessions }) {
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const sessionName = sessions.find(s => s.id === sessionId)?.name || '';

  useEffect(() => {
    if (sessionId) {
      fetchDealerSummary();
    }
  }, [sessionId]);

  const fetchDealerSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}/dealer-summary`);
      if (!res.ok) throw new Error('Failed to load dealer summary');
      const data = await res.json();
      setDealers(data);
      setMessage(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Dealer Summary</h2>
          <p className="text-gray-600 mt-2">Session: <span className="font-semibold">{sessionName}</span></p>
        </div>
        <button
          onClick={fetchDealerSummary}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={20} />
          Refresh
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle size={20} />
          <p>{message.text}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin">
            <RefreshCw size={32} className="text-blue-600" />
          </div>
          <p className="text-gray-600 mt-4">Loading dealer summary...</p>
        </div>
      ) : dealers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 md:p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No dealers found</h3>
          <p className="text-gray-600">This session doesn't have any dealers assigned</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600 text-sm">Total Dealers</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{dealers.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600 text-sm">Total Groups</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {dealers.reduce((sum, d) => sum + d.groups.length, 0)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600 text-sm">Total Quantity</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {dealers.reduce((sum, d) => sum + d.totalQty, 0)}
              </p>
            </div>
          </div>

          {/* Dealer Cards */}
          {dealers.map(dealer => (
            <div key={dealer.name} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Dealer Header */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 p-6">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900">{dealer.name}</h3>
                <div className="flex flex-col md:flex-row gap-4 md:gap-8 mt-4 text-sm">
                  <div>
                    <p className="text-gray-600">Groups</p>
                    <p className="text-2xl font-bold text-blue-600">{dealer.groups.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Cases</p>
                    <p className="text-2xl font-bold text-purple-600">{dealer.cases.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Quantity</p>
                    <p className="text-2xl font-bold text-green-600">{dealer.totalQty}</p>
                  </div>
                </div>
              </div>

              {/* Dealer Content */}
              <div className="p-6">
                {/* Groups Section */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Sort Groups</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dealer.groups.map(group => (
                      <div key={group} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="font-bold text-blue-700 text-lg">{group}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cases Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Cases & Items</h4>
                  <div className="space-y-3">
                    {dealer.cases.map((caseItem, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                          <div>
                            <p className="font-bold text-gray-900">Case: <span className="text-blue-600">{caseItem.case_id}</span></p>
                            <p className="text-sm text-gray-600 mt-1">SKU: <span className="font-medium">{caseItem.sku}</span></p>
                            <p className="text-sm text-gray-600">Group: <span className="font-medium">{caseItem.sort_group}</span></p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Quantity</p>
                            <p className="text-2xl font-bold text-green-600">{caseItem.qty}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
