import { Menu, X, Upload, ScanLine, BarChart3, List, Users } from 'lucide-react';
import { useState } from 'react';

const menuItems = [
  { id: 'sessions',  label: 'Sessions',  icon: List },
  { id: 'upload',    label: 'Upload',    icon: Upload },
  { id: 'scan',      label: 'Scan',      icon: ScanLine },
  { id: 'progress',  label: 'Progress',  icon: BarChart3 },
  { id: 'dealers',   label: 'Dealers',   icon: Users },
];

export default function Sidebar({ currentPage, onPageChange, activeSession }) {
  const [isOpen, setIsOpen] = useState(false); // closed by default on mobile

  const handleNavigate = (id) => {
    const item = menuItems.find(m => m.id === id);
    if (item?.disabled) return;
    onPageChange(id);
    setIsOpen(false); // always close after navigation
  };

  const items = menuItems.map(item => ({
    ...item,
    disabled: ['scan', 'progress', 'dealers'].includes(item.id) && !activeSession,
  }));

  return (
    <>
      {/* ════════════════════════════════════════
          DESKTOP — permanent sidebar (lg+)
      ════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 h-screen">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-blue-600">Sort Scanner</h1>
          <p className="text-sm text-gray-500 mt-1">Warehouse Sorting</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {items.map(({ id, label, icon: Icon, disabled }) => (
            <button
              key={id}
              onClick={() => handleNavigate(id)}
              disabled={disabled}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                currentPage === id
                  ? 'bg-blue-600 text-white'
                  : disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 text-xs text-gray-500">v1.0.0</div>
      </div>

      {/* ════════════════════════════════════════
          MOBILE — bottom tab bar (< lg)
      ════════════════════════════════════════ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
        {items.map(({ id, label, icon: Icon, disabled }) => {
          const isActive = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => handleNavigate(id)}
              disabled={disabled}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                isActive
                  ? 'text-blue-600'
                  : disabled
                  ? 'text-gray-300'
                  : 'text-gray-500 active:bg-gray-100'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={`text-[10px] font-medium ${isActive ? 'text-blue-600' : ''}`}>
                {label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
