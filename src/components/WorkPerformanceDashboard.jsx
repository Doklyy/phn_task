import React from 'react';
import {
  Activity,
  Download,
  ListChecks,
  CheckSquare,
  Trophy,
  Target,
  FileText,
  User,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

const VIETTEL_RED = '#D4384E';
const GOLD = '#FFB800';

export function WorkPerformanceDashboard({
  monthLabel,
  monthValue = '',
  onMonthChange,
  ranking = [],
  dashboardStats,
  staffProgress = [],
  completionReports = [],
  onExportEvaluationForms,
  onOpenTasks,
  onOpenAttendance,
  onOpenTaskDetail,
  progressDate = '',
  progressDateOptions = [],
  onProgressDateChange,
}) {
  const [feedTab, setFeedTab] = React.useState('progress');
  const [showFullRanking, setShowFullRanking] = React.useState(false);

  const toHundredScore = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return n > 0 && n <= 1 ? n * 100 : n;
  };
  const formatScore = (value) => toHundredScore(value).toFixed(1);

  const avgRaw =
    ranking.length > 0
      ? (
          ranking.reduce((sum, r) => sum + (Number(r.totalScore) || 0), 0) /
          ranking.length
        )
      : null;
  const avgScore = avgRaw == null ? '—' : formatScore(avgRaw);

  const sortedRanking = [...ranking]
    .sort((a, b) => toHundredScore(b.totalScore) - toHundredScore(a.totalScore));

  const top3 = sortedRanking
    .slice(0, 3);

  const totalInProgress =
    dashboardStats?.inProgress != null ? dashboardStats.inProgress : 0;
  const totalCompleted =
    dashboardStats?.completed != null ? dashboardStats.completed : 0;
  const totalTasks =
    dashboardStats?.total != null ? dashboardStats.total : totalInProgress + totalCompleted || 1;
  const progressPct =
    totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4 mt-1">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight uppercase italic">
            Work &amp; Performance
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">
            Hệ thống báo cáo tiến độ và tổng hợp kết quả — tháng {monthLabel || '—'}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {onMonthChange && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
              <Calendar size={14} className="text-slate-500" />
              <input
                type="month"
                value={monthValue}
                onChange={(e) => onMonthChange(e.target.value)}
                className="text-xs md:text-sm font-semibold text-slate-700 bg-transparent outline-none"
              />
            </div>
          )}
          {onOpenTasks && (
            <button
              type="button"
              onClick={onOpenTasks}
              className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-2xl text-[10px] md:text-xs font-black transition-all hover:scale-105 shadow-sm uppercase tracking-tight"
            >
              <Target size={14} />
              Nhiệm vụ
            </button>
          )}
          {onOpenAttendance && (
            <button
              type="button"
              onClick={onOpenAttendance}
              className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-2xl text-[10px] md:text-xs font-black transition-all hover:scale-105 shadow-sm uppercase tracking-tight"
            >
              <FileText size={14} />
              Chuyên cần
            </button>
          )}
          {onExportEvaluationForms && (
            <button
              type="button"
              onClick={onExportEvaluationForms}
              className="flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-2xl text-[10px] md:text-xs font-black transition-all hover:scale-105 shadow-md uppercase tracking-tight"
            >
              <Download size={14} />
              Xuất phiếu đánh giá
            </button>
          )}
        </div>
      </div>

      {/* Top stats + vinh danh */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Tổng quan chỉ số */}
        <div className="lg:col-span-2 bg-[#D4384E] rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl flex flex-col md:flex-row gap-6">
          <div className="flex-1 z-10 space-y-6">
            <div>
              <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/70 mb-1">
                Trung bình hiệu suất tháng
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl md:text-6xl font-black italic tracking-tighter">
                  {avgScore}
                </span>
                <span className="text-sm md:text-base font-bold text-white/60">
                  / 100đ
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                <span className="block text-[9px] font-black uppercase text-white/60 mb-1">
                  Đang thực hiện
                </span>
                <span className="text-xl font-black italic">
                  {totalInProgress}{' '}
                  <span className="text-xs font-bold text-white/50">việc</span>
                </span>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                <span className="block text-[9px] font-black uppercase text-white/60 mb-1">
                  Đã hoàn thành
                </span>
                <span className="text-xl font-black italic">
                  {totalCompleted}{' '}
                  <span className="text-xs font-bold text-white/50">việc</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 z-10 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-black uppercase">
                <span>Tiến độ tổng dự án</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden border border-white/10">
                <div
                  className="bg-white h-full rounded-full shadow-[0_0_12px_rgba(255,255,255,0.6)]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <p className="text-[9px] font-bold text-white/60 italic leading-relaxed uppercase tracking-wider">
              * Dữ liệu được cập nhật theo kỳ đánh giá tháng {monthLabel || '—'}.
            </p>
          </div>
        </div>

        {/* Bảng vinh danh */}
        <div className="bg-white p-6 md:p-7 rounded-3xl border border-slate-200 shadow-sm flex flex-col relative border-t-8 border-t-[#FFB800]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">
                Bảng vinh danh
              </h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase italic">
                Tổng điểm tích lũy tháng {monthLabel || '—'}
              </p>
            </div>
            <Trophy size={22} className="text-[#FFB800]" />
          </div>

          <div className="space-y-5 flex-1">
            {top3.map((user, idx) => (
              <div
                key={user.userId ?? idx}
                className="flex justify-between items-center group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black shadow-sm text-white ${
                      idx === 0
                        ? 'bg-[#FFB800]'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-800'
                        : 'bg-[#E29A00]'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <span className="font-black text-slate-800 text-sm block leading-none mb-1 tracking-tight group-hover:text-[#D4384E] transition-colors">
                      {user.name ?? user.userName ?? '—'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest italic opacity-70">
                      Nhân viên loại A
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-slate-900 text-lg tracking-tighter leading-none">
                    {formatScore(user.totalScore)}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1 font-black italic">
                    đ
                  </span>
                </div>
              </div>
            ))}
            {top3.length === 0 && (
              <p className="text-xs text-slate-500">
                Chưa có dữ liệu xếp hạng cho tháng này.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFullRanking((v) => !v)}
            className="mt-6 w-full py-2.5 bg-slate-50 text-[9px] font-black uppercase text-slate-400 rounded-xl hover:bg-red-50 hover:text-[#D4384E] transition-all tracking-widest"
          >
            {showFullRanking ? 'Ẩn bảng xếp hạng đầy đủ' : 'Xem bảng xếp hạng đầy đủ'}
          </button>
        </div>
      </div>

      {showFullRanking && (
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">
            Bảng xếp hạng đầy đủ
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200">
                  <th className="py-2 px-3">Hạng</th>
                  <th className="py-2 px-3">Nhân sự</th>
                  <th className="py-2 px-3 text-right">Tổng điểm</th>
                </tr>
              </thead>
              <tbody>
                {sortedRanking.map((user, idx) => (
                  <tr key={user.userId ?? idx} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-semibold text-slate-700">#{idx + 1}</td>
                    <td className="py-2 px-3 text-slate-800">{user.name ?? user.userName ?? '—'}</td>
                    <td className="py-2 px-3 text-right font-black text-slate-900">
                      {formatScore(user.totalScore)}đ
                    </td>
                  </tr>
                ))}
                {sortedRanking.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 px-3 text-center text-slate-500">
                      Chưa có dữ liệu xếp hạng cho tháng này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Progress / finished tabs */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 bg-slate-50/50 p-2">
          <button
            type="button"
            onClick={() => setFeedTab('progress')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-2xl ${
              feedTab === 'progress'
                ? 'bg-white shadow text-[#D4384E]'
                : 'text-slate-400'
            }`}
          >
            <Activity size={16} />
            Tiến độ công việc mọi người
          </button>
          <button
            type="button"
            onClick={() => setFeedTab('completion')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-2xl ${
              feedTab === 'completion'
                ? 'bg-white shadow text-[#D4384E]'
                : 'text-slate-400'
            }`}
          >
            <CheckSquare size={16} />
            Báo cáo kết thúc việc
          </button>
        </div>

        <div className="p-4 md:p-6">
          {/* Header strip */}
          <div className="flex justify-between items-center bg-slate-900 rounded-2xl px-4 py-4 text-white mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#D4384E] rounded-xl flex items-center justify-center shadow-lg">
                <ListChecks size={22} />
              </div>
              <div>
                <h3 className="text-xs md:text-sm font-black uppercase tracking-widest italic">
                  Live Progress Feed
                </h3>
                <p className="text-[9px] text-white/60 font-bold uppercase tracking-widest">
                  Giám sát tiến độ báo cáo toàn bộ nhân sự
                </p>
              </div>
            </div>
            <div className="hidden sm:flex gap-4 text-[9px] font-black uppercase items-center">
              {feedTab === 'progress' && onProgressDateChange && (
                <select
                  value={progressDate}
                  onChange={(e) => onProgressDateChange(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-[10px] text-white"
                >
                  <option value="">Tất cả ngày</option>
                  {progressDateOptions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
              <div className="text-center px-3 border-r border-white/10">
                <span className="block text-base font-black">
                  {feedTab === 'progress' ? staffProgress.length : completionReports.length}
                </span>
                <span className="text-white/50">Nhân sự</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
                  <th className="px-4 py-1 text-left">Nhân sự</th>
                  <th className="px-4 py-1 text-left">
                    {feedTab === 'progress' ? 'Công việc đang thực hiện' : 'Công việc kết thúc'}
                  </th>
                  <th className="px-4 py-1 text-center">{feedTab === 'progress' ? 'Tiến độ' : 'Thời điểm'}</th>
                  <th className="px-4 py-1 text-center">Trạng thái</th>
                  <th className="px-4 py-1 text-right">{feedTab === 'progress' ? 'Cập nhật' : 'Ghi chú'}</th>
                </tr>
              </thead>
              <tbody>
                {(feedTab === 'progress' ? staffProgress : completionReports).map((row) => (
                  <tr
                    key={row.id}
                    className="bg-slate-50 hover:bg-white hover:shadow-md transition-all group cursor-pointer border border-transparent hover:border-red-200"
                    onClick={() => {
                      if (onOpenTaskDetail && row.taskId != null) onOpenTaskDetail(row.taskId);
                    }}
                  >
                    <td className="px-4 py-3 rounded-l-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center font-black text-slate-500 group-hover:bg-[#D4384E] group-hover:text-white transition-colors uppercase">
                          {row.initial || row.name?.split(' ').pop()?.[0] || '?'}
                        </div>
                        <div>
                          <span className="block font-black text-slate-900 text-sm tracking-tight">
                            {row.name}
                          </span>
                          <span className="text-[9px] text-slate-400 font-black">
                            {row.code || ''}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-600 text-xs italic">
                        {row.taskTitle || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      {feedTab === 'progress' ? (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] font-black">
                            <span className="text-[#D4384E] italic">
                              {row.progress != null ? `${row.progress}%` : '—'}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                (row.progress || 0) < 50
                                  ? 'bg-amber-400'
                                  : 'bg-[#D4384E]'
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, row.progress || 0),
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-black text-slate-700">{row.submittedAt || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          row.statusBadge === 'danger'
                            ? 'bg-red-100 text-red-600'
                            : row.statusBadge === 'warn'
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-emerald-100 text-emerald-600'
                        }`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right rounded-r-2xl">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-800">{feedTab === 'progress' ? (row.lastUpdate || '—') : (row.note || '—')}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase italic">
                          {feedTab === 'progress' ? 'Latest Report' : 'Completion Note'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {(feedTab === 'progress' ? staffProgress.length === 0 : completionReports.length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-4 px-4 text-center text-xs text-slate-500"
                    >
                      {feedTab === 'progress'
                        ? 'Chưa có dữ liệu tiến độ cho tháng này.'
                        : 'Chưa có dữ liệu báo cáo kết thúc cho tháng này.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

