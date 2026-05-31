import { useState, useEffect } from 'react';
import { LogIn, User, RefreshCw } from 'lucide-react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';

export default function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [savedSession, setSavedSession] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check for a saved session to offer resume
    const savedUser = localStorage.getItem('sorter_user');
    const savedSessionId = localStorage.getItem('sorter_active_session');
    const savedSessionName = localStorage.getItem('sorter_active_session_name');
    const savedAt = localStorage.getItem('sorter_saved_at');

    if (savedUser && savedSessionId) {
      setSavedSession({
        user: savedUser,
        sessionId: savedSessionId,
        sessionName: savedSessionName || `Session #${savedSessionId}`,
        savedAt: savedAt ? new Date(savedAt).toLocaleString() : null,
      });
      setName(savedUser);
    }
  }, []);

  const handleLogin = (resume) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);

    if (!resume) {
      // Clear active session so they start fresh
      localStorage.removeItem('sorter_active_session');
      localStorage.removeItem('sorter_active_session_name');
      localStorage.removeItem('sorter_saved_at');
    }

    localStorage.setItem('sorter_user', trimmed);
    onLogin(trimmed, resume ? savedSession?.sessionId : null);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#F8FAFB' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: CS_TEAL }}
          >
            <RefreshCw size={26} color="white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: CS_NAVY }}>
            Cello Square
          </h1>
          <p className="text-sm text-gray-400 mt-1 tracking-wide">Inbound Hub Scanner</p>
        </div>

        {/* Resume card — shown only if previous session exists */}
        {savedSession && (
          <div
            className="rounded-2xl p-4 mb-4 border-2"
            style={{ background: '#E6FAF7', borderColor: CS_TEAL }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: CS_TEAL }}>
              ⚡ Active session found
            </p>
            <p className="font-semibold text-sm" style={{ color: CS_NAVY }}>
              {savedSession.sessionName}
            </p>
            {savedSession.savedAt && (
              <p className="text-xs text-gray-400 mt-0.5">Last active: {savedSession.savedAt}</p>
            )}
          </div>
        )}

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: CS_NAVY }}>
              Your Name
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(!!savedSession)}
                placeholder="e.g. David"
                autoFocus
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none transition-colors"
                onFocus={(e) => (e.target.style.borderColor = CS_TEAL)}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>
          </div>

          {savedSession ? (
            <div className="space-y-2">
              <button
                onClick={() => handleLogin(true)}
                disabled={!name.trim() || loading}
                className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl font-semibold disabled:opacity-40 transition-opacity"
                style={{ background: CS_TEAL }}
              >
                <LogIn size={18} />
                Continue Session
              </button>
              <button
                onClick={() => handleLogin(false)}
                disabled={!name.trim() || loading}
                className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Start New Session
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleLogin(false)}
              disabled={!name.trim() || loading}
              className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl font-semibold disabled:opacity-40 transition-opacity"
              style={{ background: CS_TEAL }}
            >
              <LogIn size={18} />
              Enter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
