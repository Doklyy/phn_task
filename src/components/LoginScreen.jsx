import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ username: username.trim(), password });
    } catch (err) {
      const msg = err?.message || '';
      if (msg === 'Failed to fetch' || msg.includes('fetch')) {
        setError('Không kết nối được máy chủ.');
      } else {
        setError(msg || 'Đăng nhập thất bại. Kiểm tra lại tên đăng nhập và mật khẩu.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-[#D4384E] flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">P</div>
          <h1 className="text-xl font-bold text-slate-900">Đăng nhập hệ thống PHN</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4384E]/20 focus:border-[#D4384E] outline-none"
              placeholder="username"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4384E]/20 focus:border-[#D4384E] outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl font-bold text-white bg-[#D4384E] hover:opacity-90 disabled:opacity-70"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}
