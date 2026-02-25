import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, UserCheck, Clock9, FileWarning } from 'lucide-react';
import { getAttendanceRecordsForMonth } from '../api/attendance.js';
import { getMyReports } from '../api/reports.js';

const pad = (n) => String(n).padStart(2, '0');

function buildDayInfo({ year, month, records, reports }) {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const list = [];

  const recordByDate = {};
  (records || []).forEach((r) => {
    const d = String(r.recordDate ?? r.date ?? '').slice(0, 10);
    if (!d) return;
    recordByDate[d] = r;
  });

  const reportsByDate = {};
  (reports || []).forEach((r) => {
    const d = String(r.date ?? r.reportDate).slice(0, 10);
    if (!d) return;
    if (!reportsByDate[d]) reportsByDate[d] = [];
    reportsByDate[d].push(r);
  });

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${pad(month)}-${pad(day)}`;
    const dateObj = new Date(iso);
    const dateStr = `${pad(day)}/${pad(month)}/${year}`;
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const rec = recordByDate[iso];
    const dayReports = reportsByDate[iso] || [];
    const hasReport = dayReports.length > 0;

    if (dateObj > today) {
      list.push({
        day,
        date: dateStr,
        type: 'future',
        title: 'Chưa diễn ra',
        details: ['Chưa có dữ liệu cho ngày này'],
      });
      continue;
    }

    if (isWeekend) {
      list.push({
        day,
        date: dateStr,
        type: 'weekend',
        title: 'Ngày nghỉ',
        details: ['Nghỉ cuối tuần (Thứ 7 / CN)'],
      });
      continue;
    }

    const rawCode = String(rec?.attendanceCode ?? rec?.attendance_code ?? '').trim();
    const code = rawCode.toUpperCase();
    const isLeave = code.startsWith('N_');
    const isExplicitLate = code === 'M' || code === 'N_LATE';
    const isFullDayCode = code === 'L' || code === '';
    const isLate = isExplicitLate && !isFullDayCode;

    if (!rec && !hasReport) {
      const isToday = iso === todayIso;
      list.push({
        day,
        date: dateStr,
        type: 'danger',
        title: isToday ? 'Chưa chấm công / Chưa báo cáo ngày' : 'Thiếu chấm công',
        details: isToday
          ? ['Chưa có bản ghi chấm công hôm nay', 'Chưa có báo cáo tiến độ ngày', '→ Bấm "Chấm công" trên thanh menu để vào ca; nộp báo cáo trong chi tiết từng nhiệm vụ.']
          : ['Chưa có bản ghi chấm công', 'Chưa có báo cáo tiến độ ngày'],
      });
      continue;
    }

    if (isLeave) {
      list.push({
        day,
        date: dateStr,
        type: 'danger',
        title: 'Nghỉ phép',
        details: [`Mã chấm công: ${rawCode || 'N_FULL'}`, 'Trạng thái: Nghỉ phép (đã ghi nhận)'],
      });
      continue;
    }

    if (rec && !hasReport) {
      list.push({
        day,
        date: dateStr,
        type: 'warning',
        title: 'Thiếu báo cáo',
        details: [
          'Tiến độ: Chưa nộp báo cáo tiến độ ngày',
          'Trạng thái: Cần bổ sung báo cáo',
        ],
      });
      continue;
    }

    if (isLate) {
      list.push({
        day,
        date: dateStr,
        type: 'warning',
        title: 'Đi muộn',
        details: [
          'Tiến độ: Đã báo cáo đầy đủ công việc',
          'Trạng thái: Đi muộn nhưng đã hoàn thành báo cáo',
        ],
      });
      continue;
    }

    list.push({
      day,
      date: dateStr,
      type: 'success',
      title: 'Đi làm đầy đủ',
      details: [
        'Tiến độ: Đã báo cáo đầy đủ công việc',
        'Trạng thái: Hợp lệ',
      ],
    });
  }

  return list;
}

export default function DashboardAttendanceMock({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [records, setRecords] = useState([]);
  const [reports, setReports] = useState([]);
  const [monthInfo] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  useEffect(() => {
    if (!currentUser?.id) return;
    const uid = Number(currentUser.id) || currentUser.id;
    const { year, month } = monthInfo;
    const from = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${pad(month)}-${pad(lastDay)}`;

    setLoading(true);
    setError('');
    Promise.all([
      getAttendanceRecordsForMonth(uid, year, month, null),
      getMyReports({ userId: uid, from, to }),
    ])
      .then(([recs, reps]) => {
        setRecords(Array.isArray(recs) ? recs : []);
        setReports(Array.isArray(reps) ? reps : []);
      })
      .catch(() => {
        setRecords([]);
        setReports([]);
        setError('Không tải được dữ liệu chuyên cần.');
      })
      .finally(() => setLoading(false));
  }, [currentUser?.id, monthInfo.year, monthInfo.month]);

  const days = useMemo(
    () => buildDayInfo({ year: monthInfo.year, month: monthInfo.month, records, reports }),
    [monthInfo.year, monthInfo.month, records, reports],
  );

  const stats = useMemo(() => {
    const workingDays = days.filter((d) => d.type !== 'weekend' && d.type !== 'future').length;
    const fullDays = days.filter((d) => d.type === 'success').length;
    const lateOrWarning = days.filter((d) => d.type === 'warning').length;
    const issues = days.filter((d) => d.type === 'warning' || d.type === 'danger').length;
    return {
      workingDays,
      fullDays,
      lateOrWarning,
      issues,
    };
  }, [days]);

  return (
    <div className="space-y-6">
      {/* Tổng quan Chuyên cần */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium">Ngày công chuẩn</div>
            <div className="text-2xl font-bold text-slate-800">
              {stats.workingDays}{' '}
              <span className="text-sm font-normal text-slate-400">ngày</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium">Đi làm đầy đủ</div>
            <div className="text-2xl font-bold text-slate-800">
              {stats.fullDays}{' '}
              <span className="text-sm font-normal text-slate-400">ngày</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-amber-100 p-3 rounded-lg text-amber-600">
            <Clock9 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium">Đi muộn/Về sớm</div>
            <div className="text-2xl font-bold text-slate-800">
              {stats.lateOrWarning}{' '}
              <span className="text-sm font-normal text-slate-400">lần</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-red-100 p-3 rounded-lg text-red-600">
            <FileWarning className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium">
              Quên báo cáo/Nghỉ
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {stats.issues}{' '}
              <span className="text-sm font-normal text-slate-400">lần</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lịch chuyên cần dạng hover */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
          Chi tiết ngày công - Tháng {pad(monthInfo.month)}/{monthInfo.year}
        </h3>

        <div className="grid grid-cols-7 gap-3">
          {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'].map((day) => (
            <div
              key={day}
              className="text-center font-semibold text-slate-500 text-sm py-2"
            >
              {day}
            </div>
          ))}

          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24" />
          ))}

          {days.map((item) => {
            let cellClasses = 'border border-gray-100 bg-white';
            let textClasses = 'text-slate-800';
            if (item.type === 'success') {
              cellClasses = 'bg-emerald-50 border-emerald-200';
              textClasses = 'text-emerald-700';
            }
            if (item.type === 'warning') {
              cellClasses = 'bg-amber-50 border-amber-200';
              textClasses = 'text-amber-700';
            }
            if (item.type === 'danger') {
              cellClasses = 'bg-red-50 border-red-200';
              textClasses = 'text-red-700';
            }
            if (item.type === 'weekend') {
              cellClasses = 'bg-slate-50 border-slate-100';
              textClasses = 'text-slate-400';
            }
            if (item.type === 'future') {
              cellClasses = 'bg-white border-dashed border-gray-200 opacity-60';
              textClasses = 'text-slate-400';
            }

            return (
              <div
                key={item.day}
                className={`relative group cursor-pointer h-24 rounded-xl flex flex-col justify-center items-center p-2 transition-transform hover:scale-105 hover:z-50 hover:shadow-lg ${cellClasses}`}
              >
                <span className={`text-xl font-bold ${textClasses}`}>
                  {item.day}
                </span>
                <span
                  className={`text-[10px] md:text-xs text-center mt-1 font-medium px-1 leading-tight ${textClasses}`}
                >
                  {item.title}
                </span>

                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 bg-slate-800 text-white rounded-xl p-4 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                  <div className="font-bold text-sm mb-2 border-b border-slate-600 pb-2 text-blue-200">
                    Ngày {item.date}
                  </div>
                  <ul className="space-y-1">
                    {item.details.map((detail, idx) => (
                      <li
                        key={idx}
                        className="text-xs leading-relaxed flex items-start"
                      >
                        <span className="mr-1.5">•</span>
                        <span className="flex-1">{detail}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-[6px] border-transparent border-t-slate-800" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-sm justify-center text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400" /> Đi làm đầy đủ
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400" /> Đi muộn / Thiếu báo cáo
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" /> Nghỉ phép / Vắng mặt
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-200" /> Ngày nghỉ
          </div>
        </div>
      </div>
    </div>
  );
}

