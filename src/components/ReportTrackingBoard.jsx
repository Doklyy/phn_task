import React, { useState, useEffect, useMemo } from 'react';
import { getAttendanceRecordsForMonth } from '../api/attendance.js';
import { getReportsByUser } from '../api/reports.js';
import { fetchTasksForCurrentUser } from '../api/tasks.js';
import { fetchPersonnel } from '../api/users.js';

const VIETTEL_RED = '#D4384E';

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

/** Nhiệm vụ có "active" tại ngày D không (cần báo cáo ngày đó) */
function taskActiveOnDay(task, year, month, day) {
  const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const deadline = task.deadline ? String(task.deadline).slice(0, 10) : '';
  const completedAt = task.completedAt ? String(task.completedAt).slice(0, 10) : '';
  const status = (task.status || '').toLowerCase();
  if (status === 'completed' && completedAt && completedAt < dStr) return false;
  if (deadline && deadline < dStr) return false;
  return true;
}

export function ReportTrackingBoard({ currentUser, role, canManageAttendance = false }) {
  const uid = currentUser?.id ?? currentUser?.userId;
  const isAdmin = role === 'admin';
  const canManage = isAdmin || !!canManageAttendance;

  const [monthValue, setMonthValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [allTasks, setAllTasks] = useState([]);

  const [year, month] = useMemo(() => {
    const [y, m] = monthValue.split('-').map(Number);
    return [y, m];
  }, [monthValue]);

  const dayCount = useMemo(() => daysInMonth(year, month), [year, month]);

  /** Ngày cần hiển thị cột (thường là 1..dayCount, có thể rút gọn số cột nếu quá nhiều) */
  const displayDays = useMemo(() => {
    const list = [];
    for (let d = 1; d <= dayCount; d++) list.push(d);
    return list;
  }, [dayCount]);

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
      setRows([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const buildRows = async () => {
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
            reportsByDate[key] = (reportsByDate[key] || 0) + 1;
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
        let totalWorkDays = 0;
        let daysOff = 0;
        let lateCount = 0;
        let totalRequired = 0;
        let totalSubmitted = 0;
        const daily = [];

        for (let day = 1; day <= dayCount; day++) {
          const rec = attByDate[day];
          const isLeave = rec && (rec.attendanceCode === 'N_FULL' || rec.attendanceCode === 'CN' || (rec.attendanceCode || '').startsWith('N'));
          const isHalf = rec && (rec.attendanceCode === 'N_HALF' || (rec.attendanceCode || '').includes('HALF'));
          const isLate = rec && !!rec.isLate;
          if (isLeave) daysOff += 1;
          else if (isHalf) totalWorkDays += 0.5;
          else if (!isWeekend(year, month, day)) totalWorkDays += 1;
          if (isLate) lateCount += 1;

          const required = isWeekend(year, month, day)
            ? 0
            : tasksForUser.filter((t) => taskActiveOnDay(t, year, month, day)).length;
          const submitted = reportsByDate[day] || 0;
          totalRequired += required;
          totalSubmitted += submitted;

          let status = 'none';
          if (isLeave) status = 'leave';
          else if (required > 0) {
            if (submitted >= required) status = 'enough';
            else if (submitted > 0) status = 'partial';
            else status = 'missing';
          }

          daily.push({
            day,
            required,
            submitted,
            status,
            isLate,
            isHalf,
            isLeave,
          });
        }

        const reportPct = totalRequired > 0 ? Math.round((totalSubmitted / totalRequired) * 100) : 0;
        result.push({
          userId: empId,
          name: emp.name || emp.fullName || emp.username || empIdStr,
          totalWorkDays: totalWorkDays.toFixed(1),
          daysOff,
          lateCount,
          reportProgress: `${totalSubmitted}/${totalRequired} (${reportPct}%)`,
          totalSubmitted,
          totalRequired,
          daily,
        });
      }
      if (!cancelled) setRows(result);
      setLoading(false);
    };

    buildRows();
    return () => { cancelled = true; };
  }, [uid, canManage, personnel, year, month, dayCount, allTasks, currentUser?.name, currentUser?.username]);

  if (!uid) return null;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <h3 className="text-xl font-bold text-slate-900 mb-1">Bảng Theo Dõi Báo Cáo Công Việc (Cải tiến)</h3>
        <p className="text-slate-600 text-sm mb-3">Tháng {month} / {year} – Hiển thị tỷ lệ báo cáo chi tiết</p>
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-green-500" /> Đủ báo cáo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-amber-400" /> Báo cáo thiếu
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-red-500" /> Chưa báo cáo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">0.5</span> Nửa công
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Đi muộn
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">N</span> Nghỉ phép
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">Đang tải...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">Nhân sự</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-700 border-r border-slate-200">Tổng công</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-700 border-r border-slate-200">Ngày nghỉ</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-700 border-r border-slate-200">Đi muộn</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">Tiến độ BC</th>
                {displayDays.map((d) => (
                  <th key={d} className="px-1.5 py-2 text-center font-medium text-slate-600 border-r border-slate-200 min-w-[52px]">Ngày {d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap">{row.name}</td>
                  <td className="px-3 py-2 text-center border-r border-slate-200">{row.totalWorkDays}</td>
                  <td className="px-3 py-2 text-center border-r border-slate-200">{row.daysOff}</td>
                  <td className="px-3 py-2 text-center border-r border-slate-200">{row.lateCount}</td>
                  <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap">{row.reportProgress}</td>
                  {row.daily.map((cell) => (
                    <td key={cell.day} className="px-0.5 py-1 border-r border-slate-100 align-top">
                      <div
                        className={`relative min-h-[36px] rounded flex items-center justify-center text-xs font-medium border ${
                          cell.status === 'leave'
                            ? 'bg-slate-100 text-slate-600'
                            : cell.status === 'enough'
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : cell.status === 'partial'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : cell.status === 'missing'
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}
                        title={
                          cell.status === 'leave'
                            ? 'Nghỉ phép'
                            : cell.isLate
                            ? 'Đi muộn. ' + (cell.required > 0 ? `Báo cáo: ${cell.submitted}/${cell.required}` : '')
                            : `Báo cáo: ${cell.submitted}/${cell.required}`
                        }
                      >
                        {cell.status === 'leave' && <span className="font-bold">N</span>}
                        {cell.status !== 'leave' && cell.required > 0 && (
                          <span>{cell.submitted}/{cell.required}</span>
                        )}
                        {cell.status !== 'leave' && cell.required === 0 && cell.submitted === 0 && !cell.isHalf && <span>—</span>}
                        {cell.isHalf && (
                          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">0.5</span>
                        )}
                        {cell.isLate && (
                          <span className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-orange-500" title="Đi muộn" />
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 border-t border-slate-200 bg-blue-50/80 text-sm text-slate-700">
        <p><strong>Hướng dẫn:</strong> Các ô hiển thị dưới dạng [số báo cáo] / [Tổng nhiệm vụ].</p>
        <p>Nếu có huy hiệu màu xanh ghi 0.5 ở góc trên, nhân sự được chấm nửa công.</p>
        <p>Dấu chấm màu cam ở góc trên bên trái biểu thị việc đi muộn ngày hôm đó.</p>
        <p>Bạn có thể di chuột (hover) vào từng ô để xem chi tiết.</p>
      </div>
    </section>
  );
}
