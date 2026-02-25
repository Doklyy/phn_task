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
import { checkIn, checkOut, getAttendanceRecordsForMonth, getAttendanceRecords, getTimeWorkScore, getAttendanceCodes, updateAttendanceRecord, createAttendanceRecord } from '../api/attendance.js';
import { fetchPersonnel } from '../api/users.js';
import { createLeaveRequest, getMyLeaveRequests, getPendingLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from '../api/leaveRequests.js';

const VIETTEL_RED = '#D4384E';

/** Danh sách mã trạng thái chấm công (dùng khi API /attendance/codes chưa load). */
const ATTENDANCE_CODES_FALLBACK = [
  { code: 'L', description: 'Làm cả ngày' },
  { code: 'N_FULL', description: 'Nghỉ cả ngày (được duyệt)' },
  { code: 'N_HALF', description: 'Nghỉ nửa ngày' },
  { code: 'N_LATE', description: 'Xin đến muộn' },
  { code: 'N_EARLY', description: 'Xin về sớm' },
  { code: 'M', description: 'Đến muộn bị nhắc nhở' },
  { code: 'V', description: 'Vắng chưa được đồng ý' },
  { code: 'L_HOLIDAY', description: 'Nghỉ lễ' },
  { code: 'T_HOLIDAY', description: 'Trực lễ' },
  { code: 'CN', description: 'Nghỉ chủ nhật' },
  { code: 'T7', description: 'Nghỉ thứ 7' },
  { code: 'TT7', description: 'Trực thứ 7 (theo vòng)' },
  { code: 'TCN', description: 'Trực CN theo yêu cầu công việc' },
];

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

/** Chuyển checkInAt/checkOutAt (ISO datetime) sang "HH:mm" cho input type="time". */
const toTimeInput = (d) => {
  if (!d) return '';
  const str = String(d).replace(' ', 'T');
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return '';
  return date.toTimeString().slice(0, 5);
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
  const [attendanceCodes, setAttendanceCodes] = useState([]);
  const [rowDrafts, setRowDrafts] = useState({});
  const [savingRecordId, setSavingRecordId] = useState(null);
  const [settingAllFullDay, setSettingAllFullDay] = useState(false);

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
    if (!canManage) return;
    getAttendanceCodes()
      .then(setAttendanceCodes)
      .catch(() => setAttendanceCodes([]));
  }, [canManage]);

  /** Mặc định: Thứ 2–7 = Làm cả ngày (L), Chủ nhật = CN. Không dùng giờ vào/ra. */
  const todayDayOfWeek = new Date(todayStr).getDay();
  const defaultCode = todayDayOfWeek === 0 ? 'CN' : 'L';
  const DEFAULT_FULL_DAY = { checkInAt: '08:00', checkOutAt: '17:00', attendanceCode: 'L' };

  useEffect(() => {
    if (!canManage || personnel.length === 0) return;
    setRowDrafts((prev) => {
      const next = { ...prev };
      const isSunday = new Date(todayStr).getDay() === 0;
      const codeDefault = isSunday ? 'CN' : 'L';
      personnel.forEach((emp) => {
        const id = String(emp.id ?? emp.userId);
        const rec = todayRecordsByUser[id];
        if (rec) {
          next[id] = {
            checkInAt: rec.checkInAt ? toTimeInput(rec.checkInAt) : '08:00',
            checkOutAt: rec.checkOutAt ? toTimeInput(rec.checkOutAt) : '17:00',
            attendanceCode: rec.attendanceCode || codeDefault,
          };
        } else {
          next[id] = { checkInAt: '08:00', checkOutAt: '17:00', attendanceCode: codeDefault };
        }
      });
      return next;
    });
  }, [canManage, todayRecordsByUser, personnel.length, todayStr]);

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

  const setDraft = (empId, field, value) => {
    setRowDrafts((prev) => ({
      ...prev,
      [empId]: { ...(prev[empId] || { checkInAt: '', checkOutAt: '', attendanceCode: 'L' }), [field]: value },
    }));
  };

  const handleSaveRecord = async (empId, rec) => {
    if (!uid) return;
    const draft = rowDrafts[empId] || {};
    const checkInAt = draft.checkInAt || null;
    const checkOutAt = draft.checkOutAt || null;
    const attendanceCode = draft.attendanceCode || 'L';
    setSavingRecordId(empId);
    try {
      if (rec?.id) {
        await updateAttendanceRecord(rec.id, uid, { checkInAt, checkOutAt, attendanceCode });
      } else {
        await createAttendanceRecord(uid, Number(empId), todayStr, { checkInAt, checkOutAt, attendanceCode });
      }
      const recs = await getAttendanceRecords(uid, Number(empId), todayStr, todayStr);
      setTodayRecordsByUser((prev) => ({ ...prev, [empId]: recs?.[0] || null }));
    } catch (e) {
      console.error(e);
    } finally {
      setSavingRecordId(null);
    }
  };

  const handleBatchCheckIn = async () => {
    if (!uid || selectedIds.length === 0) return;
    for (const id of selectedIds) {
      const rec = todayRecordsByUser[String(id)];
      if (!rec?.checkInAt) await handleClockInFor(Number(id));
    }
    setSelectedIds([]);
  };

  /** Đặt tất cả nhân viên chưa có bản ghi hôm nay thành "Làm cả ngày" (L) 08:00–17:00; đã có bản ghi giữ nguyên. Sau khi lưu, mỗi người sẽ thấy trạng thái/điểm của mình. */
  const handleSetAllFullDay = async () => {
    if (!uid || personnel.length === 0) return;
    setSettingAllFullDay(true);
    try {
      const toCreate = personnel.filter((p) => {
        const id = String(p.id ?? p.userId);
        return !todayRecordsByUser[id];
      });
      const isSunday = new Date(todayStr).getDay() === 0;
      const codeDefault = isSunday ? 'CN' : 'L';
      for (const emp of toCreate) {
        const empId = Number(emp.id ?? emp.userId);
        try {
          await createAttendanceRecord(uid, empId, todayStr, {
            checkInAt: '08:00',
            checkOutAt: '17:00',
            attendanceCode: codeDefault,
          });
        } catch (e) {
          console.warn('createAttendanceRecord', empId, e);
        }
      }
      const byUser = {};
      await Promise.all(
        personnel.map(async (u) => {
          const userId = u.id ?? u.userId;
          if (!userId) return;
          try {
            const recs = await getAttendanceRecords(uid, userId, todayStr, todayStr);
            byUser[String(userId)] = recs?.[0] || null;
          } catch {
            byUser[String(userId)] = null;
          }
        })
      );
      setTodayRecordsByUser(byUser);
    } finally {
      setSettingAllFullDay(false);
    }
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

  /** Mã trạng thái cho dropdown: ưu tiên từ API, không có thì dùng danh sách mặc định. */
  const codesForSelect = attendanceCodes.length > 0 ? attendanceCodes : ATTENDANCE_CODES_FALLBACK;

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
        </div>
      </div>

      {/* Nội dung chính: Bảng nhiều người (Admin/quyền chấm) hoặc 1 card (Nhân viên) — không hiện bảng tổng, không giờ vào/ra */}
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
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={handleSetAllFullDay}
                  disabled={settingAllFullDay || personnel.length === 0}
                  className="flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {settingAllFullDay ? 'Đang đặt...' : todayDayOfWeek === 0 ? 'Đặt tất cả: Chủ nhật (CN)' : 'Đặt tất cả: Làm cả ngày'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Họ và Tên</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-12 text-center text-slate-500">Đang tải...</td>
                    </tr>
                  ) : filteredPersonnel.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-12 text-center text-slate-500 italic">Không có dữ liệu nhân viên.</td>
                    </tr>
                  ) : (
                    filteredPersonnel.map((emp) => {
                      const empId = String(emp.id ?? emp.userId);
                      const rec = todayRecordsByUser[empId];
                      const isSun = new Date(todayStr).getDay() === 0;
                      const draft = rowDrafts[empId] || { checkInAt: '08:00', checkOutAt: '17:00', attendanceCode: isSun ? 'CN' : 'L' };
                      const name = emp.name || emp.fullName || emp.username || '—';
                      const saving = savingRecordId === empId;
                      return (
                        <tr key={empId} className="hover:bg-slate-50/80 transition-colors">
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
                          <td className="px-6 py-4">
                            <select
                              value={draft.attendanceCode}
                              onChange={(e) => setDraft(empId, 'attendanceCode', e.target.value)}
                              className="w-full min-w-[180px] border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#D4384E]/20 outline-none bg-white"
                            >
                              {codesForSelect.map((c) => (
                                <option key={c.code} value={c.code}>{c.description}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleSaveRecord(empId, rec)}
                              disabled={saving}
                              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {saving ? 'Đang lưu...' : rec?.id ? 'Cập nhật' : 'Lưu'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200 text-xs text-slate-500 bg-slate-50">
              Tổng: {filteredPersonnel.length} nhân viên. Mặc định đi làm cả ngày (trừ Chủ nhật). Chỉnh trạng thái và bấm Lưu.
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

      {/* Bảng chấm công tháng (cá nhân) */}
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
