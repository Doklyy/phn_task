import React from 'react';
import { CalendarDays, UserCheck, Clock9, FileWarning } from 'lucide-react';

// Mock dữ liệu chuyên cần dạng lịch (tháng 2/2026) giống ví dụ bạn gửi
const mockAttendance = Array.from({ length: 28 }, (_, i) => {
  const day = i + 1;
  const dateStr = `${day.toString().padStart(2, '0')}/02/2026`;
  const isWeekend = [1, 7, 8, 14, 15, 21, 22, 28].includes(day);

  if (day > 24) {
    return {
      day,
      date: dateStr,
      type: 'future',
      title: 'Chưa diễn ra',
      details: ['Chưa có dữ liệu cho ngày này'],
    };
  }
  if (isWeekend) {
    return {
      day,
      date: dateStr,
      type: 'weekend',
      title: 'Ngày nghỉ',
      details: ['Nghỉ cuối tuần (Thứ 7 / CN)'],
    };
  }
  if (day === 4) {
    return {
      day,
      date: dateStr,
      type: 'warning',
      title: 'Thiếu báo cáo',
      details: [
        'Check-in: 08:20',
        'Check-out: 17:35',
        'Trạng thái: Chưa nộp báo cáo tiến độ ngày',
      ],
    };
  }
  if (day === 12) {
    return {
      day,
      date: dateStr,
      type: 'warning',
      title: 'Đi muộn',
      details: [
        'Check-in: 09:15 (Muộn 45p)',
        'Check-out: 17:40',
        'Trạng thái: Đã nộp báo cáo',
      ],
    };
  }
  if (day === 17) {
    return {
      day,
      date: dateStr,
      type: 'danger',
      title: 'Nghỉ phép',
      details: ['Trạng thái: Nghỉ phép ốm (Đã được Quản lý duyệt)'],
    };
  }

  return {
    day,
    date: dateStr,
    type: 'success',
    title: 'Đầy đủ',
    details: [
      'Check-in: 08:15',
      'Check-out: 17:35',
      'Tiến độ: Đã báo cáo đầy đủ công việc',
      'Trạng thái: Hợp lệ',
    ],
  };
});

export default function DashboardAttendanceMock() {
  return (
    <div className="space-y-6">
      {/* Tổng quan Chuyên cần (giống mock) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-slate-500 font-medium">Ngày công chuẩn</div>
            <div className="text-2xl font-bold text-slate-800">
              20 <span className="text-sm font-normal text-slate-400">ngày</span>
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
              14 <span className="text-sm font-normal text-slate-400">ngày</span>
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
              1 <span className="text-sm font-normal text-slate-400">lần</span>
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
              2 <span className="text-sm font-normal text-slate-400">lần</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lịch chuyên cần dạng hover giống mock */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
          Chi tiết ngày công - Tháng 2/2026
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

          {mockAttendance.map((item) => {
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

