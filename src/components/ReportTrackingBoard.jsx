import React, { useState, useEffect, useMemo } from 'react';
import { getAttendanceRecordsForMonth } from '../api/attendance.js';
import { getReportsByUser } from '../api/reports.js';
import { fetchTasksForCurrentUser } from '../api/tasks.js';
import { fetchPersonnel } from '../api/users.js';
import { ChuyenCanBoard } from './ChuyenCanBoard.jsx';

/** Số ngày trong tháng */
function daysInMonth(year, month) {
  const d = new Date(year, month, 0);
  return d.getDate();
}

/** Thứ (0=CN, 1=T2, ...). Cuối tuần = nghỉ. */
function isWeekend(year, month, day) {
  const d = new Date(year, month - 1, day);
  return d.getDay() === 0 || d.getDay() === 6;
}

/** Nhiệm vụ có \"active\" tại ngày D không (cần báo cáo ngày đó) */
function taskActiveOnDay(task, year, month, day) {
  const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const status = (task.status || '').toLowerCase();
  const createdAt = task.createdAt || task.created_at || task.assignedAt || task.assigned_at || null;
  const createdStr = createdAt ? String(createdAt).slice(0, 10) : '';

  // Chưa giao thì chưa phải báo cáo
  if (createdStr && dStr < createdStr) return false;

  // Nhiệm vụ đã hoàn thành, đợi duyệt hoặc tạm dừng: không tính vào báo cáo tiến độ theo ngày
  if (status === 'completed' || status === 'pending_approval' || status === 'paused') return false;

  return true;
}

export function ReportTrackingBoard({ currentUser, role, canManageAttendance = false }) {
  const uid = currentUser?.id ?? currentUser?.userId;
  const canManage = role === 'admin' || !!canManageAttendance;

  const [monthValue, setMonthValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [nameFilter, setNameFilter] = useState('');
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [boardData, setBoardData] = useState([]);
  const [allTasks, setAllTasks] = useState([]);

  const [year, month] = useMemo(() => {
    const [y, m] = monthValue.split('-').map(Number);
    return [y, m];
  }, [monthValue]);

  const dayCount = useMemo(() => daysInMonth(year, month), [year, month]);
  const displayDays = useMemo(() => {
    const list = [];
    for (let d = 1; d <= dayCount; d++) list.push(d);
    return list;
  }, [dayCount]);

  const monthLabel = useMemo(() => `Tháng ${month} / ${year}`, [year, month]);

  useEffect(() => {
    if (!canManage || !uid) {
      setPersonnel(uid ? [{ id: uid, userId: uid, name: currentUser?.name || currentUser?.username || 'Tôi' }] : []);
      return;
    }
    setLoading(true);
    fetchPersonnel(uid)
      .then((list) => {
        const arr = Array.isArray(list) ? list.filter((u) => (u.role || '').toLowerCase() !== 'admin') : [];
        setPersonnel(arr);
      })
      .catch(() => setPersonnel([]))
      .finally(() => setLoading(false));
  }, [canManage, uid, currentUser?.name, currentUser?.username]);

  useEffect(() => {
    if (!uid) return;
    fetchTasksForCurrentUser(uid)
      .then((list) => setAllTasks(Array.isArray(list) ? list : []))
      .catch(() => setAllTasks([]));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const list = canManage ? personnel : [{ id: uid, userId: uid, name: currentUser?.name || currentUser?.username || 'Tôi' }];
    if (list.length === 0) {
      setBoardData([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const build = async () => {
      const result = [];
      for (const emp of list) {
        const empId = emp.id ?? emp.userId;
        if (!empId) continue;
        const empIdStr = String(empId);
        const [attRecords, reports] = await Promise.all([
          getAttendanceRecordsForMonth(uid, year, month, empId),
          getReportsByUser(empId),
        ]);
        if (cancelled) return;

        const reportsByDate = {};
        (reports || []).forEach((r) => {
          const d = (r.date || '').slice(0, 10);
          if (!d) return;
          const [y, m, day] = d.split('-').map(Number);
          if (y === year && m === month) {
            const key = day;
            const taskId = String(r.taskId ?? r.task_id ?? '');
            if (!taskId) return;
            if (!reportsByDate[key]) reportsByDate[key] = new Set();
            reportsByDate[key].add(taskId);
          }
        });

        const attByDate = {};
        (attRecords || []).forEach((r) => {
          const d = (r.recordDate || r.record_date || '').slice(0, 10);
          if (!d) return;
          const day = parseInt(d.split('-')[2], 10);
          attByDate[day] = r;
        });

        const tasksForUser = allTasks.filter((t) => String(t.assigneeId || t.assignee_id) === empIdStr);
        const days = {};

        for (let day = 1; day <= dayCount; day++) {
          const rec = attByDate[day];
          const weekend = isWeekend(year, month, day);
          const code = rec ? String(rec.attendanceCode || rec.attendance_code || '').trim().toUpperCase() : '';
          const isHalf = code === 'N_HALF' || code.includes('HALF');
          const isSaturdayOff = weekend
            && (code.includes('T7') || code.includes('SAT'))
            && (code.includes('NGHI') || code.includes('OFF') || code.startsWith('N_'));
          const isFullLeave = (code.startsWith('N_') && !isHalf) || code === 'CN' || !!isSaturdayOff;
          const isLate = code === 'M' || code === 'N_LATE';

          let workDay = 0;
          if (!isFullLeave) {
            if (isHalf) workDay = 0.5;
            else if (!weekend) workDay = 1;
            else if (rec) workDay = 0.5; // Thứ 7 đi làm (trực) = 0.5; không có rec hoặc mã N_T7 = nghỉ, workDay 0
          }

          const hadWork = workDay > 0;
          const totalTasks = hadWork ? tasksForUser.filter((t) => taskActiveOnDay(t, year, month, day)).length : 0;
          const reportedSet = reportsByDate[day] || null;
          const reportedTasks = reportedSet ? reportedSet.size : 0;

          days[String(day)] = {
            workDay,
            totalTasks,
            reportedTasks,
            isLate,
            isLeave: !!isFullLeave,
          };
        }

        result.push({
          id: empIdStr,
          name: emp.name || emp.fullName || emp.username || empIdStr,
          days,
        });
      }
      if (!cancelled) setBoardData(result);
      setLoading(false);
    };

    build();
    return () => { cancelled = true; };
  }, [uid, canManage, personnel, year, month, dayCount, allTasks, currentUser?.name, currentUser?.username]);

  const q = (nameFilter || '').trim().toLowerCase();
  const filteredBoardData = q
    ? boardData.filter((p) => (p.name || '').toLowerCase().includes(q))
    : boardData;

  if (!uid) return null;

  return (
    <section className="bg-gray-50 p-4 rounded-2xl">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-sm font-semibold text-slate-700">Lọc theo tên nhân viên:</label>
        <input
          type="text"
          placeholder="Gõ tên để lọc bảng..."
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-48 max-w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
      </div>
      <ChuyenCanBoard
        monthLabel={monthLabel}
        monthValue={monthValue}
        onMonthChange={setMonthValue}
        data={filteredBoardData}
        displayDays={displayDays}
        loading={loading}
      />
    </section>
  );
}
