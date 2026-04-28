import { RefreshCw, Plus, Calendar, FileText } from 'lucide-react';

export default function Sessions({ sessions, onSessionSelected, onRefresh, loading }) {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Sessions</h2>
          <p className="text-gray-600 mt-2">Manage your warehouse sorting sessions</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={20} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin">
            <RefreshCw size={32} className="text-blue-600" />
          </div>
          <p className="text-gray-600 mt-4">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
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
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-all text-left hover:border-blue-400"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{session.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar size={16} />
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-blue-600 font-medium">ID: {session.id}</span>
                  </div>
                </div>
                <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                  Ready
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
