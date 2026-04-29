import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Sessions from './pages/Sessions';
import Upload from './pages/Upload';
import Scan from './pages/Scan';
import Progress from './pages/Progress';
import Dealers from './pages/Dealers';

export default function App() {
  const [currentPage, setCurrentPage] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionCreated = (newSession) => {
    setSessions([newSession, ...sessions]);
    setActiveSession(newSession.id);
    setCurrentPage('scan');
  };

  const handleSessionSelected = (sessionId) => {
    setActiveSession(sessionId);
    setCurrentPage('scan');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'sessions':
        return (
          <Sessions
            sessions={sessions}
            onSessionSelected={handleSessionSelected}
            onRefresh={fetchSessions}
            loading={loading}
          />
        );
      case 'upload':
        return <Upload onSessionCreated={handleSessionCreated} />;
      case 'scan':
        return (
          <Scan
            sessionId={activeSession}
            onSessionChange={setActiveSession}
            sessions={sessions}
          />
        );
      case 'progress':
        return <Progress sessionId={activeSession} sessions={sessions} />;
      case 'dealers':
        return <Dealers sessionId={activeSession} sessions={sessions} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        activeSession={activeSession}
      />
      {/* pb-16 on mobile gives clearance above the bottom tab bar */}
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        {renderPage()}
      </main>
    </div>
  );
}
