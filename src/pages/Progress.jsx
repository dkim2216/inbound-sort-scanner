import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function Progress({ sessionId, sessions }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);

  const sessionName = sessions.find(s => s.id === sessionId)?.name || '';

  useEffect(() => {
    if (sessionId) {
      fetchProgress();
      const interval = setInterval(fetchProgress, 2000);
      return () => clearInterval(interval);
    }
  }, [sessionId]);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}/progress`);
      const data = await res.json();
      setProgress(data);
    } catch (err) {
      console.error('Failed to load progress:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Please select a session first</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Progress</h2>
          <p className="text-gray-600 mt-2">Session: <span className="font-semibold">{sessionName}</span></p>
        </div>
        <button
          onClick={fetchProgress}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {progress && (
        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Completion</h3>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">{progress.completed} of {progress.total} items sorted</span>
                <span className="text-2xl font-bold text-blue-600">{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {progress.percentage === 100
                ? '✓ Session complete!'
                : `${progress.total - progress.completed} items remaining`}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-sm text-blue-600 font-medium">Total Items</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{progress.total}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <p className="text-sm text-green-600 font-medium">Completed</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{progress.completed}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
