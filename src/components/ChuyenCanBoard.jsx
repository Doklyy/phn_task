import React from 'react';
import { Info } from 'lucide-react';

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

export function ChuyenCanBoard({ monthLabel, monthValue, onMonthChange, data, displayDays, loading }) {
  const daysList = displayDays && displayDays.length > 0 ? displayDays : Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="max-w-[1400px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Bảng Theo Dõi Báo Cáo Công Việc (Cải tiến)</h1>
          <p className="text-sm text-gray-500 mt-1">{monthLabel} • Đã bật tính năng cố định cột (Freeze Panes)</p>
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

      {loading ? (
        <div className="p-8 text-center text-gray-500">Đang tải...</div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse min-w-[max-content]">
            <thead>
              <tr>
                <th className="sticky left-0 z-30 w-[160px] min-w-[160px] max-w-[160px] p-4 font-semibold text-gray-600 bg-gray-50 border-b border-r border-gray-200">
                  Nhân sự
                </th>
                <th className="sticky left-[160px] z-30 w-[80px] min-w-[80px] max-w-[80px] p-4 font-semibold text-center text-blue-700 bg-gray-50 border-b border-r border-gray-200">
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
                let totalTasks = 0;
                let reportedTasks = 0;
                const daysObj = person.days || {};
                Object.values(daysObj).forEach((d) => {
                  if (d.isLeave) totalLeaveDays += 1;
                  if (d.isLate) totalLateDays += 1;
                  if (d.workDay) totalWorkDays += d.workDay;
                  if (d.totalTasks) totalTasks += d.totalTasks;
                  if (d.reportedTasks) reportedTasks += d.reportedTasks;
                });
                const reportRate = totalTasks > 0 ? Math.round((reportedTasks / totalTasks) * 100) : 0;

                return (
                  <tr key={person.id} className="group transition-colors">
                    <td className="sticky left-0 z-20 w-[160px] min-w-[160px] max-w-[160px] p-4 bg-white group-hover:bg-gray-50 border-b border-r border-gray-200 font-medium text-gray-800">
                      {person.name}
                    </td>
                    <td className="sticky left-[160px] z-20 w-[80px] min-w-[80px] max-w-[80px] p-4 bg-white group-hover:bg-gray-50 text-center font-bold text-blue-600 border-b border-r border-gray-200">
                      {typeof totalWorkDays === 'number' && totalWorkDays % 1 !== 0 ? totalWorkDays.toFixed(1) : totalWorkDays}
                    </td>
                    <td className="sticky left-[240px] z-20 w-[80px] min-w-[80px] max-w-[80px] p-4 bg-white group-hover:bg-gray-50 text-center font-bold text-rose-500 border-b border-r border-gray-200">
                      {totalLeaveDays}
                    </td>
                    <td className="sticky left-[320px] z-20 w-[80px] min-w-[80px] max-w-[80px] p-4 bg-white group-hover:bg-gray-50 text-center font-bold text-orange-600 border-b border-r border-gray-200">
                      {totalLateDays}
                    </td>
                    <td className="sticky left-[400px] z-20 w-[100px] min-w-[100px] max-w-[100px] p-4 bg-white group-hover:bg-gray-50 text-center border-b border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-bold text-gray-700">{reportedTasks}<span className="text-xs font-normal text-gray-500">/{totalTasks}</span></span>
                        {totalTasks > 0 && (
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
      )}

      <div className="p-4 bg-blue-50/50 border-t border-gray-200 flex items-start gap-2 text-sm text-blue-700">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Hướng dẫn</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>Bảng đã bật <strong>Cố định cột (Freeze Panes)</strong>. Kéo thanh cuộn ngang sang phải để xem các ngày, 5 cột trái (Nhân sự, C.Tổng, Nghỉ, Muộn, Tiến độ) luôn cố định.</li>
            <li>Ô hiển thị <strong>[Đã báo cáo tiến độ] / [Tổng nhiệm vụ]</strong> trong ngày. Xanh = đủ, vàng = thiếu, đỏ = chưa báo cáo tiến độ. <strong>Báo cáo kết thúc công việc</strong> (khi hoàn thành nhiệm vụ) thực hiện trong chi tiết nhiệm vụ, không tính vào ô này.</li>
            <li>Huy hiệu <strong>0.5</strong> = nửa công, chấm <strong>cam</strong> = đi muộn, <strong>N</strong> = nghỉ phép. Dữ liệu lấy từ chấm công từng ngày — cần chấm công đúng để bảng chính xác.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
