import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  CheckSquare,
  Check,
  X,
} from 'lucide-react';
import { checkIn, checkOut, getAttendanceRecordsForMonth, getAttendanceRecords, getTimeWorkScore } from '../api/attendance.js';
import { fetchPersonnel } from '../api/users.js';
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
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

const formatTimeShort = (d) => {
  if (!d) return '—';
  const str = String(d).replace(' ', 'T');
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

const formatDate = (d) => {
  if (!d) return '';
  return String(d).slice(0, 10);
};

export function AttendancePanel({ currentUser, role, canManageAttendance = false }) {
  const uid = Number(currentUser?.id) || currentUser?.id;
  const isAdmin = role === 'admin';
  const canManage = isAdmin || !!canManageAttendance;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [checkInError, setCheckInError] = useState('');
  const [attMonth, setAttMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [timeScore, setTimeScore] = useState(null);

  const [personnel, setPersonnel] = useState([]);
  const [todayRecordsByUser, setTodayRecordsByUser] = useState({});
  const [tableLoading, setTableLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const [leaveSubTab, setLeaveSubTab] = useState('my');
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

  const todayStr = currentTime.toISOString().slice(0, 10);
  const isLate = currentTime.getHours() > 8 || (currentTime.getHours() === 8 && (currentTime.getMinutes() > 0 || currentTime.getSeconds() > 0));
  const dow = currentTime.getDay();
  const isWeekend = dow === 0 || dow === 6;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTodayAndRecords = useCallback(async () => {
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
      setTodayRecord(recList.find((r) => formatDate(r.recordDate) === todayStr) || null);
    } catch {
      setRecords([]);
      setTodayRecord(null);
    } finally {
      setRecordsLoading(false);
    }
  }, [uid, attMonth, todayStr]);

  useEffect(() => {
    loadTodayAndRecords();
  }, [loadTodayAndRecords]);

  useEffect(() => {
    if (!canManage || !uid) return;
    setTableLoading(true);
    fetchPersonnel(uid)
      .then((list) => {
        setPersonnel(Array.isArray(list) ? list.filter((u) => (u.role || '').toLowerCase() !== 'admin') : []);
      })
      .catch(() => setPersonnel([]))
      .finally(() => setTableLoading(false));
  }, [canManage, uid]);

  useEffect(() => {
    if (!canManage || !uid || personnel.length === 0) {
      setTodayRecordsByUser({});
      return;
    }
    const loadTodayForAll = async () => {
      const byUser = {};
      await Promise.all(
        personnel.map(async (u) => {
          const userId = u.id ?? u.userId;
          if (!userId) return;
          try {
            const recs = await getAttendanceRecords(uid, userId, todayStr, todayStr);
            const rec = recs && recs[0] ? recs[0] : null;
            byUser[String(userId)] = rec;
          } catch {
            byUser[String(userId)] = null;
          }
        })
      );
      setTodayRecordsByUser(byUser);
    };
    loadTodayForAll();
  }, [canManage, uid, personnel, todayStr]);

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

  const handleCheckOut = async () => {
    if (!uid) return;
    setCheckInError('');
    setCheckOutLoading(true);
    try {
      const res = await checkOut(uid);
      setTodayRecord(res);
    } catch (e) {
      setCheckInError(e?.message || 'Không chấm tan ca được.');
    } finally {
      setCheckOutLoading(false);
      loadTodayAndRecords();
    }
  };

  const handleClockInFor = async (targetUserId) => {
    if (!uid) return;
    try {
      await checkIn(targetUserId);
      const recs = await getAttendanceRecords(uid, targetUserId, todayStr, todayStr);
      setTodayRecordsByUser((prev) => ({ ...prev, [String(targetUserId)]: recs?.[0] || null }));
    } catch {}
  };

  const handleClockOutFor = async (targetUserId) => {
    if (!uid) return;
    try {
      await checkOut(targetUserId);
      const recs = await getAttendanceRecords(uid, targetUserId, todayStr, todayStr);
      setTodayRecordsByUser((prev) => ({ ...prev, [String(targetUserId)]: recs?.[0] || null }));
    } catch {}
  };

  const handleBatchCheckIn = async () => {
    if (!uid || selectedIds.length === 0) return;
    for (const id of selectedIds) {
      const rec = todayRecordsByUser[String(id)];
      if (!rec?.checkInAt) await handleClockInFor(Number(id));
    }
    setSelectedIds([]);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredPersonnel.map((p) => String(p.id ?? p.userId)));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
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
      setLeaveSubmitError('Nghỉ việc hiếu hỷ tối đa 3 ngày.');
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
      setRejectReasons((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      getPendingLeaveRequests(uid).then(setPendingLeaves);
    } catch {}
  };

  const filteredPersonnel = personnel.filter(
    (p) =>
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.id ?? p.userId ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusFromRecord = (rec) => {
    if (!rec) return 'not_yet';
    if (rec.checkOutAt) return 'finished';
    return rec.isLate ? 'late' : 'present';
  };

  const stats =
    canManage && personnel.length > 0
      ? {
          total: personnel.length,
          present: personnel.filter((p) => getStatusFromRecord(todayRecordsByUser[String(p.id ?? p.userId)]) === 'present').length,
          late: personnel.filter((p) => getStatusFromRecord(todayRecordsByUser[String(p.id ?? p.userId)]) === 'late').length,
          notYet: personnel.filter((p) => getStatusFromRecord(todayRecordsByUser[String(p.id ?? p.userId)]) === 'not_yet').length,
          finished: personnel.filter((p) => getStatusFromRecord(todayRecordsByUser[String(p.id ?? p.userId)]) === 'finished').length,
        }
      : null;

  return (
    <section className="space-y-6">
      {/* Header & Clock — giống mẫu Bảng Chấm công Nhân viên */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center text-slate-900 mb-1">
            <Clock className="w-6 h-6 mr-2" style={{ color: VIETTEL_RED }} />
            {canManage ? 'Bảng Chấm công Nhân viên' : 'Chấm công'}
          </h2>
          <p className="text-slate-500 text-sm">
            {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-6">
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Thời gian hệ thống</div>
            <div className="text-3xl font-mono font-bold tracking-tight" style={{ color: VIETTEL_RED }}>
              {currentTime.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
          <div className="h-10 w-px bg-slate-200 hidden md:block" />
          <div className="hidden md:block text-right">
            <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Quy định</div>
            <div className="font-medium text-slate-800">Vào ca: 08:00</div>
          </div>
        </div>
      </div>

      {/* Quick Stats — khi có quyền xem nhiều nhân viên */}
      {canManage && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-slate-500 text-sm mb-1">Tổng cộng</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-green-500">
            <div className="text-slate-500 text-sm mb-1">Đã đến</div>
            <div className="text-2xl font-bold text-green-600">{stats.present + stats.late}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-yellow-500">
            <div className="text-slate-500 text-sm mb-1">Vào muộn</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-gray-400">
            <div className="text-slate-500 text-sm mb-1">Chưa chấm</div>
            <div className="text-2xl font-bold text-gray-600">{stats.notYet}</div>
          </div>
        </div>
      )}

      {/* Nội dung chính: Bảng nhiều người (Admin/quyền chấm) hoặc 1 card (Nhân viên) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {canManage ? (
          <>
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm tên nhân viên hoặc mã số..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4384E]/20 focus:border-[#D4384E] transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBatchCheckIn}
                  className="flex items-center px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                  style={{ backgroundColor: VIETTEL_RED }}
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Chấm công nhanh ({selectedIds.length})
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 w-12 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 focus:ring-[#D4384E]"
                        style={{ accentColor: VIETTEL_RED }}
                        checked={filteredPersonnel.length > 0 && selectedIds.length === filteredPersonnel.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4">Họ và Tên</th>
                    <th className="px-6 py-4 text-center">Trạng thái</th>
                    <th className="px-6 py-4 text-center">Giờ vào</th>
                    <th className="px-6 py-4 text-center">Giờ ra</th>
                    <th className="px-6 py-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-500">Đang tải...</td>
                    </tr>
                  ) : filteredPersonnel.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-500 italic">Không có dữ liệu nhân viên.</td>
                    </tr>
                  ) : (
                    filteredPersonnel.map((emp) => {
                      const empId = String(emp.id ?? emp.userId);
                      const rec = todayRecordsByUser[empId];
                      const status = getStatusFromRecord(rec);
                      const timeIn = rec?.checkInAt ? formatTimeShort(rec.checkInAt) : '';
                      const timeOut = rec?.checkOutAt ? formatTimeShort(rec.checkOutAt) : '';
                      const name = emp.name || emp.fullName || emp.username || '—';
                      return (
                        <tr key={empId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 text-center">
                            {status === 'not_yet' && (
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 focus:ring-[#D4384E]"
                                style={{ accentColor: VIETTEL_RED }}
                                checked={selectedIds.includes(empId)}
                                onChange={() => toggleSelect(empId)}
                              />
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                                {(name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900">{name}</div>
                                <div className="text-xs text-slate-500">{emp.username || empId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${
                                status === 'present'
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : status === 'late'
                                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                    : status === 'not_yet'
                                      ? 'bg-gray-50 text-gray-500 border border-gray-200'
                                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {status === 'not_yet' && 'Chưa chấm công'}
                              {status === 'present' && 'Đã vào ca'}
                              {status === 'late' && 'Đi muộn'}
                              {status === 'finished' && 'Đã tan ca'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-mono text-slate-700">{timeIn || '—'}</td>
                          <td className="px-6 py-4 text-center font-mono text-slate-700">{timeOut || '—'}</td>
                          <td className="px-6 py-4 text-right">
                            {status === 'not_yet' && (
                              <button
                                type="button"
                                onClick={() => handleClockInFor(Number(emp.id ?? emp.userId))}
                                className="inline-flex items-center px-4 py-2 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                style={{ backgroundColor: VIETTEL_RED }}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1.5" />
                                Vào ca
                              </button>
                            )}
                            {(status === 'present' || status === 'late') && (
                              <button
                                type="button"
                                onClick={() => handleClockOutFor(Number(emp.id ?? emp.userId))}
                                className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                              >
                                <XCircle className="w-3 h-3 mr-1.5" />
                                Tan ca
                              </button>
                            )}
                            {status === 'finished' && <span className="text-xs font-medium text-slate-400">Xong ca</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50">
              <span>Tổng: {filteredPersonnel.length} nhân viên</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-1" /> Đúng giờ</span>
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-yellow-500 mr-1" /> Đi muộn</span>
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-gray-400 mr-1" /> Chưa chấm</span>
              </div>
            </div>
          </>
        ) : (
          /* Một nhân viên: card chấm công của tôi */
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-lg">
                  {(currentUser?.name || currentUser?.username || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-lg">{currentUser?.name || currentUser?.username || 'Của tôi'}</p>
                  <p className="text-sm text-slate-500">
                    {todayRecord?.checkInAt
                      ? `Đã chấm vào lúc ${formatTime(todayRecord.checkInAt)}${todayRecord.isLate ? ' (Làm muộn)' : ''}`
                      : isWeekend
                        ? 'Thứ 7, Chủ nhật không chấm công'
                        : 'Chưa chấm công hôm nay'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!todayRecord?.checkInAt && !isWeekend && (
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={checkInLoading}
                    className="inline-flex items-center px-6 py-3 text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                    style={{ backgroundColor: VIETTEL_RED }}
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    {checkInLoading ? 'Đang chấm...' : 'Vào ca'}
                  </button>
                )}
                {todayRecord?.checkInAt && !todayRecord?.checkOutAt && (
                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={checkOutLoading}
                    className="inline-flex items-center px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5 mr-2" />
                    {checkOutLoading ? 'Đang chấm...' : 'Tan ca'}
                  </button>
                )}
                {todayRecord?.checkOutAt && (
                  <span className="text-slate-500 font-medium">Đã xong ca</span>
                )}
              </div>
            </div>
            {checkInError && <p className="text-sm text-red-500 mt-3">{checkInError}</p>}
          </div>
        )}
      </div>

      {/* Xin nghỉ / Đơn của tôi / Duyệt đơn */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex gap-1 border-b border-slate-200 p-2">
          {['my', 'request', ...(isAdmin ? ['admin'] : [])].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setLeaveSubTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${leaveSubTab === key ? 'text-white' : 'text-slate-600 hover:bg-slate-100'}`}
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
                        <p className="font-semibold text-slate-800">{LEAVE_TYPES.find((t) => t.value === lr.type)?.label || lr.type}</p>
                        <p className="text-sm text-slate-500">{formatDate(lr.fromDate)} → {formatDate(lr.toDate)}</p>
                        <p className="text-sm text-slate-600 mt-1">{lr.reason}</p>
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${lr.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : lr.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
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
                <select value={leaveForm.type} onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/25 outline-none">
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Từ ngày</label>
                  <input type="date" value={leaveForm.fromDate} onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/25 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Đến ngày</label>
                  <input type="date" value={leaveForm.toDate} onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/25 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lý do *</label>
                <textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Ghi rõ lý do..." rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/25 outline-none" />
              </div>
              {leaveSubmitError && <p className="text-sm text-red-500">{leaveSubmitError}</p>}
              <button type="submit" disabled={leaveLoading} className="px-6 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50" style={{ backgroundColor: VIETTEL_RED }}>{leaveLoading ? 'Đang gửi...' : 'Gửi đơn'}</button>
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
                          <p className="text-sm text-slate-600">{LEAVE_TYPES.find((t) => t.value === lr.type)?.label || lr.type} — {formatDate(lr.fromDate)} → {formatDate(lr.toDate)}</p>
                          <p className="text-sm text-slate-500 mt-1">{lr.reason}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <input type="text" placeholder="Lý do từ chối" value={rejectReasons[lr.id] || ''} onChange={(e) => setRejectReasons((prev) => ({ ...prev, [lr.id]: e.target.value }))} className="text-sm border border-slate-200 rounded px-2 py-1 w-32" />
                          <button type="button" onClick={() => handleApprove(lr.id)} className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"><Check size={18} /></button>
                          <button type="button" onClick={() => handleReject(lr.id)} className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"><X size={18} /></button>
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

      {/* Bảng chấm công tháng */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Bảng chấm công tháng</h3>
          <div className="flex items-center gap-2">
            <input type="month" value={attMonth} onChange={(e) => setAttMonth(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
            {timeScore != null && <span className="text-sm font-medium text-slate-600">Điểm thời gian (thang 5): <strong>{Number(timeScore).toFixed(2)}</strong></span>}
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
                    <td className="py-2 text-slate-500">{r.isLate && 'Làm muộn '}{r.note || '—'}</td>
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
