import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';

export default function UploadPage({ onSessionCreated }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !file) {
      setMessage({ type: 'error', text: 'Name and CSV file required' });
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('name', name);
      formData.append('file', file);

      const res = await fetch('/api/sessions', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Session created! ${data.rowsInserted} rows imported.` });
        setName('');
        setFile(null);
        setTimeout(() => onSessionCreated(data), 1500);
      } else {
        setMessage({ type: 'error', text: data.error || 'Upload failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Upload CSV Manifest</h2>
      <p className="text-gray-600 mb-8">Create a new sorting session by uploading your warehouse manifest</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-8">
        {/* Session Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Session Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Warehouse Batch #1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">CSV File</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0])}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <Upload size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-gray-700 font-medium">Click to upload or drag and drop</p>
              <p className="text-sm text-gray-500">CSV files only</p>
              {file && <p className="text-sm text-green-600 mt-2">✓ {file.name}</p>}
            </label>
          </div>
        </div>

        {/* CSV Format Info */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900 mb-2">CSV Format Required:</p>
          <code className="text-xs text-blue-800 block font-mono">case_id, sku, qty, sort_group, dealer</code>
          <p className="text-xs text-blue-700 mt-2">Example: C001, SKU-A, 20, GRP-1, Dealer Alpha</p>
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Uploading...' : 'Create Session'}
        </button>
      </form>
    </div>
  );
}
