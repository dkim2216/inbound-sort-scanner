import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, ChevronRight, ArrowLeft, Users, Layers, Package, CheckCircle, Clock } from 'lucide-react';

export default function Dealers({ sessionId, sessions }) {
  const [dealers, setDealers] = useState([]);
  const [caseProgress, setCaseProgress] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const [selectedDealer, setSelectedDealer] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const sessionName = sessions.find(s => s.id === sessionId)?.name || '';

  useEffect(() => {
    if (sessionId) fetchAll();
    setSelectedDealer(null);
    setSelectedGroup(null);
  }, [sessionId]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const [dealerRes, progressRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}/dealer-summary`),
        fetch(`/api/sessions/${sessionId}/case-progress`),
      ]);
      if (!dealerRes.ok) throw new Error('Failed to load dealer summary');
      const dealerData  = await dealerRes.json();
      const progressData = progressRes.ok ? await progressRes.json() : [];

      setDealers(dealerData || []);
      const map = {};
      progressData.forEach(item => { map[item.case_id] = item; });
      setCaseProgress(map);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setDealers([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Status helpers ────────────────────────────────────────────

  const getCaseStatus = (caseId) => {
    const p = caseProgress[caseId];
    if (!p) return 'pending';
    if (p.percentage === 100) return 'completed';
    if (p.percentage > 0) return 'in-progress';
    return 'pending';
  };

  const getAggregateStatus = (caseIds) => {
    if (!caseIds.length) return 'pending';
    const statuses = caseIds.map(getCaseStatus);
    if (statuses.every(s => s === 'completed')) return 'completed';
    if (statuses.some(s => s === 'completed' || s === 'in-progress')) return 'in-progress';
    return 'pending';
  };

  const STATUS = {
    completed:    { card: 'bg-green-50 border-green-400',   badge: 'bg-green-100 text-green-700',   label: 'Complete',    Icon: CheckCircle },
    'in-progress':{ card: 'bg-yellow-50 border-yellow-400', badge: 'bg-yellow-100 text-yellow-700', label: 'In Progress', Icon: Clock },
    pending:      { card: 'bg-white border-gray-200',       badge: null,                            label: null,          Icon: null },
  };

  const StatusBadge = ({ status }) => {
    const s = STATUS[status];
    if (!s.badge) return null;
    const Icon = s.Icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>
        <Icon size={11} />{s.label}
      </span>
    );
  };

  // ── Data helpers ──────────────────────────────────────────────
  const groupsForDealer  = (d) => d.groups || [];
  const casesForGroup    = (d, g) => (d.cases || []).filter(c => c.sort_group === g);
  const caseIdsForGroup  = (d, g) => [...new Set(casesForGroup(d, g).map(c => c.case_id))];
  const totalQtyForGroup = (d, g) => casesForGroup(d, g).reduce((sum, c) => sum + (c.qty || 0), 0);
  const allCaseIds       = (d) => [...new Set((d.cases || []).map(c => c.case_id))];

  // ── Navigation ────────────────────────────────────────────────
  const goToDealer = (d) => { setSelectedDealer(d); setSelectedGroup(null); };
  const goToGroup  = (g) => setSelectedGroup(g);
  const goBack     = () => {
    if (selectedGroup)  { setSelectedGroup(null); return; }
    if (selectedDealer) { setSelectedDealer(null); }
  };

  if (!sessionId) {
    return (
      <div className="p-8 text-center">
        <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Please select a session first</p>
      </div>
    );
  }

  const Breadcrumb = () => (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6 flex-wrap">
      <button onClick={() => { setSelectedDealer(null); setSelectedGroup(null); }}
        className={`hover:text-blue-600 transition-colors ${!selectedDealer ? 'text-gray-900 font-semibold' : ''}`}>
        All Dealers
      </button>
      {selectedDealer && (<>
        <ChevronRight size={14} />
        <button onClick={() => setSelectedGroup(null)}
          className={`hover:text-blue-600 transition-colors ${!selectedGroup ? 'text-gray-900 font-semibold' : ''}`}>
          {selectedDealer.name}
        </button>
      </>)}
      {selectedGroup && (<>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-semibold">{selectedGroup}</span>
      </>)}
    </nav>
  );

  const StatusMessage = () => (
    <>
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200'
                                     : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <AlertCircle size={20} /><p>{message.text}</p>
        </div>
      )}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block animate-spin"><RefreshCw size={32} className="text-blue-600" /></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      )}
    </>
  );

  // ══════════════════════════════════════════════════════════════
  // LEVEL 3 — Cases inside a Sort Group
  // ══════════════════════════════════════════════════════════════
  if (selectedDealer && selectedGroup) {
    const cases    = casesForGroup(selectedDealer, selectedGroup);
    const totalQty = totalQtyForGroup(selectedDealer, selectedGroup);
    const st       = getAggregateStatus(caseIdsForGroup(selectedDealer, selectedGroup));

    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <PageHeader sessionName={sessionName} onRefresh={fetchAll} loading={loading} />
        <Breadcrumb />
        <button onClick={goBack} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 font-medium">
          <ArrowLeft size={18} /> Back to {selectedDealer.name}
        </button>

        <div className={`border-2 rounded-xl p-6 mb-6 ${STATUS[st].card}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <Package size={22} className="text-purple-600" />
              <h3 className="text-xl font-bold text-gray-900">{selectedGroup}</h3>
            </div>
            <StatusBadge status={st} />
          </div>
          <p className="text-gray-600 text-sm ml-9">
            {cases.length} item{cases.length !== 1 ? 's' : ''} · Total qty: <span className="font-semibold text-purple-700">{totalQty}</span>
          </p>
        </div>

        <StatusMessage />

        {!loading && (cases.length === 0 ? <EmptyState message="No cases found in this group" /> : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Case ID</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">SKU</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map((c, i) => {
                  const cst = getCaseStatus(c.case_id);
                  const p   = caseProgress[c.case_id];
                  return (
                    <tr key={i} className={`transition-colors ${
                      cst === 'completed' ? 'bg-green-50' : cst === 'in-progress' ? 'bg-yellow-50' : 'hover:bg-gray-50'
                    }`}>
                      <td className="px-5 py-3.5 font-medium text-blue-700">{c.case_id}</td>
                      <td className="px-5 py-3.5 text-gray-700">{c.sku}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={cst} />
                          {p && cst !== 'completed' && (
                            <span className="text-xs text-gray-400">{p.completed}/{p.total}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-green-600">{c.qty}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-5 py-3 font-semibold text-gray-700" colSpan={3}>Total</td>
                  <td className="px-5 py-3 text-right font-bold text-green-700">{totalQty}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // LEVEL 2 — Sort Groups inside a Dealer
  // ══════════════════════════════════════════════════════════════
  if (selectedDealer) {
    const groups     = groupsForDealer(selectedDealer);
    const dealerSt   = getAggregateStatus(allCaseIds(selectedDealer));

    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <PageHeader sessionName={sessionName} onRefresh={fetchAll} loading={loading} />
        <Breadcrumb />
        <button onClick={goBack} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 font-medium">
          <ArrowLeft size={18} /> Back to All Dealers
        </button>

        <div className={`border-2 rounded-xl p-6 mb-6 ${STATUS[dealerSt].card}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <Users size={22} className="text-blue-600" />
              <h3 className="text-2xl font-bold text-gray-900">{selectedDealer.name}</h3>
            </div>
            <StatusBadge status={dealerSt} />
          </div>
          <div className="flex gap-6 mt-3 ml-9 text-sm text-gray-600">
            <span><span className="font-bold text-blue-700">{groups.length}</span> group{groups.length !== 1 ? 's' : ''}</span>
            <span><span className="font-bold text-green-700">{selectedDealer.totalQty || 0}</span> total qty</span>
          </div>
        </div>

        <StatusMessage />

        {!loading && (groups.length === 0 ? <EmptyState message="No sort groups found for this dealer" /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group, i) => {
              const cases  = casesForGroup(selectedDealer, group);
              const qty    = totalQtyForGroup(selectedDealer, group);
              const gst    = getAggregateStatus(caseIdsForGroup(selectedDealer, group));
              return (
                <button key={i} onClick={() => goToGroup(group)}
                  className={`text-left border-2 rounded-xl p-5 hover:shadow-md transition-all group ${STATUS[gst].card}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Layers size={18} className="text-purple-600" />
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={gst} />
                      <ChevronRight size={18} className="text-gray-300 group-hover:text-purple-500 transition-colors" />
                    </div>
                  </div>
                  <p className="font-bold text-gray-900 text-lg">{group}</p>
                  <div className="mt-2 flex gap-4 text-sm text-gray-500">
                    <span>{cases.length} item{cases.length !== 1 ? 's' : ''}</span>
                    <span className="text-green-600 font-semibold">Qty: {qty}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // LEVEL 1 — All Dealers
  // ══════════════════════════════════════════════════════════════
  const completedCount  = dealers.filter(d => getAggregateStatus(allCaseIds(d)) === 'completed').length;
  const inProgressCount = dealers.filter(d => getAggregateStatus(allCaseIds(d)) === 'in-progress').length;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader sessionName={sessionName} onRefresh={fetchAll} loading={loading} />
      <StatusMessage />

      {!loading && dealers.length === 0 && !message && (
        <EmptyState message="This session doesn't have any dealers assigned" />
      )}

      {!loading && dealers.length > 0 && (<>
        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Dealers" value={dealers.length}   color="blue" />
          <StatCard label="Complete"       value={completedCount}   color="green" />
          <StatCard label="In Progress"    value={inProgressCount}  color="yellow" />
          <StatCard label="Total Qty"      value={dealers.reduce((s, d) => s + (d.totalQty || 0), 0)} color="purple" />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mb-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> Complete</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> In Progress</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> Pending</span>
        </div>

        {/* Dealer cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dealers.map((dealer, i) => {
            const st = getAggregateStatus(allCaseIds(dealer));
            return (
              <button key={i} onClick={() => goToDealer(dealer)}
                className={`text-left border-2 rounded-xl p-6 hover:shadow-md transition-all group ${STATUS[st].card}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-blue-100 p-2.5 rounded-lg">
                    <Users size={20} className="text-blue-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={st} />
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
                <p className="font-bold text-gray-900 text-xl mb-3">{dealer.name}</p>
                <div className="space-y-1.5 text-sm text-gray-500">
                  <div className="flex justify-between">
                    <span>Sort Groups</span>
                    <span className="font-semibold text-purple-600">{dealer.groups ? dealer.groups.length : 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Qty</span>
                    <span className="font-semibold text-green-600">{dealer.totalQty || 0}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </>)}
    </div>
  );
}

function PageHeader({ sessionName, onRefresh, loading }) {
  return (
    <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Dealer Summary</h2>
        <p className="text-gray-600 mt-1">Session: <span className="font-semibold">{sessionName}</span></p>
      </div>
      <button onClick={onRefresh} disabled={loading}
        className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = { blue: 'text-blue-600', purple: 'text-purple-600', green: 'text-green-600', yellow: 'text-yellow-600' };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-gray-600 text-sm">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${colors[color]}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
      <p className="text-gray-500">{message}</p>
    </div>
  );
}
