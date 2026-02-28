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
          const code = rec ? String(rec.attendanceCode || rec.attendance_code || '').trim().toUpperCase() : '';
          const isLeave = code.startsWith('N_') || code === 'CN';
          const isHalf = code === 'N_HALF' || code.includes('HALF');
          const isLate = code === 'M' || code === 'N_LATE';

          let workDay = 0;
          if (!isLeave) {
            if (isHalf) workDay = 0.5;
            else if (!isWeekend(year, month, day)) workDay = 1;
          }

          const totalTasks = isWeekend(year, month, day)
            ? 0
            : tasksForUser.filter((t) => taskActiveOnDay(t, year, month, day)).length;
          const reportedSet = reportsByDate[day] || null;
          const reportedTasks = reportedSet ? reportedSet.size : 0;

          days[String(day)] = {
            workDay,
            totalTasks,
            reportedTasks,
            isLate,
            isLeave: !!isLeave,
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

  if (!uid) return null;

  return (
    <section className="bg-gray-50 p-4 rounded-2xl">
      <ChuyenCanBoard
        monthLabel={monthLabel}
        monthValue={monthValue}
        onMonthChange={setMonthValue}
        data={boardData}
        displayDays={displayDays}
        loading={loading}
      />
    </section>
  );
}
