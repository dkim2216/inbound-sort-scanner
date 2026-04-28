import { Menu, X, Upload, Scan, BarChart3, List, Users } from 'lucide-react';
import { useState } from 'react';

export default function Sidebar({ currentPage, onPageChange, activeSession }) {
  const [isOpen, setIsOpen] = useState(true);

  const menuItems = [
    { id: 'sessions', label: 'Sessions', icon: List },
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'scan', label: 'Scan', icon: Scan, disabled: !activeSession },
    { id: 'progress', label: 'Progress', icon: BarChart3, disabled: !activeSession },
    { id: 'dealers', label: 'Dealers', icon: Users, disabled: !activeSession }
  ];

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-blue-600 text-white p-2 rounded-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`${
          isOpen ? 'w-64' : 'w-0'
        } bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden flex flex-col`}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-blue-600">Sort Scanner</h1>
          <p className="text-sm text-gray-500 mt-1">Warehouse Sorting</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            const isDisabled = item.disabled;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!isDisabled) {
                    onPageChange(item.id);
                  }
                }}
                disabled={isDisabled}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isDisabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
          <p>v1.0.0</p>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
