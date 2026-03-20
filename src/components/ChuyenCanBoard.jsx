import React from 'react';
import { LayoutGrid, CalendarDays } from 'lucide-react';

/**
 * Bảng chuyên cần – Freeze Panes: 5 cột trái cố định (Nhân sự, C.Tổng, Nghỉ, Muộn, Tiến độ), cột ngày cuộn ngang.
 * Ô hiển thị [đã báo cáo tiến độ] / [tổng nhiệm vụ]; màu đủ/thiếu/chưa; N = nghỉ phép, 0.5 = nửa công, chấm cam = đi muộn.
 */
function renderCell(dayData, day) {
  if (!dayData) return <div className="flex items-center justify-center h-full text-gray-200 font-light">-</div>;

  if (dayData.isLeave) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-gray-50/50 border border-transparent rounded-md" title="Nghỉ phép">
        <span className="text-gray-400 font-bold">N</span>
      </div>
    );
  }

  const isHalfDay = dayData.workDay === 0.5;
  const isLate = dayData.isLate;
  const hasTasks = dayData.totalTasks > 0;
  const reportedAll = dayData.reportedTasks === dayData.totalTasks;
  const reportedNone = dayData.reportedTasks === 0;
  const reportedPartial = dayData.reportedTasks > 0 && dayData.reportedTasks < dayData.totalTasks;

  let bgColor = 'bg-white';
  let textColor = 'text-gray-700';
  let borderColor = 'border-gray-200';

  if (hasTasks) {
    if (reportedAll) {
      bgColor = 'bg-emerald-50';
      textColor = 'text-emerald-700';
      borderColor = 'border-emerald-200';
    } else if (reportedPartial) {
      bgColor = 'bg-amber-50';
      textColor = 'text-amber-700';
      borderColor = 'border-amber-300';
    } else if (reportedNone) {
      bgColor = 'bg-rose-50';
      textColor = 'text-rose-700';
      borderColor = 'border-rose-300';
    }
  }

  const tooltipText = `Ngày ${day} - Công: ${dayData.workDay} ngày${isLate ? ' (Đi muộn)' : ''}\nBáo cáo tiến độ: ${dayData.reportedTasks} / ${dayData.totalTasks} nhiệm vụ`;

  return (
    <div
      className={`relative flex flex-col items-center justify-center w-full h-[52px] border ${borderColor} ${bgColor} rounded-md transition-all hover:shadow-md cursor-default`}
      title={tooltipText}
    >
      {isLate && (
        <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-orange-500 rounded-full border-2 border-white shadow-sm z-10" title="Đi muộn" />
      )}
      {isHalfDay && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10">
          0.5
        </div>
      )}
      {hasTasks ? (
        <div className="flex flex-col items-center">
          <span className={`text-sm font-bold tracking-wider ${textColor}`}>
            {dayData.reportedTasks}
            <span className="text-xs font-normal opacity-70">/{dayData.totalTasks}</span>
          </span>
        </div>
      ) : (
        <span className="text-[10px] text-gray-400 text-center leading-tight px-1">
          Không có
          <br />
          task
        </span>
      )}
    </div>
  );
}

export function ChuyenCanBoard({ monthLabel, monthValue, onMonthChange, data, displayDays, loading, ranking, allReportsList }) {
  const daysList = displayDays && displayDays.length > 0 ? displayDays : Array.from({ length: 31 }, (_, i) => i + 1);
  const selectedMonth = (monthValue || '').slice(0, 7);
  const maxDayInMonth = daysList.length > 0 ? Math.max(...daysList) : 1;
  const [focusDay, setFocusDay] = React.useState(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return selectedMonth === currentMonth ? Math.min(now.getDate(), maxDayInMonth) : maxDayInMonth;
  });

  React.useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextFocus = selectedMonth === currentMonth ? Math.min(now.getDate(), maxDayInMonth) : maxDayInMonth;
    setFocusDay(nextFocus);
  }, [selectedMonth, maxDayInMonth]);

  /** 'grid' = bảng theo tháng; 'daily' = tiến độ theo ngày (tách riêng) */
  const [boardSection, setBoardSection] = React.useState('grid');
  const rankingByUserId = React.useMemo(() => {
    const m = {};
    (ranking || []).forEach((r) => {
      const uid = String(r.userId ?? r.user_id ?? '');
      if (uid) m[uid] = r;
    });
    return m;
  }, [ranking]);

  const dashboardSummary = React.useMemo(() => {
    const clampedFocusDay = Math.min(Math.max(Number(focusDay) || 1, 1), maxDayInMonth);
    const focusKey = String(clampedFocusDay);

    let totalStaff = 0;
    let reportedToday = 0;
    let missingToday = 0;
    let leaveToday = 0;
    const reportedNames = [];
    const missingNames = [];
    const leaveNames = [];
    const reportedDetails = [];

    (data || []).forEach((person) => {
      totalStaff += 1;
      const d = person?.days?.[focusKey];
      if (!d) return;
      if (d.isLeave) {
        leaveToday += 1;
        leaveNames.push(person?.name || `ID ${person?.id ?? '—'}`);
        return;
      }
      if ((d.totalTasks || 0) > 0) {
        if ((d.reportedTasks || 0) > 0) {
          reportedToday += 1;
          const personName = person?.name || `ID ${person?.id ?? '—'}`;
          reportedNames.push(personName);
          const titles = Array.isArray(d.reportedTaskTitles) ? d.reportedTaskTitles : [];
          reportedDetails.push({
            name: personName,
            titles,
            ratio: `${d.reportedTasks}/${d.totalTasks}`,
            userId: String(person?.id ?? person?.userId ?? ''),
          });
        } else {
          missingToday += 1;
          missingNames.push(person?.name || `ID ${person?.id ?? '—'}`);
        }
      }
    });

    const dayLabel = `${String(clampedFocusDay).padStart(2, '0')}/${monthValue?.slice(5, 7) || '—'}/${monthValue?.slice(0, 4) || '—'}`;
    return {
      totalStaff,
      reportedToday,
      missingToday,
      leaveToday,
      reportedNames,
      missingNames,
      leaveNames,
      reportedDetails,
      focusDay: clampedFocusDay,
      dayLabel,
    };
  }, [data, monthValue, focusDay, maxDayInMonth]);

  const [reportDetailModal, setReportDetailModal] = React.useState(null); // { userId, name }
  const focusMonth = (monthValue || '').slice(0, 7);
  const focusDateStr = focusMonth && dashboardSummary?.focusDay
    ? `${focusMonth}-${String(dashboardSummary.focusDay).padStart(2, '0')}`
    : '';

  const detailReports = React.useMemo(() => {
    if (!reportDetailModal?.userId || !focusDateStr) return [];
    const uid = String(reportDetailModal.userId);
    return (allReportsList || [])
      .filter((r) => {
        const d = (r.date || r.reportDate || '').slice(0, 10);
        const rUid = String(r.userId ?? r.user_id ?? '');
        return d === focusDateStr && rUid === uid;
      })
      .sort((a, b) => String(a.taskTitle || '').localeCompare(String(b.taskTitle || '')));
  }, [reportDetailModal, allReportsList, focusDateStr]);

  return (
    <div className="w-full mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Bảng Theo Dõi Báo Cáo Công Việc</h1>
          <p className="text-sm text-gray-500 mt-1">{monthLabel} </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onMonthChange && (
            <input
              type="month"
              value={monthValue || ''}
              onChange={(e) => onMonthChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          )}
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200 block" /><span className="text-gray-600">Đủ báo cáo</span></span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-amber-100 border border-amber-300 block" /><span className="text-gray-600">Báo cáo thiếu</span></span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-rose-100 border border-rose-300 block" /><span className="text-gray-600">Chưa báo cáo</span></span>
            <span className="flex items-center gap-1.5"><span className="w-6 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold text-center">0.5</span><span className="text-gray-600">Nửa công</span></span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500 block" /><span className="text-gray-600">Đi muộn</span></span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 text-center text-gray-400 font-bold text-xs">N</span><span className="text-gray-600">Nghỉ phép</span></span>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 pb-3 border-b border-slate-200 bg-slate-50/40">
        <div className="inline-flex p-1 rounded-xl bg-slate-200/60 gap-1">
          <button
            type="button"
            onClick={() => setBoardSection('grid')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              boardSection === 'grid'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <LayoutGrid size={18} className="shrink-0 opacity-80" />
            Bảng công theo tháng
          </button>
          <button
            type="button"
            onClick={() => setBoardSection('daily')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              boardSection === 'daily'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <CalendarDays size={18} className="shrink-0 opacity-80" />
            Tiến độ theo ngày
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {boardSection === 'grid'
            ? 'Xem tổng quan ô theo ngày trong tháng. Chuyển sang tab bên cạnh để xem chi tiết báo cáo từng ngày.'
            : 'Chọn ngày trong tháng đang xem để đối chiếu ai đã báo cáo, ai chưa — phục vụ đánh giá cuối tháng.'}
        </p>
      </div>

      {boardSection === 'daily' && (
        <div className="p-5 border-b border-gray-200 bg-slate-50/50">
          {loading && (
            <p className="text-sm text-slate-500 mb-3">Đang tải dữ liệu…</p>
          )}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ngày theo dõi chuyên cần</p>
              <p className="text-sm text-slate-600 mt-1">Chọn ngày để xem rõ ai đã báo cáo, ai chưa báo cáo.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedMonth ? `${selectedMonth}-${String(dashboardSummary.focusDay).padStart(2, '0')}` : ''}
                min={selectedMonth ? `${selectedMonth}-01` : undefined}
                max={selectedMonth ? `${selectedMonth}-${String(maxDayInMonth).padStart(2, '0')}` : undefined}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val || !selectedMonth) return;
                  const monthPart = val.slice(0, 7);
                  if (monthPart !== selectedMonth) return;
                  const day = Number(val.slice(8, 10));
                  if (!Number.isNaN(day)) setFocusDay(day);
                }}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Tổng nhân sự</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{dashboardSummary.totalStaff}</p>
            </div>
            <div className="bg-white border border-emerald-200 rounded-xl p-3">
              <p className="text-[11px] font-bold tracking-wider text-emerald-700 uppercase">Đã báo cáo ({dashboardSummary.dayLabel})</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">{dashboardSummary.reportedToday}</p>
            </div>
            <div className="bg-white border border-rose-200 rounded-xl p-3">
              <p className="text-[11px] font-bold tracking-wider text-rose-700 uppercase">Chưa báo cáo ({dashboardSummary.dayLabel})</p>
              <p className="text-2xl font-black text-rose-700 mt-1">{dashboardSummary.missingToday}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">Nghỉ phép ({dashboardSummary.dayLabel})</p>
              <p className="text-2xl font-black text-slate-700 mt-1">{dashboardSummary.leaveToday}</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-sm md:text-base font-bold text-slate-800">
                Báo cáo tiến độ theo ngày {dashboardSummary.dayLabel}
              </h3>
              <span className="text-xs text-slate-500">Bấm vào người đã báo cáo để xem chi tiết</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
              <div className="bg-slate-50/80 border border-emerald-200 rounded-lg p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">Đã báo cáo</p>
                {dashboardSummary.reportedDetails.length === 0 ? (
                  <p className="text-sm text-slate-400">Không có</p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-700 pr-1">
                    {dashboardSummary.reportedDetails.map((item, idx) => (
                      <li key={`${item.name}-${idx}`} className="border-b border-emerald-100 pb-1 last:border-b-0 last:pb-0">
                        <button
                          type="button"
                          className="w-full text-left rounded-md px-1 py-0.5 hover:bg-emerald-50/80 transition-colors"
                          onClick={() => setReportDetailModal({ userId: item.userId, name: item.name })}
                        >
                          <p className="font-semibold text-slate-800">
                            {item.name}{' '}
                            <span className="font-normal text-emerald-700">({item.ratio})</span>
                          </p>
                          <p className="text-xs text-slate-600">
                            {item.titles.length > 0 ? item.titles.join('; ') : 'Đã nộp báo cáo nhưng chưa có tiêu đề nhiệm vụ.'}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">Bấm để xem chi tiết báo cáo</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-slate-50/80 border border-rose-200 rounded-lg p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-1">Chưa báo cáo</p>
                {dashboardSummary.missingNames.length === 0 ? (
                  <p className="text-sm text-slate-400">Không có</p>
                ) : (
                  <p className="text-sm text-slate-700">{dashboardSummary.missingNames.join(', ')}</p>
                )}
              </div>
              <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Nghỉ phép</p>
                {dashboardSummary.leaveNames.length === 0 ? (
                  <p className="text-sm text-slate-400">Không có</p>
                ) : (
                  <p className="text-sm text-slate-700">{dashboardSummary.leaveNames.join(', ')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {boardSection === 'grid' &&
        (loading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>

        ) : (
        <>
          <div className="overflow-x-auto custom-scrollbar relative">
            <table className="w-full text-left border-collapse min-w-[max-content]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-30 w-[160px] min-w-[160px] max-w-[160px] p-4 font-semibold text-gray-600 bg-gray-50 border-b border-r border-gray-200">
                    Nhân sự
                  </th>
                  <th className="sticky left-[160px] z-30 w-[80px] min-w-[80px] max-w-[80px] p-4 font-semibold text-center text-blue-700 bg-gray-50 border-b border-r border-gray-200" title="Khi có API: điểm chuyên cần (TG làm việc 5đ + Báo cáo 5đ). Khi chưa có: số ngày công.">
                    C.Tổng
                  </th>
                  <th className="sticky left-[240px] z-30 w-[80px] min-w-[80px] max-w-[80px] p-4 font-semibold text-center text-rose-700 bg-gray-50 border-b border-r border-gray-200">
                    Nghỉ
                  </th>
                  <th className="sticky left-[320px] z-30 w-[80px] min-w-[80px] max-w-[80px] p-4 font-semibold text-center text-orange-700 bg-gray-50 border-b border-r border-gray-200">
                    Muộn
                  </th>
                  <th className="sticky left-[400px] z-30 w-[100px] min-w-[100px] max-w-[100px] p-4 font-semibold text-center text-emerald-700 bg-gray-50 border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                    Tiến độ
                  </th>
                  {daysList.map((day) => (
                    <th key={day} className="p-2 font-medium text-center text-gray-500 border-b border-gray-200 w-[80px] min-w-[80px] bg-white">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data || []).map((person) => {
                  let totalWorkDays = 0;
                  let totalLeaveDays = 0;
                  let totalLateDays = 0;
                  // Tổng số NGÀY có nhiệm vụ và số NGÀY đã có ÍT NHẤT MỘT báo cáo
                  let totalTaskDays = 0;
                  let fullReportedDays = 0;
                  const daysObj = person.days || {};
                  Object.values(daysObj).forEach((d) => {
                    if (d.isLeave) totalLeaveDays += 1;
                    if (d.isLate) totalLateDays += 1;
                    if (d.workDay) totalWorkDays += d.workDay;
                    if (d.totalTasks && d.totalTasks > 0) {
                      totalTaskDays += 1;
                      // Quan điểm tính điểm chuyên cần theo ngày:
                      // nếu trong ngày có ít nhất 1 đầu việc được báo cáo thì coi là "đã báo cáo ngày đó",
                      // không bắt buộc phải báo cáo đủ 100% tất cả đầu việc đang active.
                      if (d.reportedTasks > 0) {
                        fullReportedDays += 1;
                      }
                    }
                  });
                  const reportRate = totalTaskDays > 0 ? Math.round((fullReportedDays / totalTaskDays) * 100) : 0;
                  const sid = String(person.id ?? '');
                  const scoreRow = rankingByUserId[sid];
                  const tw = scoreRow?.timeWorkScore5;
                  const dr = scoreRow?.dailyReportScore5;
                  const hasScore = typeof tw === 'number' || typeof dr === 'number';
                  const totalScore = (typeof tw === 'number' ? tw : 0) + (typeof dr === 'number' ? dr : 0);

                  return (
                    <tr key={person.id} className="group transition-colors">
                      <td className="sticky left-0 z-20 w-[160px] min-w-[160px] max-w-[160px] p-4 bg-white group-hover:bg-gray-50 border-b border-r border-gray-200 font-medium text-gray-800">
                        {person.name}
                      </td>
                      <td className="sticky left-[160px] z-20 w-[80px] min-w-[80px] max-w-[80px] p-4 bg-white group-hover:bg-gray-50 text-center font-bold text-blue-600 border-b border-r border-gray-200" title={hasScore ? `Thời gian làm việc: ${typeof tw === 'number' ? tw.toFixed(1) : '—'}đ | Báo cáo hàng ngày: ${typeof dr === 'number' ? dr.toFixed(1) : '—'}đ` : 'Điểm từ API chưa có; đang hiển thị số ngày công.'}>
                        {hasScore ? (totalScore % 1 !== 0 ? totalScore.toFixed(1) : totalScore) : (typeof totalWorkDays === 'number' && totalWorkDays % 1 !== 0 ? totalWorkDays.toFixed(1) : totalWorkDays)}
                      </td>
                      <td className="sticky left-[240px] z-20 w-[80px] min-w-[80px] max-w-[80px] p-4 bg-white group-hover:bg-gray-50 text-center font-bold text-rose-500 border-b border-r border-gray-200">
                        {totalLeaveDays}
                      </td>
                      <td className="sticky left-[320px] z-20 w-[80px] min-w-[80px] max-w-[80px] p-4 bg-white group-hover:bg-gray-50 text-center font-bold text-orange-600 border-b border-r border-gray-200">
                        {totalLateDays}
                      </td>
                      <td className="sticky left-[400px] z-20 w-[100px] min-w-[100px] max-w-[100px] p-4 bg-white group-hover:bg-gray-50 text-center border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-bold text-gray-700">
                            {fullReportedDays}
                            <span className="text-xs font-normal text-gray-500">
                              /
                              {totalTaskDays}
                            </span>
                          </span>
                          {totalTaskDays > 0 && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${reportRate === 100 ? 'bg-emerald-100 text-emerald-800' : reportRate >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                              {reportRate}%
                            </span>
                          )}
                        </div>
                      </td>
                      {daysList.map((day) => (
                        <td key={day} className="p-2 border-b border-gray-100 w-[80px] min-w-[80px] bg-white group-hover:bg-gray-50">
                          <div className="w-full h-full p-0.5">{renderCell(daysObj[String(day)], day)}</div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Ghi chú cách đọc số liệu</p>
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li>
              <span className="font-semibold text-blue-700">C.Tổng:</span> Tổng thời gian làm việc.
            </li>
            <li>
              <span className="font-semibold text-emerald-700">Tiến độ:</span> Số ngày đã báo cáo / Số ngày có nhiệm vụ.
            </li>
          </ul>
        </div>
        </>
        ))}

      {reportDetailModal && (
        <div className="fixed inset-0 z-[100000] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <div className="text-sm text-slate-500">Chi tiết báo cáo</div>
                <div className="font-bold text-slate-900">
                  {reportDetailModal.name} - Ngày {dashboardSummary.dayLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportDetailModal(null)}
                className="p-2 rounded-lg hover:bg-slate-50 border border-slate-200"
              >
                X
              </button>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-auto">
              {detailReports.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có báo cáo chi tiết cho người này trong ngày được chọn.</p>
              ) : (
                <ul className="space-y-4">
                  {detailReports.map((r, idx) => (
                    <li key={`${r.taskId ?? r.task_id ?? idx}-${idx}`} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-bold text-slate-900">{r.taskTitle || 'Nhiệm vụ'}</div>
                        <div className="text-xs text-slate-500">
                          Ngày: {r.date ? String(r.date).slice(0, 10) : dashboardSummary.dayLabel}
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap mt-2 leading-relaxed">
                        {r.result || r.content || '—'}
                      </div>
                      {(r.submittedAt || r.submitted_at) && (
                        <div className="text-xs text-slate-500 mt-2">
                          Gửi lúc: {new Date(String(r.submittedAt || r.submitted_at).replace(' ', 'T')).toLocaleString('vi-VN')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
