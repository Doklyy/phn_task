import React from 'react';
import { Info } from 'lucide-react';

/**
 * Bảng chuyên cần – giao diện giống mock: ô [đã báo cáo/tổng task], màu đủ/thiếu/chưa, N nghỉ phép, 0.5 nửa công, chấm cam đi muộn.
 * data: [{ id, name, days: { "1": { workDay, totalTasks, reportedTasks, isLate, isLeave }, ... } }]
 */
function renderCell(dayData, day) {
  if (!dayData) return <div className="flex items-center justify-center h-full text-gray-300">-</div>;

  if (dayData.isLeave) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-gray-50 border border-transparent rounded-md" title="Nghỉ phép">
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

  const tooltipText = `Công: ${dayData.workDay} ngày${isLate ? ' (Đi muộn)' : ''}\nNhiệm vụ: Đã báo cáo ${dayData.reportedTasks} / ${dayData.totalTasks} task`;

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

export function ChuyenCanBoard({ monthLabel, monthValue, onMonthChange, data, displayDays, loading }) {
  return (
    <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Bảng Theo Dõi Báo Cáo Công Việc (Cải tiến)</h1>
          <p className="text-sm text-gray-500 mt-1">{monthLabel} • Hiển thị tỷ lệ báo cáo chi tiết</p>
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
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200 block" />
              <span className="text-gray-600">Đủ báo cáo</span>
            </div>
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-4 h-4 rounded bg-amber-100 border border-amber-300 block" />
              <span className="text-gray-600">Báo cáo thiếu</span>
            </div>
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-4 h-4 rounded bg-rose-100 border border-rose-300 block" />
              <span className="text-gray-600">Chưa báo cáo</span>
            </div>
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-6 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold text-center">0.5</span>
              <span className="text-gray-600">Nửa công</span>
            </div>
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-3 h-3 rounded-full bg-orange-500 block" />
              <span className="text-gray-600">Đi muộn</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 text-center text-gray-400 font-bold text-xs">N</span>
              <span className="text-gray-600">Nghỉ phép</span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Đang tải...</div>
      ) : (
        <div className="overflow-x-auto overflow-y-visible custom-scrollbar" style={{ maxWidth: '100%' }}>
          <table className="text-left border-collapse" style={{ minWidth: 900 }}>
            <colgroup>
              <col style={{ width: 192, minWidth: 192 }} />
              <col style={{ width: 96, minWidth: 96 }} />
              <col style={{ width: 96, minWidth: 96 }} />
              <col style={{ width: 96, minWidth: 96 }} />
              <col style={{ width: 128, minWidth: 128 }} />
              {(displayDays || []).map((day) => (
                <col key={`col-${day}`} style={{ width: 56, minWidth: 56 }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-30 bg-white p-4 font-semibold text-gray-600 border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]"
                  style={{ minWidth: 192 }}
                >
                  Nhân sự
                </th>
                <th
                  className="sticky z-30 bg-blue-50 p-4 font-semibold text-center text-blue-700 border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]"
                  style={{ left: 192, minWidth: 96 }}
                >
                  Tổng công
                </th>
                <th
                  className="sticky z-30 bg-rose-50 p-4 font-semibold text-center text-rose-700 border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]"
                  style={{ left: 288, minWidth: 96 }}
                >
                  Ngày nghỉ
                </th>
                <th
                  className="sticky z-30 bg-orange-50 p-4 font-semibold text-center text-orange-700 border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]"
                  style={{ left: 384, minWidth: 96 }}
                >
                  Đi muộn
                </th>
                <th
                  className="sticky z-30 bg-emerald-50 p-4 font-semibold text-center text-emerald-700 border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]"
                  style={{ left: 480, minWidth: 128 }}
                >
                  Tiến độ BC
                </th>
                {(displayDays || []).map((day) => (
                  <th key={day} className="bg-gray-50 p-2 font-medium text-center text-gray-500 border-b border-gray-200" style={{ minWidth: 56 }}>
                    Ngày {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data || []).map((person) => {
                let totalWorkDays = 0;
                let totalLeaveDays = 0;
                let totalLateDays = 0;
                let totalTasks = 0;
                let reportedTasks = 0;
                const daysObj = person.days || {};
                Object.values(daysObj).forEach((day) => {
                  if (day.isLeave) totalLeaveDays += 1;
                  if (day.isLate) totalLateDays += 1;
                  if (day.workDay) totalWorkDays += day.workDay;
                  if (day.totalTasks) totalTasks += day.totalTasks;
                  if (day.reportedTasks) reportedTasks += day.reportedTasks;
                });
                const reportRate = totalTasks > 0 ? Math.round((reportedTasks / totalTasks) * 100) : 0;
                const daysList = displayDays || Object.keys(daysObj).map(Number).sort((a, b) => a - b);

                return (
                  <tr key={person.id} className="hover:bg-gray-50/50 transition-colors">
                    <td
                      className="sticky left-0 z-20 bg-white p-4 border-b border-r border-gray-200 font-medium text-gray-800 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]"
                      style={{ minWidth: 192 }}
                    >
                      {person.name}
                    </td>
                    <td
                      className="sticky z-20 bg-blue-50/50 p-4 text-center font-bold text-blue-600 border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]"
                      style={{ left: 192, minWidth: 96 }}
                    >
                      {typeof totalWorkDays === 'number' && totalWorkDays % 1 !== 0 ? totalWorkDays.toFixed(1) : totalWorkDays}
                    </td>
                    <td
                      className="sticky z-20 bg-rose-50/50 p-4 text-center font-bold text-rose-500 border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]"
                      style={{ left: 288, minWidth: 96 }}
                    >
                      {totalLeaveDays}
                    </td>
                    <td
                      className="sticky z-20 bg-orange-50/50 p-4 text-center font-bold text-orange-600 border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]"
                      style={{ left: 384, minWidth: 96 }}
                    >
                      {totalLateDays}
                    </td>
                    <td
                      className="sticky z-20 bg-emerald-50/50 p-4 text-center border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]"
                      style={{ left: 480, minWidth: 128 }}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-bold text-gray-700">
                          {reportedTasks}
                          <span className="text-xs font-normal text-gray-500">/{totalTasks}</span>
                        </span>
                        {totalTasks > 0 && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                              reportRate === 100 ? 'bg-emerald-100 text-emerald-800' : reportRate >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {reportRate}%
                          </span>
                        )}
                      </div>
                    </td>
                    {daysList.map((day) => (
                      <td key={day} className="p-2 border-b border-gray-100 bg-white">
                        <div className="w-full h-full p-1">{renderCell(daysObj[String(day)], day)}</div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 bg-blue-50/50 border-t border-gray-200 flex items-start gap-2 text-sm text-blue-700">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Hướng dẫn cho Admin:</strong> Các ô hiển thị dưới dạng <strong>[Đã báo cáo] / [Tổng nhiệm vụ]</strong>. Nếu ô có huy hiệu màu xanh ghi <strong>0.5</strong> ở góc trên, nhân sự được chấm nửa công. Dấu chấm tròn màu <strong>cam</strong> ở góc trên bên trái biểu thị việc đi muộn ngày hôm đó. Bạn có thể <strong>di chuột (hover)</strong> vào từng ô để xem chi tiết.
        </p>
      </div>
    </div>
  );
}
