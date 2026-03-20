import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  Briefcase,
  ListTodo,
  Filter,
  CheckSquare,
  Check,
  X,
} from 'lucide-react';
import { checkIn, checkOut, getAttendanceRecordsForMonth, getAttendanceRecords, getTimeWorkScore, getAttendanceCodes, updateAttendanceRecord, createAttendanceRecord } from '../api/attendance.js';
import { fetchPersonnel } from '../api/users.js';
import { createLeaveRequest, getMyLeaveRequests, getPendingLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from '../api/leaveRequests.js';

const VIETTEL_RED = '#D4384E';

// DISPLAY ONLY: Chuẩn hóa chức danh hiển thị theo đúng danh sách bạn cung cấp.
// Không dùng cho quyền (permission) - quyền vẫn dựa theo `role` đang truyền vào component.
const DISPLAY_TITLE_BY_PERSON = {
  'Nguyễn Đình Dũng': 'Trưởng phòng',
  'Trần Minh Nhất': 'Chuyên viên',
  'Phạm Thùy Dương': 'Nhân viên',
  'Phạm Quang Khải': 'Nhân viên',
  'Nguyễn An': 'Nhân viên',
  'Nguyễn Phụ Nam': 'Chuyên viên chính',
  'Đỗ Khánh Ly': 'Thực tập sinh',
};

const normalizeVN = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, '')
  .toLowerCase();

const normalizedDisplayTitleByPerson = Object.fromEntries(
  Object.entries(DISPLAY_TITLE_BY_PERSON).map(([k, v]) => [normalizeVN(k), v])
);

function getEmployeeDisplayTitle(emp) {
  const name = emp?.name || emp?.fullName || emp?.username || '';
  const key = normalizeVN(name);
  if (normalizedDisplayTitleByPerson[key]) return normalizedDisplayTitleByPerson[key];
  // Nếu BE chỉ trả về role/admin/leader/staff mà không có position/title thì map sang chức danh tương ứng.
  const roleKey = normalizeVN(emp?.role || '');
  if (emp?.position || emp?.title) return emp.position || emp.title;
  if (roleKey === 'admin') return 'Trưởng phòng';
  if (roleKey === 'leader') return 'Phó phòng';
  return 'Nhân viên';
}

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
  /** Ngày chấm công cho bảng: mặc định hôm nay; đổi ngày để chấm công bù hoặc sửa ngày khác. */
  const [tableDate, setTableDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [todayRecordsByUser, setTodayRecordsByUser] = useState({});
  const [tableLoading, setTableLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [attendanceCodes, setAttendanceCodes] = useState([]);
  const [rowDrafts, setRowDrafts] = useState({});
  const [savingRecordId, setSavingRecordId] = useState(null);
  const [settingAllFullDay, setSettingAllFullDay] = useState(false);
  const [tableSaveError, setTableSaveError] = useState('');
  const [tableSaveSuccess, setTableSaveSuccess] = useState('');
  const [viewMode, setViewMode] = useState('daily'); // daily | monthly
  const [monthlyRecordsByUser, setMonthlyRecordsByUser] = useState({});
  const [monthlyLoading, setMonthlyLoading] = useState(false);

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
      const isSunday = new Date(tableDate).getDay() === 0;
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
  }, [canManage, todayRecordsByUser, personnel.length, tableDate]);

  useEffect(() => {
    if (!canManage || !uid || personnel.length === 0) {
      setTodayRecordsByUser({});
      return;
    }
    const loadForDate = async () => {
      const byUser = {};
      await Promise.all(
        personnel.map(async (u) => {
          const userId = u.id ?? u.userId;
          if (!userId) return;
          try {
            const recs = await getAttendanceRecords(uid, userId, tableDate, tableDate);
            const rec = recs && recs[0] ? recs[0] : null;
            byUser[String(userId)] = rec;
          } catch {
            byUser[String(userId)] = null;
          }
        })
      );
      setTodayRecordsByUser(byUser);
    };
    loadForDate();
  }, [canManage, uid, personnel, tableDate]);

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
    setTableSaveError('');
    setTableSaveSuccess('');
    const draft = rowDrafts[empId] || {};
    const checkInAt = draft.checkInAt || null;
    const checkOutAt = draft.checkOutAt || null;
    const attendanceCode = draft.attendanceCode || 'L';
    setSavingRecordId(empId);
    try {
      if (rec?.id) {
        await updateAttendanceRecord(rec.id, uid, { checkInAt, checkOutAt, attendanceCode });
      } else {
        await createAttendanceRecord(uid, Number(empId), tableDate, { checkInAt, checkOutAt, attendanceCode });
      }
      const recs = await getAttendanceRecords(uid, Number(empId), tableDate, tableDate);
      setTodayRecordsByUser((prev) => ({ ...prev, [empId]: recs?.[0] || null }));
      setTableSaveSuccess('Đã lưu.');
      setTimeout(() => setTableSaveSuccess(''), 3000);
      if (attMonth === tableDate.slice(0, 7)) loadTodayAndRecords();
    } catch (e) {
      const msg = e?.message || 'Không lưu được. Kiểm tra quyền chấm công hoặc đã tồn tại bản ghi ngày này.';
      setTableSaveError(msg);
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

  /** Đặt tất cả nhân viên chưa có bản ghi ngày đang chọn thành "Làm cả ngày" (L) 08:00–17:00; đã có bản ghi giữ nguyên. */
  const handleSetAllFullDay = async () => {
    if (!uid || personnel.length === 0) return;
    setTableSaveError('');
    setTableSaveSuccess('');
    setSettingAllFullDay(true);
    try {
      const toCreate = personnel.filter((p) => {
        const id = String(p.id ?? p.userId);
        return !todayRecordsByUser[id];
      });
      const isSunday = new Date(tableDate).getDay() === 0;
      const codeDefault = isSunday ? 'CN' : 'L';
      let ok = 0;
      let fail = 0;
      for (const emp of toCreate) {
        const empId = Number(emp.id ?? emp.userId);
        try {
          await createAttendanceRecord(uid, empId, tableDate, {
            checkInAt: '08:00',
            checkOutAt: '17:00',
            attendanceCode: codeDefault,
          });
          ok += 1;
        } catch (e) {
          fail += 1;
        }
      }
      const byUser = {};
      await Promise.all(
        personnel.map(async (u) => {
          const userId = u.id ?? u.userId;
          if (!userId) return;
          try {
            const recs = await getAttendanceRecords(uid, userId, tableDate, tableDate);
            byUser[String(userId)] = recs?.[0] || null;
          } catch {
            byUser[String(userId)] = null;
          }
        })
      );
      setTodayRecordsByUser(byUser);
      if (fail > 0) setTableSaveError(`Đặt tất cả: ${ok} thành công, ${fail} lỗi (có thể do quyền hoặc đã tồn tại bản ghi).`);
      else if (ok > 0) {
        setTableSaveSuccess(`Đã đặt ${ok} nhân viên.`);
        setTimeout(() => setTableSaveSuccess(''), 3000);
        if (attMonth === tableDate.slice(0, 7)) loadTodayAndRecords();
      }
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

  const getStatusInfo = (code, lateFlag = false) => {
    if (lateFlag || code === 'M') {
      return { color: 'text-orange-700', bg: 'bg-orange-100', icon: <Clock size={14} />, label: 'Báo cáo trễ' };
    }
    if (['N_FULL', 'N_HALF', 'N_LATE', 'N_EARLY', 'L_HOLIDAY', 'CN', 'T7'].includes(code)) {
      return { color: 'text-slate-700', bg: 'bg-slate-200', icon: <User size={14} />, label: 'Nghỉ phép' };
    }
    if (code === 'V' || !code) {
      return { color: 'text-red-700', bg: 'bg-red-100', icon: <XCircle size={14} />, label: 'Chưa báo cáo' };
    }
    return { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <CheckCircle2 size={14} />, label: 'Đã báo cáo' };
  };

  const getDayDotClass = (code, lateFlag = false) => {
    if (lateFlag || code === 'M') return 'bg-orange-400';
    if (['N_FULL', 'N_HALF', 'N_LATE', 'N_EARLY', 'L_HOLIDAY', 'CN', 'T7'].includes(code)) return 'bg-slate-400';
    if (code === 'V' || !code) return 'bg-red-500';
    return 'bg-emerald-500';
  };

  const monthDays = React.useMemo(() => {
    const [y, m] = attMonth.split('-').map(Number);
    const days = Number.isFinite(y) && Number.isFinite(m) ? new Date(y, m, 0).getDate() : 31;
    return Array.from({ length: days }, (_, i) => i + 1);
  }, [attMonth]);

  useEffect(() => {
    if (!canManage || !uid || personnel.length === 0) {
      setMonthlyRecordsByUser({});
      return;
    }
    const [y, m] = attMonth.split('-').map(Number);
    if (!y || !m) return;
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const to = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    setMonthlyLoading(true);
    Promise.all(
      personnel.map(async (u) => {
        const userId = u.id ?? u.userId;
        if (!userId) return [String(userId), {}];
        try {
          const recs = await getAttendanceRecords(uid, userId, from, to);
          const dayMap = {};
          (recs || []).forEach((r) => {
            const d = formatDate(r.recordDate);
            if (d) dayMap[d] = r;
          });
          return [String(userId), dayMap];
        } catch {
          return [String(userId), {}];
        }
      })
    )
      .then((entries) => setMonthlyRecordsByUser(Object.fromEntries(entries)))
      .finally(() => setMonthlyLoading(false));
  }, [canManage, uid, personnel, attMonth]);

  const overview = React.useMemo(() => {
    let total = 0;
    let reported = 0;
    let missing = 0;
    let leave = 0;
    (filteredPersonnel || []).forEach((emp) => {
      total += 1;
      const id = String(emp.id ?? emp.userId);
      const rec = todayRecordsByUser[id];
      const code = rowDrafts[id]?.attendanceCode || rec?.attendanceCode || '';
      if (['N_FULL', 'N_HALF', 'N_LATE', 'N_EARLY', 'L_HOLIDAY', 'CN', 'T7'].includes(code)) leave += 1;
      else if (code === 'V' || !code) missing += 1;
      else if (rec?.isLate || code === 'M') reported += 1;
      else reported += 1;
    });
    return { total, reported, missing, leave };
  }, [filteredPersonnel, todayRecordsByUser, rowDrafts]);

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

      {/* Nội dung chính: Bảng nhiều người (Admin/quyền chấm) hoặc 1 card (Nhân viên) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {canManage ? (
          <>
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 shrink-0">
                    <span>Ngày chấm:</span>
                    <input
                      type="date"
                      value={tableDate}
                      onChange={(e) => setTableDate(e.target.value ? e.target.value.slice(0, 10) : new Date().toISOString().slice(0, 10))}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4384E]/20 focus:border-[#D4384E]"
                      title="Chọn ngày để chấm công bù hoặc sửa"
                    />
                  </label>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm tên nhân viên..."
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4384E]/20 focus:border-[#D4384E] transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSetAllFullDay}
                    disabled={settingAllFullDay || personnel.length === 0}
                    className="flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {settingAllFullDay ? 'Đang đặt...' : new Date(tableDate).getDay() === 0 ? 'Đặt tất cả: Chủ nhật (CN)' : 'Đặt tất cả: Làm cả ngày'}
                  </button>
                  <div className="flex bg-slate-200 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setViewMode('daily')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'daily' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Công việc hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('monthly')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Lưới điểm danh tháng
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {tableSaveError && (
              <div className="mx-4 mt-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {tableSaveError}
              </div>
            )}
            {tableSaveSuccess && (
              <div className="mx-4 mt-2 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                {tableSaveSuccess}
              </div>
            )}
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Tổng nhân sự</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{overview.total}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><User size={20} /></div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Đã báo cáo hôm nay</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{overview.reported}</p>
                  </div>
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><CheckCircle2 size={20} /></div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Chưa báo cáo</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{overview.missing}</p>
                  </div>
                  <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center"><XCircle size={20} /></div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Nghỉ phép</p>
                    <p className="text-2xl font-bold text-slate-600 mt-1">{overview.leave}</p>
                  </div>
                  <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center"><Briefcase size={20} /></div>
                </div>
              </div>

              {viewMode === 'daily' ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg flex items-center"><ListTodo className="mr-2 text-blue-500" size={20} /> Luồng công việc ngày {new Date(`${tableDate}T00:00:00`).toLocaleDateString('vi-VN')}</h3>
                    <button className="flex items-center text-sm text-slate-600 bg-white border border-slate-300 px-3 py-1.5 rounded-md hover:bg-slate-50">
                      <Filter size={14} className="mr-2" /> Lọc phòng ban
                    </button>
                  </div>
                  {tableLoading ? (
                    <p className="text-center text-slate-500 py-8 text-sm">Đang tải...</p>
                  ) : filteredPersonnel.length === 0 ? (
                    <p className="text-center text-slate-500 py-8 text-sm italic">Không có dữ liệu nhân viên.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredPersonnel.map((emp) => {
                        const empId = String(emp.id ?? emp.userId);
                        const rec = todayRecordsByUser[empId];
                        const isSun = new Date(tableDate).getDay() === 0;
                        const draft = rowDrafts[empId] || { checkInAt: '08:00', checkOutAt: '17:00', attendanceCode: isSun ? 'CN' : 'L' };
                        const name = emp.name || emp.fullName || emp.username || '—';
                        const saving = savingRecordId === empId;
                        const code = draft.attendanceCode || rec?.attendanceCode || (isSun ? 'CN' : 'L');
                        const status = getStatusInfo(code, !!rec?.isLate);
                        return (
                          <div key={empId} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                            <div className="p-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm">
                                  {(name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-slate-900 text-sm">{name}</h4>
                                  <p className="text-xs text-slate-500">{getEmployeeDisplayTitle(emp)}</p>
                                </div>
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${status.bg} ${status.color}`}>
                                {status.icon}
                                <span className="ml-1">{status.label}</span>
                              </span>
                            </div>
                            <div className="p-4 flex-1">
                              {(code === 'V' || !code) ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-6">
                                  <XCircle size={30} className="text-red-300 mb-2" />
                                  <p className="text-sm">Chưa cập nhật công việc</p>
                                  <button className="mt-3 text-xs bg-red-50 text-red-600 px-3 py-1 rounded border border-red-200 hover:bg-red-100">Nhắc nhở</button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div>
                                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Đang làm hôm nay</h5>
                                    <ul className="space-y-1.5 text-sm text-slate-700">
                                      <li className="flex items-start"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 mr-2 shrink-0" />Mã chấm công: {code}</li>
                                      <li className="flex items-start"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 mr-2 shrink-0" />Giờ vào: {formatTimeShort(rec?.checkInAt)}</li>
                                      <li className="flex items-start"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 mr-2 shrink-0" />Giờ ra: {formatTimeShort(rec?.checkOutAt)}</li>
                                    </ul>
                                  </div>
                                  <div className="pt-3 border-t border-slate-100">
                                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Đã xong hôm qua</h5>
                                    <p className="text-xs text-slate-500 line-through">{rec?.note || 'Đã cập nhật chấm công đầy đủ.'}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="p-4 border-t border-slate-100">
                              <div className="space-y-2">
                                <select
                                  value={draft.attendanceCode}
                                  onChange={(e) => setDraft(empId, 'attendanceCode', e.target.value)}
                                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#D4384E]/20 outline-none bg-white"
                                >
                                  {codesForSelect.map((c) => (
                                    <option key={c.code} value={c.code}>{c.description}</option>
                                  ))}
                                </select>
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveRecord(empId, rec)}
                                    disabled={saving}
                                    className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                  >
                                    {saving ? 'Đang lưu...' : rec?.id ? 'Cập nhật' : 'Lưu'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                    <div className="flex items-center space-x-2">
                      <button className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50"><ChevronLeft size={16} /></button>
                      <span className="font-semibold text-sm px-2">Tháng {attMonth.slice(5, 7)} / {attMonth.slice(0, 4)}</span>
                      <button className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50"><ChevronRight size={16} /></button>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-emerald-500 mr-1.5" /> Đủ báo cáo</div>
                      <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-orange-400 mr-1.5" /> Báo cáo trễ</div>
                      <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-red-500 mr-1.5" /> Thiếu báo cáo</div>
                      <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-slate-400 mr-1.5" /> Nghỉ/Lễ</div>
                    </div>
                  </div>
                  {monthlyLoading ? (
                    <p className="text-center text-slate-500 py-8 text-sm">Đang tải dữ liệu tháng...</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white border-b border-slate-200">
                          <tr>
                            <th className="p-4 font-semibold text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-64">Nhân sự</th>
                            <th className="p-4 font-semibold text-center text-slate-700 border-r border-slate-100">
                              <div className="flex flex-col items-center"><span className="text-xs text-slate-400">Tỷ lệ</span><span className="text-emerald-600">Báo cáo</span></div>
                            </th>
                            <th className="p-4 font-semibold text-center text-slate-700 border-r border-slate-100">
                              <div className="flex flex-col items-center"><span className="text-xs text-slate-400">Vi phạm</span><span className="text-red-500">Thiếu</span></div>
                            </th>
                            {monthDays.map((day) => (
                              <th key={day} className="p-2 font-medium text-center text-slate-500 min-w-[36px] border-r border-slate-50 last:border-r-0">{day}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPersonnel.map((emp) => {
                            const empId = String(emp.id ?? emp.userId);
                            const recMap = monthlyRecordsByUser[empId] || {};
                            let totalWork = 0;
                            let reported = 0;
                            let missing = 0;
                            return (
                              <tr key={empId} className="hover:bg-blue-50/30 transition-colors">
                                <td className="p-4 sticky left-0 bg-white z-10 border-r border-slate-200 w-64">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                                      {(emp.name || emp.username || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="truncate">
                                      <p className="font-medium text-slate-900 truncate">{emp.name || emp.username || '—'}</p>
                                      <p className="text-[11px] text-slate-500 truncate">{getEmployeeDisplayTitle(emp)}</p>
                                    </div>
                                  </div>
                                </td>
                                {(() => {
                                  monthDays.forEach((d) => {
                                    const dStr = `${attMonth}-${String(d).padStart(2, '0')}`;
                                    const rec = recMap[dStr];
                                    const code = rec?.attendanceCode || '';
                                    if (!['CN', 'T7'].includes(code)) totalWork += 1;
                                    if (code === 'V' || !code) missing += 1;
                                    else if (!['N_FULL', 'N_HALF', 'N_LATE', 'N_EARLY', 'L_HOLIDAY', 'CN', 'T7'].includes(code)) reported += 1;
                                  });
                                  return null;
                                })()}
                                <td className="p-4 text-center border-r border-slate-100">
                                  <span className="font-semibold text-emerald-600">{reported}</span>
                                  <span className="text-xs text-slate-400">/{Math.max(totalWork, 1)}</span>
                                </td>
                                <td className="p-4 text-center border-r border-slate-100">
                                  {missing > 0 ? <span className="font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">{missing}</span> : <span className="text-slate-300">-</span>}
                                </td>
                                {monthDays.map((d) => {
                                  const dStr = `${attMonth}-${String(d).padStart(2, '0')}`;
                                  const rec = recMap[dStr];
                                  const code = rec?.attendanceCode || '';
                                  const dotClass = getDayDotClass(code, !!rec?.isLate);
                                  return (
                                    <td key={d} className="p-1 border-r border-slate-50 last:border-r-0 text-center relative group cursor-pointer">
                                      <div className="flex justify-center items-center h-full w-full py-2">
                                        <div className={`w-3.5 h-3.5 rounded-full ${dotClass} ${!rec ? 'opacity-40' : 'opacity-100'} group-hover:ring-4 ring-slate-200 transition-all`} />
                                      </div>
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-slate-900 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg transition-opacity text-left">
                                        <p className="font-semibold border-b border-slate-700 pb-1 mb-1">Ngày {dStr.slice(8, 10)}/{dStr.slice(5, 7)}</p>
                                        <p>Mã: {code || 'V'}</p>
                                        <p>Giờ vào: {formatTimeShort(rec?.checkInAt)}</p>
                                        <p>Giờ ra: {formatTimeShort(rec?.checkOutAt)}</p>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
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
