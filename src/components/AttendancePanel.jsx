import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Send, Check, X } from 'lucide-react';
import { checkIn, getAttendanceRecordsForMonth, getTimeWorkScore } from '../api/attendance.js';
import { createLeaveRequest, getMyLeaveRequests, getPendingLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from '../api/leaveRequests.js';

const VIETTEL_RED = '#D4384E';

const LEAVE_TYPES = [
  { value: 'FULL_DAY', label: 'Nghỉ cả ngày' },
  { value: 'HALF_DAY_MORNING', label: 'Nghỉ nửa ngày (sáng)' },
  { value: 'HALF_DAY_AFTERNOON', label: 'Nghỉ nửa ngày (chiều)' },
  { value: 'LATE_ARRIVAL', label: 'Xin đến muộn' },
  { value: 'EARLY_LEAVE', label: 'Xin về sớm' },
  { value: 'BEREAVEMENT', label: 'Nghỉ việc hiếu hỷ (tối đa 3 ngày)' },
];

const formatTime = (d) => {
  if (!d) return '—';
  const str = String(d).replace(' ', 'T');
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (d) => {
  if (!d) return '';
  const str = String(d).slice(0, 10);
  return str;
};

export function AttendancePanel({ currentUser, role }) {
  const uid = Number(currentUser?.id) || currentUser?.id;
  const isAdmin = role === 'admin';

  const [todayRecord, setTodayRecord] = useState(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState('');
  const [attMonth, setAttMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [timeScore, setTimeScore] = useState(null);
  const [leaveSubTab, setLeaveSubTab] = useState('my'); // 'my' | 'request' | 'admin'
  const [myLeaves, setMyLeaves] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: 'FULL_DAY',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    fromTime: '',
    toTime: '',
    reason: '',
  });
  const [leaveSubmitError, setLeaveSubmitError] = useState('');
  const [rejectReasons, setRejectReasons] = useState({});

  const now = new Date();
  const currentTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const isLate = now.getHours() > 8 || (now.getHours() === 8 && (now.getMinutes() > 0 || now.getSeconds() > 0));
  const dow = now.getDay();
  const isWeekend = dow === 0 || dow === 6;

  const loadTodayAndRecords = async () => {
    if (!uid) return;
    setRecordsLoading(true);
    try {
      const [y, m] = attMonth.split('-').map(Number);
      const [recList, scoreRes] = await Promise.all([
        getAttendanceRecordsForMonth(uid, y, m),
        getTimeWorkScore(uid, y, m),
      ]);
      setRecords(recList);
      setTimeScore(scoreRes?.timeWorkScore ?? 0);
      const todayStr = new Date().toISOString().slice(0, 10);
      setTodayRecord(recList.find((r) => formatDate(r.recordDate) === todayStr) || null);
    } catch {
      setRecords([]);
      setTodayRecord(null);
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    loadTodayAndRecords();
  }, [uid, attMonth]);

  useEffect(() => {
    if (leaveSubTab === 'my' && uid) {
      setLeaveLoading(true);
      getMyLeaveRequests(uid)
        .then(setMyLeaves)
        .catch(() => setMyLeaves([]))
        .finally(() => setLeaveLoading(false));
    }
    if (leaveSubTab === 'admin' && isAdmin && uid) {
      setLeaveLoading(true);
      getPendingLeaveRequests(uid)
        .then(setPendingLeaves)
        .catch(() => setPendingLeaves([]))
        .finally(() => setLeaveLoading(false));
    }
  }, [leaveSubTab, uid, isAdmin]);

  const handleCheckIn = async () => {
    if (!uid) return;
    setCheckInError('');
    setCheckInLoading(true);
    try {
      const res = await checkIn(uid);
      setTodayRecord(res);
    } catch (e) {
      setCheckInError(e?.message || 'Không chấm được.');
    } finally {
      setCheckInLoading(false);
      loadTodayAndRecords();
    }
  };

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (!uid || !leaveForm.reason?.trim()) {
      setLeaveSubmitError('Vui lòng nhập lý do.');
      return;
    }
    const from = new Date(leaveForm.fromDate);
    const to = new Date(leaveForm.toDate || leaveForm.fromDate);
    const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
    if (leaveForm.type === 'BEREAVEMENT' && days > 3) {
      setLeaveSubmitError('Nghỉ việc hiếu hỷ tối đa 3 ngày (bố mẹ đẻ, ông bà, con, vợ chồng, bản thân).');
      return;
    }
    setLeaveSubmitError('');
    setLeaveLoading(true);
    try {
      await createLeaveRequest(uid, {
        type: leaveForm.type,
        fromDate: leaveForm.fromDate,
        toDate: leaveForm.toDate || leaveForm.fromDate,
        fromTime: leaveForm.fromTime || null,
        toTime: leaveForm.toTime || null,
        reason: leaveForm.reason.trim(),
      });
      setLeaveForm({ ...leaveForm, reason: '' });
      setLeaveSubTab('my');
      getMyLeaveRequests(uid).then(setMyLeaves);
    } catch (e) {
      setLeaveSubmitError(e?.message || 'Không gửi được.');
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!uid || !isAdmin) return;
    try {
      await approveLeaveRequest(id, uid);
      getPendingLeaveRequests(uid).then(setPendingLeaves);
      loadTodayAndRecords();
    } catch {}
  };

  const handleReject = async (id) => {
    if (!uid || !isAdmin) return;
    const reason = rejectReasons[id] || '';
    try {
      await rejectLeaveRequest(id, uid, reason);
      setRejectReasons((prev) => { const next = { ...prev }; delete next[id]; return next; });
      getPendingLeaveRequests(uid).then(setPendingLeaves);
    } catch {}
  };

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
        <Clock size={24} style={{ color: VIETTEL_RED }} />
        Chấm công
      </h2>

      {/* Nút chấm công + thời gian hiện tại */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <p className="text-sm text-slate-500 mb-1">Thời gian hiện tại</p>
            <p className="text-3xl font-bold text-slate-900 font-mono">{currentTime}</p>
            {isLate && !todayRecord?.checkInAt && (
              <p className="text-sm font-medium mt-2" style={{ color: VIETTEL_RED }}>
                ⚠ Làm muộn (sau 8h sáng)
              </p>
            )}
            {todayRecord?.checkInAt && (
              <p className="text-sm text-slate-600 mt-2">
                Đã chấm lúc: {formatTime(todayRecord.checkInAt)}
                {todayRecord.isLate && (
                  <span className="ml-2 font-medium" style={{ color: VIETTEL_RED }}>Làm muộn</span>
                )}
              </p>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={checkInLoading || isWeekend || !!todayRecord?.checkInAt}
              className="px-8 py-4 rounded-xl text-white font-bold text-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: VIETTEL_RED }}
            >
              {checkInLoading ? 'Đang chấm...' : todayRecord?.checkInAt ? 'Đã chấm công' : isWeekend ? 'T7, CN không chấm' : 'Chấm công'}
            </button>
            {checkInError && <p className="text-sm text-red-500 mt-2">{checkInError}</p>}
          </div>
        </div>
      </div>

      {/* Xin nghỉ / Đơn của tôi / Duyệt đơn (Admin) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex gap-1 border-b border-slate-200 p-2">
          {['my', 'request', ...(isAdmin ? ['admin'] : [])].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setLeaveSubTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                leaveSubTab === key ? 'text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              style={leaveSubTab === key ? { backgroundColor: VIETTEL_RED } : undefined}
            >
              {key === 'my' ? 'Đơn của tôi' : key === 'request' ? 'Xin nghỉ / Xin muộn' : 'Duyệt đơn'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {leaveSubTab === 'my' && (
            <>
              {leaveLoading ? (
                <p className="text-slate-500 text-sm">Đang tải...</p>
              ) : myLeaves.length === 0 ? (
                <p className="text-slate-400 text-sm">Chưa có đơn nào.</p>
              ) : (
                <ul className="space-y-3">
                  {myLeaves.map((lr) => (
                    <li key={lr.id} className="border border-slate-100 rounded-xl p-4 flex justify-between items-start gap-4">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {LEAVE_TYPES.find((t) => t.value === lr.type)?.label || lr.type}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatDate(lr.fromDate)} → {formatDate(lr.toDate)}
                          {lr.fromTime && ` ${formatTime(lr.fromTime)}`}
                          {lr.toTime && ` - ${formatTime(lr.toTime)}`}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">{lr.reason}</p>
                        <span
                          className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
                            lr.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : lr.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {lr.status === 'PENDING' ? 'Chờ duyệt' : lr.status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {leaveSubTab === 'request' && (
            <form onSubmit={handleSubmitLeave} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Loại đơn</label>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/25 outline-none"
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Từ ngày</label>
                  <input
                    type="date"
                    value={leaveForm.fromDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/25 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={leaveForm.toDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/25 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Giờ bắt đầu (nếu nửa ngày)</label>
                  <input
                    type="time"
                    value={leaveForm.fromTime}
                    onChange={(e) => setLeaveForm({ ...leaveForm, fromTime: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/25 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Giờ kết thúc (xin về sớm)</label>
                  <input
                    type="time"
                    value={leaveForm.toTime}
                    onChange={(e) => setLeaveForm({ ...leaveForm, toTime: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/25 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lý do *</label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Ghi rõ lý do xin nghỉ / xin đến muộn / xin về sớm..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/25 outline-none"
                />
              </div>
              {leaveSubmitError && <p className="text-sm text-red-500">{leaveSubmitError}</p>}
              <button
                type="submit"
                disabled={leaveLoading}
                className="px-6 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50"
                style={{ backgroundColor: VIETTEL_RED }}
              >
                {leaveLoading ? 'Đang gửi...' : 'Gửi đơn'}
              </button>
            </form>
          )}

          {leaveSubTab === 'admin' && isAdmin && (
            <>
              {leaveLoading ? (
                <p className="text-slate-500 text-sm">Đang tải...</p>
              ) : pendingLeaves.length === 0 ? (
                <p className="text-slate-400 text-sm">Không có đơn chờ duyệt.</p>
              ) : (
                <ul className="space-y-4">
                  {pendingLeaves.map((lr) => (
                    <li key={lr.id} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">{lr.userName}</p>
                          <p className="text-sm text-slate-600">
                            {LEAVE_TYPES.find((t) => t.value === lr.type)?.label || lr.type} — {formatDate(lr.fromDate)} → {formatDate(lr.toDate)}
                          </p>
                          <p className="text-sm text-slate-500 mt-1">{lr.reason}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <input
                            type="text"
                            placeholder="Lý do từ chối (nếu có)"
                            value={rejectReasons[lr.id] || ''}
                            onChange={(e) => setRejectReasons((prev) => ({ ...prev, [lr.id]: e.target.value }))}
                            className="text-sm border border-slate-200 rounded px-2 py-1 w-32"
                          />
                          <button
                            type="button"
                            onClick={() => handleApprove(lr.id)}
                            className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(lr.id)}
                            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bảng chấm công tháng + Điểm thời gian */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Bảng chấm công tháng</h3>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={attMonth}
              onChange={(e) => setAttMonth(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            />
            {timeScore != null && (
              <span className="text-sm font-medium text-slate-600">
                Điểm thời gian (thang 5): <strong>{Number(timeScore).toFixed(2)}</strong>
              </span>
            )}
          </div>
        </div>
        {recordsLoading ? (
          <p className="text-slate-500 text-sm py-4">Đang tải...</p>
        ) : records.length === 0 ? (
          <p className="text-slate-400 text-sm py-4">Chưa có bản ghi tháng này.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-medium text-slate-600">Ngày</th>
                  <th className="text-left py-2 font-medium text-slate-600">Mã</th>
                  <th className="text-left py-2 font-medium text-slate-600">Điểm</th>
                  <th className="text-left py-2 font-medium text-slate-600">Giờ vào</th>
                  <th className="text-left py-2 font-medium text-slate-600">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-2">{formatDate(r.recordDate)}</td>
                    <td className="py-2">{r.attendanceCode}</td>
                    <td className="py-2">{r.points}</td>
                    <td className="py-2">{formatTime(r.checkInAt)}</td>
                    <td className="py-2 text-slate-500">
                      {r.isLate && 'Làm muộn '}
                      {r.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
