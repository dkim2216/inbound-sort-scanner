import { RefreshCw, Plus, Calendar, FileText, Send } from 'lucide-react';
import { useState } from 'react';

export default function Sessions({ sessions, onSessionSelected, onRefresh, loading }) {
  const [sendingId, setSendingId] = useState(null);
  const [message, setMessage] = useState(null);

  const handleComplete = async (sessionId, e) => {
    e.stopPropagation();
    try {
      setSendingId(sessionId);
      const res = await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Email sent successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Failed to send email' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Sessions</h2>
          <p className="text-gray-600 mt-2">Manage your warehouse sorting sessions</p>
        </div>
        <button
          onClick={onRefresh}
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
          <p>{message.text}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin">
            <RefreshCw size={32} className="text-blue-600" />
          </div>
          <p className="text-gray-600 mt-4">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 md:p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No sessions yet</h3>
          <p className="text-gray-600 mb-6">Create your first session by uploading a CSV manifest</p>
          <a href="#upload" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            <Plus size={20} className="inline mr-2" />
            Create Session
          </a>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSessionSelected(session.id)}
              className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-all text-left hover:border-blue-400"
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{session.name}</h3>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mt-2 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar size={16} />
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-blue-600 font-medium">ID: {session.id}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap text-center">
                    Ready
                  </div>
                  <button
                    onClick={(e) => handleComplete(session.id, e)}
                    disabled={sendingId === session.id}
                    className="flex items-center justify-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap transition-colors"
                  >
                    <Send size={16} />
                    {sendingId === session.id ? 'Sending...' : 'Complete'}
                  </button>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
