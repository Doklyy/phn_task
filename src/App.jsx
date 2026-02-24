import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  LayoutDashboard,
  ClipboardList,
  Users,
  Bell,
  Search,
  Clock,
  CalendarClock,
  TrendingUp,
  FileText,
  ChevronRight,
  LogOut,
  Star,
  Filter,
  Download,
  X,
  Pause,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { utils, writeFileXLSX } from 'xlsx';
import { useAuth } from './context/AuthContext.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import { fetchTasksForCurrentUser, getDashboardStats, acceptTask, createTask, submitCompletion, approveCompletion, rejectCompletion, updateTaskDetails } from './api/tasks.js';
import { getScoringUser, getRanking } from './api/scoring.js';
import { getReportsByTask, submitReport, getReportsByUser, getMonthlyCompliance, getAllReportsForAdmin } from './api/reports.js';
import { fetchUsers, fetchPersonnel, updateUserRole, updateAttendancePermission, deleteUser, createUser, updateUserTeam } from './api/users.js';
import { uploadFile, getUploadedFileUrl, downloadAttachment } from './api/client.js';
import { AttendancePanel } from './components/AttendancePanel.jsx';
import ReportReminderOverlay from './components/ReportReminderOverlay.jsx';
import ReportReminderBellBlock from './components/ReportReminderBellBlock.jsx';
import DashboardAttendanceMock from './components/DashboardAttendanceMock.jsx';

// Danh sách user để hiển thị tên (BE có thể trả về hoặc lấy từ API users)
const USERS_DB = [
  { id: 'admin_01', name: 'Quản trị hệ thống', role: 'admin' },
  { id: 'leader_01', name: 'Nguyễn Văn A', role: 'leader' },
  { id: 'staff_01', name: 'Trần Nhân Viên 1', role: 'staff' },
];

// Màu đỏ Viettel dịu mắt (không đỏ gắt)
const VIETTEL_RED = '#D4384E';
const CHART_COLORS = { new: '#f97316', accepted: '#22c55e', overdue: VIETTEL_RED, completed: '#64748b', paused: '#8b5cf6' };

// Kiểm tra task có thuộc kỳ (tháng/quý/năm) không (theo deadline hoặc completedAt)
const taskInPeriod = (task, periodType, periodValue) => {
  if (!periodType || !periodValue) return true;
  const dateStr = task.completedAt || task.deadline || task.createdAt;
  if (!dateStr) return true;
  const d = new Date(String(dateStr).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return true;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (periodType === 'month') {
    const [py, pm] = periodValue.split('-').map(Number);
    return y === py && m === pm;
  }
  if (periodType === 'quarter') {
    const [py, q] = periodValue.replace('Q', '').split('-').map(Number);
    const qStart = (q - 1) * 3 + 1;
    return y === py && m >= qStart && m < qStart + 3;
  }
  if (periodType === 'year') {
    const py = Number(periodValue);
    return y === py;
  }
  return true;
};


const formatTodayLabel = () => {
  const now = new Date();
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = days[now.getDay()];
  const date = now.getDate();
  const month = now.getMonth() + 1;
  return `${dayName}, ${date.toString().padStart(2, '0')} Tháng ${month}`;
};

const now = () => new Date();

/** Nhóm mặc định cho dropdown Nhóm (luôn có để dropdown không trống). */
const DEFAULT_TEAM_OPTIONS = [
  { value: 'old_product', label: 'Sản phẩm cũ' },
  { value: 'new_product', label: 'Sản phẩm mới' },
];

/** Trọng số hiển thị dưới dạng mức chữ (rất thấp → rất cao), map về giá trị 0–1. */
const WEIGHT_LEVELS = [
  { value: 0.2, label: 'Rất thấp' },
  { value: 0.4, label: 'Thấp' },
  { value: 0.6, label: 'Trung bình' },
  { value: 0.8, label: 'Cao' },
  { value: 1.0, label: 'Rất cao' },
];

const weightLabel = (weight) => {
  if (weight == null || weight === '') return '—';
  const w = Number(weight);
  if (Number.isNaN(w)) return String(weight);
  let best = WEIGHT_LEVELS[0];
  let bestDiff = Math.abs(w - best.value);
  for (const level of WEIGHT_LEVELS) {
    const diff = Math.abs(w - level.value);
    if (diff < bestDiff) {
      best = level;
      bestDiff = diff;
    }
  }
  return best.label;
};

const App = () => {
  const { user: currentUser, loading: authLoading, logout, canShowAttendance } = useAuth();
  const role = currentUser?.role || 'staff';

  const [activeTab, setActiveTab] = useState('dash');
  const [dashView, setDashView] = useState('performance'); // 'performance' | 'tasks' | 'attendance'
  const [showAllRanking, setShowAllRanking] = useState(false);
  const [userCardOpen, setUserCardOpen] = useState(false);
  const [listFilter, setListFilter] = useState('all');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [periodType, setPeriodType] = useState('month');
  const [periodValue, setPeriodValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [attendanceUpdateMsg, setAttendanceUpdateMsg] = useState({ id: null, text: '' });
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ username: '', password: '', name: '', role: 'staff', team: 'old_product', newTeamName: '', canManageAttendance: false });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const mainContentScrollRef = useRef(null);
  const personnelScrollRestoreRef = useRef(null);
  const [taskSearch, setTaskSearch] = useState('');

  // Tích hợp BE: load tasks khi có user
  useEffect(() => {
    if (!currentUser?.id) {
      setTasks([]);
      return;
    }
    setTasksLoading(true);
    fetchTasksForCurrentUser(currentUser.id)
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setTasksLoading(false));
  }, [currentUser?.id]);

  // Danh sách nhân sự (không bao gồm admin): personnelOnly=true
  useEffect(() => {
    if (role === 'staff' || !currentUser?.id) {
      setUsers([]);
      return;
    }
    setUsersLoading(true);
    setUsersError('');
    fetchPersonnel(currentUser.id)
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setUsers([]);
        setUsersError('Không tải được danh sách nhân sự. Vui lòng thử lại sau.');
      })
      .finally(() => setUsersLoading(false));
  }, [role, currentUser?.id]);

  // Khôi phục scroll sau khi cập nhật danh sách nhân sự (tránh list bị đẩy lên đầu)
  useEffect(() => {
    const savedScroll = personnelScrollRestoreRef.current;
    if (savedScroll == null || !mainContentScrollRef.current) return;
    personnelScrollRestoreRef.current = null;
    // Restore sau khi DOM đã vẽ xong để list không bị đẩy lên
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (mainContentScrollRef.current) mainContentScrollRef.current.scrollTop = savedScroll;
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [users]);

  const [reportTaskId, setReportTaskId] = useState('');
  const [reportResult, setReportResult] = useState('');
  const [reportAttachmentPath, setReportAttachmentPath] = useState('');
  const [reportFileUploading, setReportFileUploading] = useState(false);
  const [reportErrors, setReportErrors] = useState({});
  const [reportSent, setReportSent] = useState(false);

  const [reportHistoryByTask, setReportHistoryByTask] = useState({});
  const [reminderRefetchTrigger, setReminderRefetchTrigger] = useState(0);

  // Load toàn bộ báo cáo của user khi vào trang → nhận diện đã báo cáo ngày hôm qua (để mở khóa tiếp nhận công việc mới)
  useEffect(() => {
    if (!currentUser?.id) return;
    getReportsByUser(currentUser.id)
      .then((list) => {
        const byTask = {};
        (list || []).forEach((r) => {
          const taskId = String(r.taskId ?? r.task_id ?? '');
          if (!taskId) return;
          if (!byTask[taskId]) byTask[taskId] = [];
          byTask[taskId].push({
            date: r.date ? String(r.date).slice(0, 10) : '',
            result: r.result,
          });
        });
        setReportHistoryByTask(byTask);
      })
      .catch(() => {});
  }, [currentUser?.id]);

  // Khi mở chi tiết task, cập nhật lịch sử báo cáo của task đó (có userId để API trả đúng)
  useEffect(() => {
    if (!selectedTaskId || !currentUser?.id) return;
    getReportsByTask(selectedTaskId, currentUser.id)
      .then((list) => {
        setReportHistoryByTask((prev) => ({
          ...prev,
          [selectedTaskId]: (list || []).map((r) => ({ date: r.date?.slice(0, 10) || r.date, result: r.result })),
        }));
      })
      .catch(() => {});
  }, [selectedTaskId, currentUser?.id]);

  const addReportToHistory = useCallback((taskId, report) => {
    const entry = { date: report.reportDate, result: report.result };
    setReportHistoryByTask((prev) => ({
      ...prev,
      [taskId]: [...(prev[taskId] || []), entry],
    }));
  }, []);

  // Thông báo trong chuông: sáng (chúc ngày tốt), 16h (nhắc báo cáo)
  const [notifications, setNotifications] = useState([
    { id: 'demo-1', type: 'morning', message: 'Chúc bạn một ngày làm việc hiệu quả! Đừng quên báo cáo hàng ngày vào cuối ngày.', read: false },
    { id: 'demo-2', type: 'evening', message: 'Nhắc nhở: Đừng quên điền báo cáo kết quả ngày trước 17h30 nhé!', read: false },
    { id: 'demo-3', type: 'evening', message: 'Hệ thống PHN: Cập nhật tiến độ nhiệm vụ giúp Leader theo dõi tốt hơn.', read: false },
  ]);
  const [bellOpen, setBellOpen] = useState(false);
  const NOTIFY_STORAGE = { morning: 'phn_lastMorningNotify', evening: 'phn_lastEveningNotify' };

  const addNotification = (type, message) => {
    const today = new Date().toISOString().slice(0, 10);
    const id = `${today}-${type}`;
    setNotifications((prev) => {
      if (prev.some((n) => n.id === id)) return prev;
      return [{ id, type, message, read: false }, ...prev];
    });
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  useEffect(() => {
    const today = new Date().toDateString();
    const hour = new Date().getHours();

    if (hour >= 6 && hour < 10 && localStorage.getItem(NOTIFY_STORAGE.morning) !== today) {
      localStorage.setItem(NOTIFY_STORAGE.morning, today);
      addNotification('morning', 'Chúc bạn một ngày làm việc hiệu quả! Đừng quên báo cáo hàng ngày vào cuối ngày.');
    }
    if (hour >= 16 && hour < 18 && localStorage.getItem(NOTIFY_STORAGE.evening) !== today) {
      localStorage.setItem(NOTIFY_STORAGE.evening, today);
      addNotification('evening', 'Nhắc nhở: Đừng quên điền báo cáo kết quả ngày trước 17h30 nhé!');
    }

    const interval = setInterval(() => {
      const h = new Date().getHours();
      const d = new Date().toDateString();
      if (h >= 6 && h < 10 && localStorage.getItem(NOTIFY_STORAGE.morning) !== d) {
        localStorage.setItem(NOTIFY_STORAGE.morning, d);
        addNotification('morning', 'Chúc bạn một ngày làm việc hiệu quả! Đừng quên báo cáo hàng ngày vào cuối ngày.');
      }
      if (h >= 16 && h < 18 && localStorage.getItem(NOTIFY_STORAGE.evening) !== d) {
        localStorage.setItem(NOTIFY_STORAGE.evening, d);
        addNotification('evening', 'Nhắc nhở: Đừng quên điền báo cáo kết quả ngày trước 17h30 nhé!');
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Danh sách nhân sự: loại admin (không hiển thị admin trong bảng)
  const visibleUsers = useMemo(
    () => (users || []).filter((u) => (u.role || '').toLowerCase() !== 'admin'),
    [users]
  );

  const teamLabel = (team) => (team === 'old_product' ? 'Sản phẩm cũ' : team === 'new_product' ? 'Sản phẩm mới' : team || '—');
  const teamOptions = useMemo(() => {
    const opts = [...DEFAULT_TEAM_OPTIONS];
    const seen = new Set(['old_product', 'new_product']);
    (users || []).forEach((u) => {
      const t = u.team ?? u.teamName;
      if (t && typeof t === 'string' && !seen.has(t)) { seen.add(t); opts.push({ value: t, label: t }); }
    });
    return opts;
  }, [users]);

  // Báo cáo theo user (Admin/Leader xem trong tab Nhân sự)
  const [userReportsOpen, setUserReportsOpen] = useState(false);
  const [userReportsLoading, setUserReportsLoading] = useState(false);
  const [userReports, setUserReports] = useState([]);
  const [userReportsError, setUserReportsError] = useState('');
  const [userReportsUser, setUserReportsUser] = useState(null);

  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [complianceList, setComplianceList] = useState([]);
  const [complianceLoading, setComplianceLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'reports' || role === 'staff' || !currentUser?.id) return;
    const uid = Number(currentUser.id) || currentUser.id;
    setComplianceLoading(true);
    getMonthlyCompliance(reportMonth, uid)
      .then(setComplianceList)
      .catch(() => setComplianceList([]))
      .finally(() => setComplianceLoading(false));
  }, [activeTab, reportMonth, currentUser?.id, role]);

  const [dashboardStats, setDashboardStats] = useState(null);
  useEffect(() => {
    if (!currentUser?.id) return;
    getDashboardStats(Number(currentUser.id) || currentUser.id)
      .then(setDashboardStats)
      .catch(() => setDashboardStats(null));
  }, [currentUser?.id, tasks.length]);

  const [scoringUser, setScoringUser] = useState(null);
  const [ranking, setRanking] = useState([]);
  useEffect(() => {
    if (!currentUser?.id) return;
    getScoringUser(currentUser.id).then(setScoringUser).catch(() => setScoringUser(null));
  }, [currentUser?.id, tasks.length]);
  useEffect(() => {
    getRanking().then((r) => setRanking(Array.isArray(r) ? r : [])).catch(() => setRanking([]));
  }, [currentUser?.id]);

  const [allReportsList, setAllReportsList] = useState([]);
  const [allReportsLoading, setAllReportsLoading] = useState(false);
  const [reportFilterName, setReportFilterName] = useState('');
  const [reportsSubTab, setReportsSubTab] = useState('today'); // 'today' | 'dashboard'
  useEffect(() => {
    if (activeTab !== 'reports' || role !== 'admin' || !currentUser?.id) return;
    setAllReportsLoading(true);
    getAllReportsForAdmin(Number(currentUser.id) || currentUser.id)
      .then(setAllReportsList)
      .catch(() => setAllReportsList([]))
      .finally(() => setAllReportsLoading(false));
  }, [activeTab, role, currentUser?.id]);

  const openUserReports = useCallback(async (user) => {
    if (!user?.id && !user?.userId) return;
    const uid = user.id ?? user.userId;
    setUserReportsUser(user);
    setUserReportsOpen(true);
    setUserReportsLoading(true);
    setUserReportsError('');
    try {
      const list = await getReportsByUser(uid);
      setUserReports(list);
    } catch (e) {
      setUserReports([]);
      setUserReportsError(e?.message || 'Không tải được báo cáo.');
    } finally {
      setUserReportsLoading(false);
    }
  }, []);

  // Lọc Task theo quyền (BE đã trả về đúng phạm vi; FE lọc thêm nếu cần)
  const filteredTasks = useMemo(() => {
    if (!currentUser?.id) return [];
    let base;
    if (role === 'admin') base = tasks;
    else if (role === 'leader') base = tasks.filter((t) => t.leaderId === currentUser.id || t.assigneeId === currentUser.id);
    else base = tasks.filter((t) => t.assigneeId === currentUser.id);

    const q = taskSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter((t) => {
      const title = (t.title || '').toLowerCase();
      const content = (t.content || '').toLowerCase();
      const objective = (t.objective || '').toLowerCase();
      return title.includes(q) || content.includes(q) || objective.includes(q);
    });
  }, [tasks, role, currentUser?.id, taskSearch]);

  // Phân nhóm theo trạng thái: Quá hạn, Đang thực hiện, Hoàn thành, Tồn đọng, Tạm dừng (chuẩn hóa nhãn)
  // Quá hạn: chưa xong, quá hạn (loại đợi duyệt để tránh báo đỏ khi đã gửi hoàn thành)
  const tasksOverdue = useMemo(() => {
    const n = now();
    return filteredTasks.filter(
      (t) =>
        t.status !== 'completed' &&
        t.status !== 'paused' &&
        t.status !== 'pending_approval' &&
        t.deadline &&
        new Date(String(t.deadline).replace(' ', 'T')) < n
    );
  }, [filteredTasks]);
  const tasksInProgress = useMemo(
    () => filteredTasks.filter((t) => t.status === 'accepted' && !tasksOverdue.some((o) => o.id === t.id)),
    [filteredTasks, tasksOverdue]
  );
  const tasksCompleted = useMemo(() => filteredTasks.filter((t) => t.status === 'completed'), [filteredTasks]);
  const tasksPaused = useMemo(() => filteredTasks.filter((t) => t.status === 'paused'), [filteredTasks]);
  const tasksPendingApproval = useMemo(() => filteredTasks.filter((t) => t.status === 'pending_approval'), [filteredTasks]);

  // Danh sách hiển thị theo tab trạng thái (từ Dashboard hoặc bộ lọc)
  const tasksByFilter = useMemo(() => {
    if (listFilter === 'overdue') return tasksOverdue;
    if (listFilter === 'in_progress') return tasksInProgress;
    if (listFilter === 'completed') return tasksCompleted;
    if (listFilter === 'paused') return tasksPaused;
    if (listFilter === 'pending_approval') return tasksPendingApproval;
    if (listFilter === 'backlog') return filteredTasks.filter((t) => t.status === 'new' || t.status === 'accepted');
    return filteredTasks;
  }, [listFilter, filteredTasks, tasksOverdue, tasksInProgress, tasksCompleted, tasksPaused, tasksPendingApproval]);

  // Tasks trong kỳ (cho Dashboard: tháng/quý/năm)
  const filteredTasksInPeriod = useMemo(
    () => filteredTasks.filter((t) => taskInPeriod(t, periodType, periodValue)),
    [filteredTasks, periodType, periodValue]
  );
  const inPeriodTotal = filteredTasksInPeriod.length;
  const inPeriodCompleted = filteredTasksInPeriod.filter((t) => t.status === 'completed').length;
  const completionRateOverall = inPeriodTotal ? Math.round((inPeriodCompleted / inPeriodTotal) * 100) : 0;
  const personalTotal = filteredTasksInPeriod.filter((t) => t.assigneeId === currentUser?.id).length;
  const personalCompleted = filteredTasksInPeriod.filter((t) => t.assigneeId === currentUser?.id && t.status === 'completed').length;
  const completionRatePersonal = personalTotal ? Math.round((personalCompleted / personalTotal) * 100) : 0;
  // Tồn đọng = Mới + Đang thực hiện (chưa hoàn thành, không tính Tạm dừng, Đợi duyệt)
  const backlogCount = filteredTasks.filter((t) => t.status === 'new' || t.status === 'accepted').length;
  const totalForPct = (dashboardStats?.total != null ? dashboardStats.total : filteredTasks.length) || 1;
  const pct = (n) => Math.round((n / totalForPct) * 100);
  const statOverdue = dashboardStats?.overdue ?? tasksOverdue.length;
  const statInProgress = dashboardStats?.inProgress ?? tasksInProgress.length;
  const statCompleted = dashboardStats?.completed ?? tasksCompleted.length;
  // Điểm chuyên cần: tỉ lệ ngày báo cáo (mẫu: số ngày có báo cáo / số ngày làm việc trong tháng)
  const daysInPeriod = useMemo(() => {
    if (periodType === 'month' && periodValue) {
      const [y, m] = periodValue.split('-').map(Number);
      return new Date(y, m, 0).getDate();
    }
    if (periodType === 'quarter' && periodValue) return 90;
    if (periodType === 'year' && periodValue) return 365;
    return 22;
  }, [periodType, periodValue]);
  const reportDaysCount = useMemo(() => {
    const dates = new Set();
    Object.values(reportHistoryByTask).flat().forEach((r) => dates.add(r.date));
    return dates.size;
  }, [reportHistoryByTask]);
  const attendanceScore = daysInPeriod ? Math.min(100, Math.round((reportDaysCount / Math.min(22, daysInPeriod)) * 100)) : 0;

  const handleAcceptTask = useCallback((id) => {
    if (!currentUser?.id) return;
    acceptTask(id, currentUser.id)
      .then((updated) => {
        setTasks((prev) => prev.map((t) => (String(t.id) === String(id) ? { ...t, ...updated, status: 'accepted' } : t)));
        setSelectedTaskId(null);
      })
      .catch(() => {
        setSelectedTaskId(null);
        fetchTasksForCurrentUser(currentUser.id).then(setTasks);
      });
  }, [currentUser?.id]);

  // Cơ chế khóa: Muốn tiếp nhận công việc mới hôm nay thì phải đã báo cáo tiến độ cho việc tồn đọng của ngày hôm trước
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const myAcceptedTaskIds = useMemo(
    () => filteredTasks.filter((t) => t.assigneeId === currentUser?.id && t.status === 'accepted').map((t) => t.id),
    [filteredTasks, currentUser?.id]
  );
  const hasReportedYesterdayForAll = useMemo(() => {
    if (myAcceptedTaskIds.length === 0) return true;
    return myAcceptedTaskIds.every((taskId) => {
      const history = reportHistoryByTask[taskId] || [];
      return history.some((r) => r.date === yesterday);
    });
  }, [myAcceptedTaskIds, reportHistoryByTask, yesterday]);
  const acceptNewLocked = !hasReportedYesterdayForAll;

  // Validation form báo cáo
  const validateReport = () => {
    const err = {};
    if (!reportTaskId) err.taskId = 'Vui lòng chọn nhiệm vụ.';
    if (!reportResult.trim()) err.result = 'Kết quả đạt được không được để trống.';
    if (reportResult.trim().length < 10) err.result = 'Kết quả tối thiểu 10 ký tự.';
    if (reportWeight !== '' && (Number(reportWeight) < 0 || Number(reportWeight) > 1)) err.weight = 'Trọng số W phải từ 0 đến 1.';
    setReportErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmitReport = (e) => {
    e.preventDefault();
    if (!validateReport()) return;
    const reportDate = new Date().toISOString().slice(0, 10);
    const taskId = Number(reportTaskId);
    const payload = { taskId, reportDate, result: reportResult, attachmentPath: reportAttachmentPath || null };
    const userId = currentUser?.id;
    if (!userId) return;
    submitReport(payload, userId)
      .then((r) => {
        addReportToHistory(taskId, { reportDate: r.date, result: r.result });
        setReportSent(true);
        setReminderRefetchTrigger((t) => t + 1);
        setTimeout(() => {
          setReportTaskId('');
          setReportResult('');
          setReportAttachmentPath('');
          setReportErrors({});
          setReportSent(false);
        }, 1500);
      })
      .catch(() => {
        addReportToHistory(taskId, { reportDate, result: reportResult });
        setReportSent(true);
        setReminderRefetchTrigger((t) => t + 1);
        setTimeout(() => {
          setReportTaskId('');
          setReportResult('');
          setReportAttachmentPath('');
          setReportErrors({});
          setReportSent(false);
        }, 1500);
      });
  };

  // Xuất Excel
  const handleExportExcel = () => {
    const rows = filteredTasks.map((t) => ({
      'Mã': t.id,
      'Tiêu đề': t.title,
      'Trạng thái': t.status === 'new' ? 'Mới' : t.status === 'accepted' ? 'Đang làm' : t.status,
      'Hạn chót': t.deadline || '',
      'Trọng số W': t.weight,
      'WQT': t.wqt || '',
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Nhiệm vụ');
    writeFileXLSX(wb, 'danh-sach-nhiem-vu.xlsx');
  };

  // Dữ liệu biểu đồ Dashboard (Quá hạn, Đang thực hiện, Hoàn thành, Tạm dừng) — ưu tiên từ API dashboard-stats
  const chartData = useMemo(
    () => [
      { name: 'Quá hạn', count: statOverdue, fill: VIETTEL_RED },
      { name: 'Đang thực hiện', count: statInProgress, fill: '#22c55e' },
      { name: 'Hoàn thành', count: statCompleted, fill: '#64748b' },
      { name: 'Tạm dừng', count: tasksPaused.length, fill: '#8b5cf6' },
    ],
    [statOverdue, statInProgress, statCompleted, tasksPaused.length]
  );

  const pieData = useMemo(
    () =>
      [
        { name: 'Quá hạn', value: statOverdue, fill: VIETTEL_RED },
        { name: 'Đang thực hiện', value: statInProgress, fill: '#22c55e' },
        { name: 'Hoàn thành', value: statCompleted, fill: '#64748b' },
        { name: 'Tạm dừng', value: tasksPaused.length, fill: '#8b5cf6' },
      ].filter((d) => d.value > 0),
    [statOverdue, statInProgress, statCompleted, tasksPaused.length]
  );

  // Biểu đồ trọng số: quan trọng (W >= 0.6) / không quan trọng (W < 0.6)
  const weightChartData = useMemo(() => {
    const important = filteredTasksInPeriod.filter((t) => Number(t.weight) >= 0.6).length;
    const normal = filteredTasksInPeriod.length - important;
    return [
      { name: 'Quan trọng (W≥0.6)', value: important, fill: VIETTEL_RED },
      { name: 'Không quan trọng (W<0.6)', value: normal, fill: '#94a3b8' },
    ].filter((d) => d.value > 0);
  }, [filteredTasksInPeriod]);

  // Dữ liệu xu hướng (số báo cáo / số công việc theo ngày - mẫu)
  const trendData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const reportCount = Object.values(reportHistoryByTask).flat().filter((r) => r.date === dateStr).length;
      days.push({ day: dateStr.slice(8), label: `Ngày ${d.getDate()}/${d.getMonth() + 1}`, count: reportCount || 0 });
    }
    return days;
  }, [reportHistoryByTask]);

  // Options cho bộ lọc tháng/quý/năm
  const periodOptions = useMemo(() => {
    const y = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => ({ value: `${y}-${String(i + 1).padStart(2, '0')}`, label: `Tháng ${i + 1}/${y}` }));
    const quarters = [1, 2, 3, 4].map((q) => ({ value: `${y}-Q${q}`, label: `Quý ${q}/${y}` }));
    const years = [y, y - 1, y - 2].map((yr) => ({ value: String(yr), label: `Năm ${yr}` }));
    return { month: months, quarter: quarters, year: years };
  }, []);

  // Khi đổi loại kỳ, chọn giá trị mặc định nếu giá trị hiện tại không hợp lệ
  useEffect(() => {
    const opts = periodOptions[periodType];
    if (!opts || opts.length === 0) return;
    const valid = opts.some((o) => o.value === periodValue);
    if (!valid) {
      const y = new Date().getFullYear();
      const defaultVal = periodType === 'month'
        ? `${y}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
        : periodType === 'quarter'
          ? `${y}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`
          : String(y);
      setPeriodValue(opts.some((o) => o.value === defaultVal) ? defaultVal : opts[0].value);
    }
  }, [periodType]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Đang tải...</p>
      </div>
    );
  }
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <ReportReminderOverlay
        userId={currentUser?.id}
        refetchTrigger={reminderRefetchTrigger}
        onGoReport={() => {
          setActiveTab('tasks');
          setTimeout(() => mainContentScrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }}
      />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header: logo trái, search giữa, chuông + nút + avatar phải */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-6 px-6 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('dash')}
            className="flex items-center gap-2 shrink-0 cursor-pointer bg-transparent border-0 p-0"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: VIETTEL_RED }}>P</div>
            <span className="font-semibold text-slate-800 hidden sm:inline">Quản lý công việc</span>
          </button>
          <div className="flex-1 max-w-xl min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 shrink-0" size={18} />
              <input
                type="text"
                placeholder="Tìm kiếm công việc..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4384E]/25 focus:bg-white"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setBellOpen((o) => !o);
                  if (!bellOpen) markAllRead();
                }}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors relative"
                aria-label="Thông báo"
                aria-expanded={bellOpen}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    aria-hidden
                    onClick={() => setBellOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-hidden bg-white rounded-xl border border-slate-200 shadow-lg z-50 flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                      <span className="font-bold text-slate-800 text-sm">Thông báo</span>
                      {notifications.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setBellOpen(false)}
                          className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          aria-label="Đóng"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto flex-1 min-h-0">
                      <ReportReminderBellBlock
                        userId={currentUser?.id}
                        onGoReport={() => {
                          setBellOpen(false);
                          setActiveTab('tasks');
                          setTimeout(() => mainContentScrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                        }}
                        onClosePopup={() => setBellOpen(false)}
                      />
                      {notifications.length === 0 ? (
                        <p className="p-4 text-slate-400 text-sm text-center">Chưa có thông báo</p>
                      ) : (
                        <ul className="py-2">
                          {notifications.map((n) => (
                            <li
                              key={n.id}
                              className={`px-4 py-3 border-b border-slate-50 last:border-0 ${
                                n.type === 'morning' ? 'bg-emerald-50/50' : 'bg-amber-50/50'
                              }`}
                            >
                              <p className="text-sm text-slate-700 font-medium">{n.message}</p>
                              <p className="text-[11px] text-slate-400 mt-1">
                                {n.type === 'morning' ? 'Chào buổi sáng' : 'Nhắc báo cáo'}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-2">
              {canShowAttendance && (
                <button
                  type="button"
                  onClick={() => setActiveTab('attendance')}
                  className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors hover:opacity-90"
                  style={{ backgroundColor: VIETTEL_RED }}
                >
                  <Clock size={16} /> Chấm công
                </button>
              )}
              {role !== 'staff' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('assign')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                >
                  <Plus size={14} /> Giao việc
                </button>
              )}
            </div>
            {/* User menu: click để mở panel dọc giống Facebook */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setUserCardOpen((o) => !o)}
                className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                aria-label="Mở menu tài khoản"
              >
                <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 font-semibold text-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-xs font-semibold text-slate-800 leading-tight max-w-[140px] truncate">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide leading-tight">
                    {role === 'admin' ? 'ADMIN' : role === 'leader' ? 'LEADER' : 'STAFF'}
                  </span>
                </div>
                <ChevronRight
                  size={16}
                  className={`hidden sm:block text-slate-400 transition-transform ${userCardOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {userCardOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    aria-hidden
                    onClick={() => setUserCardOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-lg z-50 flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-sm">
                        {currentUser.name.charAt(0)}
                      </div>
                      <div className="overflow-hidden min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{currentUser.name}</p>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                          {role === 'admin' ? 'ADMIN' : role === 'leader' ? 'LEADER' : 'STAFF'}
                        </p>
                      </div>
                    </div>
                    {role !== 'staff' && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('users'); setUserCardOpen(false); }}
                          className="px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Users size={16} /> Nhân sự
                        </button>
                        {role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => { setActiveTab('reports'); setUserCardOpen(false); }}
                            className="px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <FileText size={16} /> Báo cáo
                          </button>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={logout}
                      className="px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
                    >
                      <LogOut size={16} /> Đăng xuất
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Nội dung chính */}
        <div ref={mainContentScrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 min-w-0">
          <div className="max-w-5xl mx-auto pb-4">
            {/* Bảng điều khiển với 3 tab nội bộ: Điểm & Xếp hạng / Theo dõi Nhiệm vụ / Chuyên cần */}
            {activeTab === 'dash' && (() => {
              const score100 = (v) => (v != null ? (Number(v) * 100).toFixed(1) : '—');
              const formatPct = (v) => (v != null ? `${Math.round(Number(v) * 100)}%` : '—');
              const filteredRanking = (ranking || []).filter((r) => {
                const name = String(r.name ?? r.userName ?? '').toLowerCase();
                return name !== 'nguyễn đình dũng' && name !== 'nguyen dinh dung';
              });
              const currentRank = filteredRanking.findIndex((r) => String(r.userId) === String(currentUser?.id)) + 1;
              const totalRanked = filteredRanking.length;

              const renderPerformance = () => (
                <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-4">Hoàn thành cá nhân</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tổng điểm</p>
                      <p className="text-2xl font-black text-slate-900">
                        {score100(scoringUser?.totalScore)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Xếp hạng</p>
                      <p className="text-2xl font-black text-slate-900">
                        #{currentRank > 0 ? currentRank : '—'} <span className="text-slate-500 font-normal text-lg">/ {totalRanked || '—'}</span>
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Top vinh danh</p>
                      <div className="space-y-1 max-h-64 overflow-auto pr-1">
                        {(showAllRanking ? filteredRanking : filteredRanking.slice(0, 3)).map((r, idx) => (
                          <div key={r.userId ?? `${idx}-${r.userName ?? r.name ?? ''}`} className="flex items-center gap-2 text-sm">
                            <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600'}`}>{idx + 1}</span>
                            <span className="flex-1">{r.name ?? r.userName ?? '—'}</span>
                            <span className="font-semibold text-slate-800">{score100(r.totalScore)}đ</span>
                          </div>
                        ))}
                      </div>
                      {filteredRanking.length > 3 && (
                        <div className="mt-2 text-right">
                          <button
                            type="button"
                            onClick={() => setShowAllRanking((v) => !v)}
                            className="text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline"
                          >
                            {showAllRanking ? 'Thu gọn' : 'Xem tất cả'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                      <h3 className="text-sm font-bold text-slate-800">Chi tiết điểm đánh giá</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left py-2 px-3 font-semibold text-slate-700">Tiêu chí đánh giá</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-700">Tỷ trọng</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-700">Điểm đạt</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-700">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-700">Chuyên cần</td>
                          <td className="py-2 px-3">40%</td>
                          <td className="py-2 px-3">{formatPct(scoringUser?.attendanceScore)}</td>
                          <td className="py-2 px-3 text-slate-500">{scoringUser?.reportedDays != null ? `Số ngày báo cáo: ${scoringUser.reportedDays}` : '—'}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-700">Chất lượng công việc</td>
                          <td className="py-2 px-3">60%</td>
                          <td className="py-2 px-3">{formatPct(scoringUser?.qualityScore)}</td>
                          <td className="py-2 px-3 text-slate-500">{scoringUser?.completedTasks != null ? `Hoàn thành: ${scoringUser.completedTasks} nhiệm vụ` : '—'}</td>
                        </tr>
                        <tr className="bg-slate-50 font-bold">
                          <td className="py-2 px-3">Tổng cộng</td>
                          <td className="py-2 px-3">100%</td>
                          <td className="py-2 px-3">{score100(scoringUser?.totalScore)}</td>
                          <td className="py-2 px-3" />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              );

              const renderTasksInDashboard = () => (
                <section className="mb-3" id="task-list-section">
                  {/* Tái sử dụng layout giống tab Nhiệm vụ */}
                  {role === 'admin' && (
                    <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <h3 className="text-sm font-bold text-slate-800 mb-1">Hoàn thành chờ duyệt (theo dõi)</h3>
                      <p className="text-slate-600 text-sm mb-2">
                        {tasksPendingApproval.length > 0
                          ? `Có ${tasksPendingApproval.length} nhiệm vụ đang đợi Leader (người phân công) duyệt. Bấm nút "Đợi duyệt" bên dưới để xem danh sách. Admin chỉ theo dõi, không duyệt thay.`
                          : 'Chưa có nhiệm vụ nào đợi duyệt. Khi nhân sự bấm Hoàn thành, nhiệm vụ sẽ hiện ở đây; Leader duyệt hoặc trả về tồn đọng.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setListFilter('pending_approval')}
                        className="text-sm font-semibold text-amber-600 hover:text-amber-700"
                      >
                        Xem danh sách Đợi duyệt →
                      </button>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Nhiệm vụ</h2>
                      <p className="text-slate-500 font-medium">
                        {listFilter === 'all' && 'Tất cả công việc của bạn. Kích vào từng dòng để xem chi tiết và thao tác.'}
                        {listFilter === 'overdue' && `Công việc quá hạn (${tasksByFilter.length}). Kích vào để xem chi tiết.`}
                        {listFilter === 'in_progress' && `Đang thực hiện (${tasksByFilter.length}). Kích vào để cập nhật tiến độ.`}
                        {listFilter === 'pending_approval' && `Đợi duyệt (${tasksByFilter.length}). Leader (người phân công) duyệt hoặc trả về tồn đọng.`}
                        {listFilter === 'completed' && `Đã hoàn thành (${tasksByFilter.length}).`}
                        {listFilter === 'paused' && `Tạm dừng (${tasksByFilter.length}).`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setListFilter('all')}
                        className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'all' ? 'text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        style={listFilter === 'all' ? { backgroundColor: VIETTEL_RED } : undefined}
                      >
                        Tất cả {filteredTasks.length ? `(${filteredTasks.length})` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setListFilter('overdue')}
                        className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'overdue' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        Quá hạn {tasksOverdue.length ? `(${tasksOverdue.length})` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setListFilter('in_progress')}
                        className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'in_progress' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        Đang thực hiện {tasksInProgress.length ? `(${tasksInProgress.length})` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setListFilter('pending_approval')}
                        className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'pending_approval' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        Đợi duyệt {tasksPendingApproval.length > 0 ? `(${tasksPendingApproval.length})` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setListFilter('completed')}
                        className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'completed' ? 'bg-slate-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        Hoàn thành {tasksCompleted.length ? `(${tasksCompleted.length})` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setListFilter('paused')}
                        className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'paused' ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        Tạm dừng {tasksPaused.length ? `(${tasksPaused.length})` : ''}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {tasksLoading ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
                        Đang tải danh sách nhiệm vụ...
                      </div>
                    ) : (
                      <>
                        {tasksByFilter.map((task) => (
                          <TaskListCard
                            key={task.id}
                            task={task}
                            users={users}
                            onClick={() => setSelectedTaskId(task.id)}
                          />
                        ))}
                        {tasksByFilter.length === 0 && (
                          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
                            Không có công việc nào trong nhóm này.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>
              );

              return (
                <>
                  {/* Thanh 3 tab trên cùng – bố cục ngang kiểu Facebook: cụm tab giữa, chọn tháng bên phải */}
                  <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm -mx-4 md:-mx-6 px-4 md:px-6 py-3 mb-4">
                    <div className="max-w-5xl mx-auto flex items-center gap-4">
                      <div className="flex-1 min-w-0" />
                      <div className="flex flex-wrap justify-center gap-1 bg-slate-100 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setDashView('performance')}
                          className={`px-4 md:px-6 py-2 rounded-md text-sm font-medium transition-colors ${dashView === 'performance' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Điểm & Xếp hạng
                        </button>
                        <button
                          type="button"
                          onClick={() => setDashView('tasks')}
                          className={`px-4 md:px-6 py-2 rounded-md text-sm font-medium transition-colors ${dashView === 'tasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Theo dõi Nhiệm vụ
                        </button>
                        <button
                          type="button"
                          onClick={() => setDashView('attendance')}
                          className={`px-4 md:px-6 py-2 rounded-md text-sm font-medium transition-colors ${dashView === 'attendance' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Chuyên cần
                        </button>
                      </div>
                      <div className="flex-1 flex justify-end min-w-0">
                        <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option>Tháng 2/2026</option>
                          <option>Tháng 1/2026</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {dashView === 'performance' && renderPerformance()}
                  {dashView === 'tasks' && renderTasksInDashboard()}
                  {dashView === 'attendance' && (
                    <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                      <DashboardAttendanceMock currentUser={currentUser} />
                    </section>
                  )}
                </>
              );
            })()}

            {/* Tab: Nhiệm vụ – danh sách theo bộ lọc (từ Dashboard hoặc Tất cả) */}
            {activeTab === 'tasks' && (
              <>
                {role === 'admin' && (
                  <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <h3 className="text-sm font-bold text-slate-800 mb-1">Hoàn thành chờ duyệt (theo dõi)</h3>
                    <p className="text-slate-600 text-sm mb-2">
                      {tasksPendingApproval.length > 0
                        ? `Có ${tasksPendingApproval.length} nhiệm vụ đang đợi Leader (người phân công) duyệt. Bấm nút "Đợi duyệt" bên dưới để xem danh sách. Admin chỉ theo dõi, không duyệt thay.`
                        : 'Chưa có nhiệm vụ nào đợi duyệt. Khi nhân sự bấm Hoàn thành, nhiệm vụ sẽ hiện ở đây; Leader duyệt hoặc trả về tồn đọng.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setListFilter('pending_approval')}
                      className="text-sm font-semibold text-amber-600 hover:text-amber-700"
                    >
                      Xem danh sách Đợi duyệt →
                    </button>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Nhiệm vụ</h2>
                    <p className="text-slate-500 font-medium">
                      {listFilter === 'all' && 'Tất cả công việc của bạn. Kích vào từng dòng để xem chi tiết và thao tác.'}
                      {listFilter === 'overdue' && `Công việc quá hạn (${tasksByFilter.length}). Kích vào để xem chi tiết.`}
                      {listFilter === 'in_progress' && `Đang thực hiện (${tasksByFilter.length}). Kích vào để cập nhật tiến độ.`}
                      {listFilter === 'pending_approval' && `Đợi duyệt (${tasksByFilter.length}). Leader (người phân công) duyệt hoặc trả về tồn đọng.`}
                      {listFilter === 'completed' && `Đã hoàn thành (${tasksByFilter.length}).`}
                      {listFilter === 'paused' && `Tạm dừng (${tasksByFilter.length}).`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setListFilter('all')}
                      className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'all' ? 'text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      style={listFilter === 'all' ? { backgroundColor: VIETTEL_RED } : undefined}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setListFilter('overdue')}
                      className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'overdue' ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Quá hạn
                    </button>
                    <button
                      type="button"
                      onClick={() => setListFilter('in_progress')}
                      className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'in_progress' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Đang thực hiện
                    </button>
                    <button
                      type="button"
                      onClick={() => setListFilter('pending_approval')}
                      className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'pending_approval' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Đợi duyệt {tasksPendingApproval.length > 0 ? `(${tasksPendingApproval.length})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setListFilter('completed')}
                      className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'completed' ? 'bg-slate-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Hoàn thành
                    </button>
                    <button
                      type="button"
                      onClick={() => setListFilter('paused')}
                      className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${listFilter === 'paused' ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Tạm dừng
                    </button>
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <Download size={18} /> Xuất Excel
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <Filter size={18} /> Lọc tháng
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {tasksLoading ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
                      Đang tải danh sách nhiệm vụ...
                    </div>
                  ) : (
                    <>
                      {tasksByFilter.map((task) => (
                        <TaskListCard
                          key={task.id}
                          task={task}
                          users={users}
                          onClick={() => setSelectedTaskId(task.id)}
                        />
                      ))}
                      {tasksByFilter.length === 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
                          Không có công việc nào trong nhóm này.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Tab: Giao việc mới (Admin / Leader) */}
            {activeTab === 'assign' && role !== 'staff' && (
              <AssignTaskForm
                currentUser={currentUser}
                role={role}
                users={users}
                onCreated={(t) => {
                  setTasks((prev) => [t, ...prev]);
                  setActiveTab('tasks');
                }}
              />
            )}

            {/* Tab: Quản lý nhân sự */}
            {activeTab === 'users' && (
              <section className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Quản lý nhân sự</h2>
                    <p className="text-slate-500 text-sm">
                      {role === 'admin'
                        ? 'Danh sách nhân sự. Admin có thể thêm, bớt nhân sự và chọn nhóm, phân quyền chấm công.'
                        : currentUser?.team
                          ? `Nhóm của bạn: ${teamLabel(currentUser.team)}`
                          : 'Danh sách nhân sự trong nhóm của bạn.'}
                    </p>
                  </div>
                  {role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => { setAddUserOpen(true); setAddUserError(''); setAddUserForm({ username: '', password: '', name: '', role: 'staff', team: 'old_product', newTeamName: '', canManageAttendance: false }); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90"
                      style={{ backgroundColor: VIETTEL_RED }}
                    >
                      <Plus size={18} /> Thêm nhân sự
                    </button>
                  )}
                </div>

                {usersLoading ? (
                  <div className="py-10 text-center text-slate-500">Đang tải danh sách nhân sự...</div>
                ) : usersError ? (
                  <div className="py-6 text-center text-red-500 text-sm">{usersError}</div>
                ) : visibleUsers.length === 0 ? (
                  <div className="py-10 text-center text-slate-500">Chưa có dữ liệu nhân sự.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-500 text-xs uppercase tracking-wider">
                          <th className="py-2 pr-4">Họ và tên</th>
                          <th className="py-2 pr-4">Tài khoản</th>
                          <th className="py-2 pr-4">Nhóm</th>
                          <th className="py-2 pr-4">Vai trò</th>
                          {role === 'admin' && <th className="py-2 pr-4">Quyền chấm công</th>}
                          {role === 'admin' && <th className="py-2 pr-4">Thao tác</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleUsers.map((u, index) => {
                          const name = u.name || u.fullName || u.username || '—';
                          const username = u.username || u.email || '—';
                          const roleLabel = String(u.role || '').toUpperCase();
                          const currentRole = (u.role || 'staff').toLowerCase();
                          const uid = u.id ?? u.userId;
                          const uidNum = Number(uid);
                          const rowKey = `user-${uid}-${String(username)}-${index}`;
                          const isEditingRole = role === 'admin' && Number(uid) !== Number(currentUser?.id);
                          return (
                            <tr key={rowKey} className="border-b last:border-0 border-slate-100" data-userid={String(uid)}>
                              <td className="py-2 pr-4 font-medium text-slate-800">{name}</td>
                              <td className="py-2 pr-4 text-slate-600">{username}</td>
                              <td className="py-2 pr-4 text-slate-600">
                                {role === 'admin' ? (
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={u.team ?? u.teamName ?? ''}
                                      onChange={async (e) => {
                                        const v = e.target.value;
                                        if (v === '__new__') {
                                          const name = window.prompt('Tên nhóm mới:');
                                          if (name == null || !name.trim()) return;
                                          try {
                                            await updateUserTeam(uid, name.trim(), currentUser.id);
                                            const list = await fetchPersonnel(currentUser.id);
                                            personnelScrollRestoreRef.current = mainContentScrollRef.current?.scrollTop ?? null;
                                            setUsers(list);
                                          } catch (err) { console.error(err); }
                                          return;
                                        }
                                        try {
                                          await updateUserTeam(uid, v || null, currentUser.id);
                                          const list = await fetchPersonnel(currentUser.id);
                                          personnelScrollRestoreRef.current = mainContentScrollRef.current?.scrollTop ?? null;
                                          setUsers(list);
                                        } catch (err) { console.error(err); }
                                      }}
                                      className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white text-slate-700"
                                    >
                                      <option value="">—</option>
                                      {teamOptions.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                      ))}
                                      <option value="__new__">＋ Thêm nhóm</option>
                                    </select>
                                  </div>
                                ) : (
                                  teamLabel(u.team)
                                )}
                              </td>
                              <td className="py-2 pr-4">
                                {isEditingRole ? (
                                  <select
                                    value={currentRole}
                                    onChange={async (e) => {
                                      const newRole = e.target.value;
                                      try {
                                        await updateUserRole(uid, newRole, currentUser.id);
                                        const list = await fetchPersonnel(currentUser.id);
                                        personnelScrollRestoreRef.current = mainContentScrollRef.current?.scrollTop ?? null;
                                        setUsers(list);
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }}
                                    className="text-xs font-semibold rounded-lg border border-slate-200 px-2 py-1 bg-white text-slate-700"
                                  >
                                    <option value="admin">ADMIN</option>
                                    <option value="leader">LEADER</option>
                                    <option value="staff">STAFF</option>
                                  </select>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                                    {roleLabel === 'ADMIN' || roleLabel === 'LEADER' || roleLabel === 'STAFF'
                                      ? roleLabel
                                      : 'STAFF'}
                                  </span>
                                )}
                              </td>
                              {role === 'admin' && (
                                <td className="py-2 pr-4 align-top">
                                  <div className="flex flex-col gap-0.5">
                                    <label className="inline-flex cursor-pointer w-fit">
                                      <input
                                        type="checkbox"
                                        checked={!!u.canManageAttendance}
                                        data-userid={String(uid)}
                                        onChange={async (e) => {
                                          const tr = e.currentTarget.closest('tr');
                                          const rawId = tr?.getAttribute('data-userid') ?? e.currentTarget.getAttribute('data-userid') ?? String(uid);
                                          const targetUserId = Number(rawId);
                                          if (!targetUserId || Number.isNaN(targetUserId)) return;
                                          setAttendanceUpdateMsg({ id: targetUserId, text: '' });
                                          const newAllowed = !u.canManageAttendance;
                                          try {
                                            await updateAttendancePermission(targetUserId, newAllowed, currentUser.id);
                                            const list = await fetchPersonnel(currentUser.id);
                                            personnelScrollRestoreRef.current = mainContentScrollRef.current?.scrollTop ?? null;
                                            setUsers(list);
                                            setAttendanceUpdateMsg({ id: targetUserId, text: 'Đã cập nhật.' });
                                            setTimeout(() => setAttendanceUpdateMsg((m) => (m.id === targetUserId ? { id: null, text: '' } : m)), 2000);
                                          } catch (err) {
                                            console.error(err);
                                            const msg = (err && err.message) ? String(err.message).slice(0, 80) : 'Lỗi, thử lại.';
                                            setAttendanceUpdateMsg({ id: targetUserId, text: msg });
                                            setTimeout(() => setAttendanceUpdateMsg((m) => (m.id === targetUserId ? { id: null, text: '' } : m)), 5000);
                                          }
                                        }}
                                        className="rounded border-slate-300 text-[#D4384E] focus:ring-[#D4384E]"
                                        title="Quyền chấm công"
                                      />
                                    </label>
                                    {attendanceUpdateMsg.id === uidNum && attendanceUpdateMsg.text && (
                                      <span className={`text-[11px] block ${attendanceUpdateMsg.text.startsWith('Lỗi') ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {attendanceUpdateMsg.text}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              )}
                              {role === 'admin' && (
                                <td className="py-2 pr-4">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!window.confirm(`Xóa nhân viên "${name}"? Không thể hoàn tác.`)) return;
                                      try {
                                        await deleteUser(uid, currentUser.id);
                                        const list = await fetchPersonnel(currentUser.id);
                                        personnelScrollRestoreRef.current = mainContentScrollRef.current?.scrollTop ?? null;
                                        setUsers(list);
                                      } catch (err) { console.error(err); }
                                    }}
                                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                                  >
                                    Xóa
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Modal Thêm nhân sự (chỉ admin) */}
                {addUserOpen && role === 'admin' && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddUserOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Thêm nhân sự</h3>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setAddUserError('');
                          const teamValue = addUserForm.team === '__new__' ? (addUserForm.newTeamName || '').trim() : addUserForm.team;
                          if (!addUserForm.username.trim() || !addUserForm.password || !addUserForm.name.trim()) {
                            setAddUserError('Vui lòng điền đủ Tên, Tài khoản, Mật khẩu.');
                            return;
                          }
                          setAddUserLoading(true);
                          try {
                            await createUser({
                              username: addUserForm.username.trim(),
                              password: addUserForm.password,
                              name: addUserForm.name.trim(),
                              role: addUserForm.role.toUpperCase(),
                              team: teamValue || null,
                              canManageAttendance: addUserForm.canManageAttendance,
                            }, currentUser.id);
                            const list = await fetchPersonnel(currentUser.id);
                            personnelScrollRestoreRef.current = mainContentScrollRef.current?.scrollTop ?? null;
                            setUsers(list);
                            setAddUserOpen(false);
                          } catch (err) {
                            setAddUserError(err?.message || 'Tạo thất bại. Kiểm tra tài khoản trùng.');
                          } finally {
                            setAddUserLoading(false);
                          }
                        }}
                        className="space-y-3"
                      >
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Tên đầy đủ *</label>
                          <input
                            type="text"
                            value={addUserForm.name}
                            onChange={(e) => setAddUserForm((f) => ({ ...f, name: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            placeholder="Nguyễn Văn A"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Tài khoản *</label>
                          <input
                            type="text"
                            value={addUserForm.username}
                            onChange={(e) => setAddUserForm((f) => ({ ...f, username: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            placeholder="nguyenvana"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Mật khẩu *</label>
                          <input
                            type="password"
                            value={addUserForm.password}
                            onChange={(e) => setAddUserForm((f) => ({ ...f, password: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            placeholder="••••••••"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Vai trò</label>
                          <select
                            value={addUserForm.role}
                            onChange={(e) => setAddUserForm((f) => ({ ...f, role: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="staff">STAFF</option>
                            <option value="leader">LEADER</option>
                            <option value="admin">ADMIN</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Nhóm</label>
                          <select
                            value={addUserForm.team}
                            onChange={(e) => setAddUserForm((f) => ({ ...f, team: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                          >
                            {teamOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                            <option value="__new__">＋ Nhóm khác...</option>
                          </select>
                          {addUserForm.team === '__new__' && (
                            <input
                              type="text"
                              value={addUserForm.newTeamName}
                              onChange={(e) => setAddUserForm((f) => ({ ...f, newTeamName: e.target.value }))}
                              placeholder="Tên nhóm mới"
                              className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            />
                          )}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addUserForm.canManageAttendance}
                            onChange={(e) => setAddUserForm((f) => ({ ...f, canManageAttendance: e.target.checked }))}
                            className="rounded border-slate-300 text-[#D4384E]"
                          />
                          <span className="text-sm text-slate-700">Quyền chấm công</span>
                        </label>
                        {addUserError && <p className="text-red-500 text-sm">{addUserError}</p>}
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setAddUserOpen(false)}
                            className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold text-sm"
                          >
                            Hủy
                          </button>
                          <button
                            type="submit"
                            disabled={addUserLoading}
                            className="flex-1 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
                            style={{ backgroundColor: VIETTEL_RED }}
                          >
                            {addUserLoading ? 'Đang tạo...' : 'Thêm'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Tab: Báo cáo – chỉ Admin, xem tất cả báo cáo của mọi người */}
            {activeTab === 'reports' && role === 'admin' && (
              <section className="bg-white border border-slate-200 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Tất cả báo cáo gần đây</h2>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Lọc theo tên người báo cáo..."
                    value={reportFilterName}
                    onChange={(e) => setReportFilterName(e.target.value)}
                    className="w-full max-w-md border border-slate-200 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-[#D4384E]/20 outline-none"
                  />
                </div>
                {allReportsLoading ? (
                  <p className="text-slate-500 text-sm">Đang tải danh sách báo cáo...</p>
                ) : (() => {
                  const filtered = reportFilterName.trim()
                    ? allReportsList.filter((r) => (r.userName || '').toLowerCase().includes(reportFilterName.trim().toLowerCase()))
                    : allReportsList;
                  return filtered.length === 0 ? (
                    <p className="text-slate-400 text-sm">{reportFilterName.trim() ? 'Không có báo cáo nào trùng với tên đã nhập.' : 'Chưa có báo cáo nào.'}</p>
                  ) : (
                    <ul className="space-y-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                      {filtered.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-start gap-2 p-3 bg-slate-50/50 hover:bg-slate-50">
                          <span className="text-[11px] font-semibold text-slate-500 shrink-0">{r.date}</span>
                          <span className="text-xs font-medium text-slate-700">{r.userName || '—'}</span>
                          <span className="text-xs text-slate-500">· {r.taskTitle || 'Nhiệm vụ'}</span>
                          <p className="w-full text-sm text-slate-700 mt-0.5">{r.result}</p>
                          {r.attachmentPath && (() => {
                            const paths = String(r.attachmentPath).split('|').filter(Boolean);
                            return paths.length > 0 ? (
                              <div className="flex flex-wrap gap-2 mt-1">
                                {paths.map((path, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => downloadAttachment(path).catch((e) => alert(e?.message || 'Tải file thất bại'))}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D4384E]/10 text-[#D4384E] text-xs font-semibold hover:bg-[#D4384E]/20 transition-colors"
                                  >
                                    <Download size={14} />
                                    {paths.length > 1 ? `Tải file ${idx + 1}` : 'Tải file đính kèm'}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </section>
            )}

            {/* Tab: Chấm công */}
            {activeTab === 'attendance' && (
              <AttendancePanel currentUser={currentUser} role={role} canManageAttendance={currentUser?.canManageAttendance} />
            )}

            {/* Tab: Xếp hạng */}
            {activeTab === 'wqt' && (
              <section className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                <h2 className="text-2xl font-black text-slate-900 mb-2">Xếp hạng</h2>
                <p className="text-slate-500">Bảng xếp hạng hiệu suất sẽ hiển thị tại đây.</p>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Modal chi tiết task: đọc nội dung → Tiếp nhận / Cập nhật tiến độ / Lịch sử báo cáo */}
      {selectedTaskId && (() => {
        const task = tasks.find((t) => t.id === selectedTaskId);
        if (!task) return null;
        const assigneeName = task.assigneeName
          || (users && users.find((u) => String(u.id ?? u.userId) === String(task.assigneeId))?.name)
          || null;
        const refreshTasks = () => fetchTasksForCurrentUser(currentUser?.id).then(setTasks);
        return (
          <TaskDetailModal
            task={task}
            onClose={() => setSelectedTaskId(null)}
            onAccept={() => handleAcceptTask(selectedTaskId)}
            reportHistory={reportHistoryByTask[selectedTaskId] || []}
            onAddReport={(report) => {
              if (!currentUser?.id) return;
              submitReport(
                { taskId: selectedTaskId, reportDate: report.reportDate, result: report.result, attachmentPath: report.attachmentPath },
                currentUser.id
              )
                .then((r) => {
                  addReportToHistory(selectedTaskId, { reportDate: r.date, result: r.result });
                  setReminderRefetchTrigger((t) => t + 1);
                })
                .catch(() => {
                  addReportToHistory(selectedTaskId, report);
                  setReminderRefetchTrigger((t) => t + 1);
                });
            }}
            role={role}
            canEdit={role === 'admin' || role === 'leader'}
            assigneeName={assigneeName}
            acceptNewLocked={acceptNewLocked}
            yesterday={yesterday}
            onComplete={(payload) => submitCompletion(Number(selectedTaskId) || selectedTaskId, Number(currentUser?.id) || currentUser?.id, payload).then(refreshTasks).then(() => setSelectedTaskId(null))}
            onApprove={(quality) => approveCompletion(selectedTaskId, currentUser.id, quality).then(refreshTasks).then(() => setSelectedTaskId(null))}
            onReject={(reason) => rejectCompletion(selectedTaskId, currentUser.id, reason).then(refreshTasks).then(() => setSelectedTaskId(null))}
            currentUserId={currentUser?.id}
            onSaveEdit={(payload) => updateTaskDetails(selectedTaskId, currentUser.id, payload).then(refreshTasks)}
          />
        );
      })()}

      {/* Panel xem báo cáo ngày theo nhân sự (Admin/Leader) */}
      {userReportsOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-end bg-black/30" onClick={() => setUserReportsOpen(false)}>
          <aside
            className="w-full max-w-md bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Báo cáo ngày</h3>
                <p className="text-[12px] text-slate-500">
                  {userReportsUser ? `Nhân sự: ${userReportsUser.name}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUserReportsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {userReportsLoading ? (
                <p className="text-slate-500 text-sm">Đang tải báo cáo...</p>
              ) : userReportsError ? (
                <p className="text-red-500 text-sm">{userReportsError}</p>
              ) : userReports.length === 0 ? (
                <p className="text-slate-400 text-sm">Chưa có báo cáo nào.</p>
              ) : (
                <ul className="space-y-2">
                  {userReports.map((r) => (
                    <li key={r.id} className="border border-slate-100 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800">{r.taskTitle || 'Nhiệm vụ'}</span>
                        <span className="text-[11px] text-slate-400">{r.date}</span>
                      </div>
                      <p className="text-slate-700 text-sm whitespace-pre-wrap">{r.result}</p>
                      {r.attachmentPath && (() => {
                        const paths = String(r.attachmentPath).split('|').filter(Boolean);
                        return paths.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {paths.map((path, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => downloadAttachment(path).catch((e) => alert(e?.message || 'Tải file thất bại'))}
                                className="text-xs font-medium text-[#D4384E] hover:underline"
                              >
                                {paths.length > 1 ? `Tải file ${idx + 1}` : 'Tải file đính kèm'}
                              </button>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

    </div>
  );
};

/** Modal chi tiết task: đọc nội dung, Tiếp nhận (chỉ assignee), báo cáo tiến độ, báo cáo hoàn thành, đợi duyệt; Leader (người phân công) duyệt/từ chối; Admin/Leader chỉnh sửa nội dung, thời hạn, trọng số, trạng thái, chất lượng */
const TaskDetailModal = ({
  task,
  onClose,
  onAccept,
  reportHistory,
  onAddReport,
  role,
  canEdit,
  assigneeName,
  acceptNewLocked,
  yesterday,
  onComplete,
  onApprove,
  onReject,
  currentUserId,
  onSaveEdit,
}) => {
  const [reportChoice, setReportChoice] = useState(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportResult, setReportResult] = useState('');
  const [reportAttachmentPaths, setReportAttachmentPaths] = useState([]);
  const [reportFileUploading, setReportFileUploading] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [completionLink, setCompletionLink] = useState('');
  const [completionFilePath, setCompletionFilePath] = useState('');
  const [completionFileUploading, setCompletionFileUploading] = useState(false);
  const [completionSubmitting, setCompletionSubmitting] = useState(false);
  const [completionError, setCompletionError] = useState('');
  const [approveQuality, setApproveQuality] = useState(task.quality != null ? String(task.quality) : '');
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  useEffect(() => {
    setReportChoice(null);
    setReportDate(new Date().toISOString().slice(0, 10));
    setReportResult('');
    setReportAttachmentPaths([]);
    setReportError('');
  }, [task?.id, task?.weight]);
  const toDatetimeLocal = (v) => {
    if (!v) return '';
    const d = new Date(String(v).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [editTitle, setEditTitle] = useState(task.title || '');
  const [editContent, setEditContent] = useState(task.content || '');
  const [editObjective, setEditObjective] = useState(task.objective || '');
  const [editDeadline, setEditDeadline] = useState(toDatetimeLocal(task.deadline));
  const [editWeight, setEditWeight] = useState(task.weight != null ? String(task.weight) : '0.5');
  const [editStatus, setEditStatus] = useState((task.status || 'NEW').toUpperCase());
  const [editQuality, setEditQuality] = useState(task.quality != null ? String(task.quality) : '');

  const formatDeadline = (v) => {
    if (!v) return '—';
    const d = new Date(String(v).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-slate-900">Chi tiết công việc</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 mb-1">{task.title}</h2>
            <p className="text-slate-500 text-sm">
              Hạn chót: {formatDeadline(task.deadline)} · Trọng số: {weightLabel(task.weight)} · Người thực hiện: {assigneeName || '—'}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mục tiêu</h4>
            <p className="text-slate-700 text-sm">{task.objective}</p>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nội dung công việc</h4>
            <p className="text-slate-700 text-sm whitespace-pre-wrap">{task.content}</p>
          </div>

          {task.status === 'new' && (
            <div className="pt-4 border-t border-slate-100">
              {String(currentUserId) !== String(task.assigneeId) ? (
                <p className="text-slate-500 text-sm">Chỉ người được phân công mới có thể tiếp nhận công việc này.</p>
              ) : acceptNewLocked ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
                  <p className="font-bold mb-1">Chưa thể tiếp nhận công việc mới</p>
                  <p>Bạn cần báo cáo công việc ngày hôm qua còn tồn đọng trước khi tiếp nhận công việc mới trong ngày hôm nay.</p>
                </div>
              ) : (
                <>
                  <p className="text-slate-600 text-sm mb-3">Sau khi đọc kỹ nội dung và mục tiêu, xác nhận tiếp nhận công việc:</p>
                  <button
                    type="button"
                    onClick={onAccept}
                    className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600"
                  >
                    Tiếp nhận <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
          )}

          {task.status === 'accepted' && (
            <>
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-3">Báo cáo</h4>
                {String(currentUserId) !== String(task.assigneeId) ? (
                  <p className="text-slate-500 text-sm">Chỉ người thực hiện mới có thể báo cáo tiến độ hoặc báo cáo kết thúc.</p>
                ) : reportChoice === null ? (
                  <>
                    <p className="text-slate-500 text-sm mb-3">Bạn muốn</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setReportChoice('progress')}
                        className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                      >
                        <span className="font-bold text-slate-900 block mb-1">Báo cáo tiến độ</span>
                        <span className="text-xs text-slate-500">Việc chưa xong — cập nhật tiến độ trong ngày (đang ở bước nào trong quy trình).</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportChoice('completion')}
                        className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-colors"
                      >
                        <span className="font-bold text-slate-900 block mb-1">Báo cáo kết thúc công việc</span>
                        <span className="text-xs text-slate-500">Việc đã hoàn thành — gửi báo cáo kết thúc để chờ lãnh đạo phê duyệt.</span>
                      </button>
                    </div>
                  </>
                ) : reportChoice === 'progress' ? (
                  <>
                    <p className="mb-2">
                      <button type="button" onClick={() => { setReportChoice(null); setReportError(''); }} className="text-sm text-slate-500 hover:underline">← Chọn lại</button>
                    </p>
                    <h5 className="text-sm font-bold text-slate-700 mb-2">Báo cáo tiến độ</h5>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!reportResult.trim() || reportResult.trim().length < 10) {
                          setReportError('Kết quả / tiến độ tối thiểu 10 ký tự.');
                          return;
                        }
                        setReportError('');
                        setReportSubmitting(true);
                        const submitPromise = onAddReport({
                          reportDate,
                          result: reportResult.trim(),
                          attachmentPath: reportAttachmentPaths.length ? reportAttachmentPaths.join('|') : undefined,
                        });
                        const timeoutMs = 30000;
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Gửi báo cáo quá thời gian. Kiểm tra mạng hoặc thử lại.')), timeoutMs));
                        Promise.race([submitPromise, timeoutPromise])
                          .then(() => {
                            setReportResult('');
                            setReportAttachmentPaths([]);
                            setReportChoice(null);
                          })
                          .catch((err) => {
                            setReportError(err?.message || 'Gửi báo cáo thất bại.');
                          })
                          .finally(() => {
                            setReportSubmitting(false);
                          });
                      }}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ngày báo cáo</label>
                        <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kết quả / Tiến độ (tối thiểu 10 ký tự)</label>
                        <textarea value={reportResult} onChange={(e) => { setReportResult(e.target.value); setReportError(''); }} minLength={10} maxLength={4000} rows={3} placeholder="Mô tả tiến độ: đang ở bước nào, đã làm được gì trong ngày..." required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">File đính kèm (tùy chọn, nhiều file)</label>
                        <input type="file" id="report-day-file" className="hidden" multiple onChange={async (e) => {
                          const files = e.target.files;
                          if (!files?.length) return;
                          setReportError('');
                          setReportFileUploading(true);
                          const newPaths = [];
                          for (let i = 0; i < files.length; i++) {
                            try {
                              const path = await uploadFile(files[i]);
                              if (path) newPaths.push(path);
                            } catch {
                              setReportError('Một hoặc nhiều file tải lên thất bại.');
                            }
                          }
                          setReportAttachmentPaths((prev) => [...prev, ...newPaths]);
                          setReportFileUploading(false);
                          e.target.value = '';
                        }} />
                        <label htmlFor="report-day-file" className={`flex items-center justify-center w-full py-2 border border-slate-200 border-dashed rounded-lg text-sm font-medium cursor-pointer ${reportFileUploading ? 'opacity-60 pointer-events-none bg-slate-50' : 'hover:border-[#D4384E]/50 hover:bg-slate-50 text-slate-500'}`}>
                          {reportFileUploading ? 'Đang tải file...' : reportAttachmentPaths.length ? `Đã chọn ${reportAttachmentPaths.length} file ✓` : 'Chọn file tải lên (có thể chọn nhiều)'}
                        </label>
                        {reportAttachmentPaths.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {reportAttachmentPaths.map((p, i) => (
                              <li key={i} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded px-2 py-1">
                                <span className="truncate flex-1">{p.replace(/^.*[/\\]/, '')}</span>
                                <button type="button" onClick={() => setReportAttachmentPaths((prev) => prev.filter((_, j) => j !== i))} className="text-red-500 hover:underline ml-2 shrink-0">Xóa</button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {reportError && <p className="text-red-600 text-sm">{reportError}</p>}
                      <button type="submit" disabled={reportSubmitting} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                        {reportSubmitting ? 'Đang gửi...' : 'Gửi báo cáo'}
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <p className="mb-2">
                      <button type="button" onClick={() => { setReportChoice(null); setCompletionError(''); }} className="text-sm text-slate-500 hover:underline">← Chọn lại</button>
                    </p>
                    <p className="text-slate-500 text-sm mb-3">Ghi chú, link hoặc file đính kèm (tùy chọn). Khi bấm Hoàn thành, nhiệm vụ chuyển sang Đợi duyệt; người phân công (Leader) duyệt hoặc trả về tồn đọng.</p>
                    <div className="space-y-3">
                      {completionError && (
                        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{completionError}</p>
                      )}
                      <textarea value={completionNote} onChange={(e) => { setCompletionNote(e.target.value); setCompletionError(''); }} placeholder="Ghi chú (tùy chọn)..." rows={2} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                      <input type="url" value={completionLink} onChange={(e) => setCompletionLink(e.target.value)} placeholder="Link (URL) nếu có..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">File đính kèm</label>
                        <input type="file" id="completion-file" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setCompletionFileUploading(true);
                          setCompletionError('');
                          uploadFile(file).then((path) => setCompletionFilePath(path)).catch(() => setCompletionError('Tải file lên thất bại. Kiểm tra kết nối.')).finally(() => { setCompletionFileUploading(false); e.target.value = ''; });
                        }} />
                        <label htmlFor="completion-file" className={`flex items-center justify-center w-full py-2 border border-slate-200 border-dashed rounded-lg text-sm font-medium cursor-pointer transition-all ${completionFileUploading ? 'opacity-60 pointer-events-none bg-slate-50' : 'hover:border-[#D4384E]/50 hover:bg-slate-50 text-slate-500'}`}>
                          {completionFileUploading ? 'Đang tải file...' : completionFilePath ? `Đã chọn file ✓ (${completionFilePath})` : 'Chọn file tải lên'}
                        </label>
                      </div>
                      {onComplete && (
                        <button
                          type="button"
                          disabled={completionSubmitting}
                          onClick={() => {
                            setCompletionError('');
                            setCompletionSubmitting(true);
                            onComplete({
                              completionNote: completionNote.trim() || null,
                              completionLink: completionLink.trim() || null,
                              completionFilePath: completionFilePath.trim() || null,
                            })
                              .then(() => { setCompletionSubmitting(false); })
                              .catch((err) => {
                                setCompletionError(err?.message || 'Không gửi được. Kiểm tra kết nối hoặc quyền.');
                                setCompletionSubmitting(false);
                              });
                          }}
                          className="text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90"
                          style={{ backgroundColor: VIETTEL_RED }}
                        >
                          {completionSubmitting ? 'Đang gửi...' : 'Hoàn thành (gửi đợi duyệt)'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Lịch sử báo cáo</h4>
                {reportHistory.length === 0 ? (
                  <p className="text-slate-400 text-sm">Chưa có báo cáo nào.</p>
                ) : (
                  <ul className="space-y-2">
                    {reportHistory.map((r, i) => (
                      <li key={i} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                        <span className="text-slate-600">{r.date}</span>
                        <span className="text-slate-700 flex-1 ml-3 truncate">{r.result}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {task.status === 'pending_approval' && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-bold text-amber-800">Đang đợi người phân công duyệt</p>
                <p className="text-amber-700 text-sm mt-1">Báo cáo hoàn thành đã gửi. Leader (người phân công) duyệt để đánh dấu hoàn thành (có thể đánh giá chất lượng) hoặc trả về công việc tồn đọng.</p>
              </div>
              {(task.completionNote || task.completionLink) && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nội dung báo cáo hoàn thành</h4>
                  {task.completionNote && <p className="text-slate-700 text-sm whitespace-pre-wrap mb-2">{task.completionNote}</p>}
                  {task.completionLink && (
                    <p className="text-sm">
                      <a href={task.completionLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{task.completionLink}</a>
                    </p>
                  )}
                </div>
              )}
              {(role === 'leader' || role === 'admin') && onApprove && onReject && (String(currentUserId) === String(task.leaderId) || String(currentUserId) === String(task.assignerId) || role === 'admin') && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Chất lượng (0–1)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={approveQuality}
                        onChange={(e) => setApproveQuality(e.target.value)}
                        placeholder="0.9"
                        className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={approveSubmitting}
                      onClick={() => {
                        setApproveSubmitting(true);
                        const q = approveQuality !== '' ? Number(approveQuality) : undefined;
                        onApprove(q).catch(() => {}).finally(() => setApproveSubmitting(false));
                      }}
                      className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {approveSubmitting ? 'Đang duyệt...' : 'Duyệt hoàn thành'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Lý do trả về (không bắt buộc)
                      </label>
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Ghi lý do nếu cần..."
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={approveSubmitting}
                      onClick={() => {
                        setApproveSubmitting(true);
                        const reason = rejectReason.trim() || null;
                        onReject(reason).catch(() => {}).finally(() => setApproveSubmitting(false));
                      }}
                      className="bg-slate-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-600 disabled:opacity-50"
                    >
                      Trả về tồn đọng
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(task.status === 'completed') && (
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 mb-2">Lịch sử báo cáo</h4>
              {reportHistory.length === 0 ? (
                <p className="text-slate-400 text-sm">Chưa có báo cáo nào.</p>
              ) : (
                <ul className="space-y-2">
                  {reportHistory.map((r, i) => (
                    <li key={i} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                      <span className="text-slate-600">{r.date}</span>
                      <span className="text-slate-700 flex-1 ml-3 truncate">{r.result}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {task.status === 'paused' && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-slate-500 text-sm mb-2">Công việc đang tạm dừng. Quản lý có thể tra cứu lịch sử báo cáo bên dưới.</p>
              <h4 className="text-sm font-bold text-slate-800 mb-2">Lịch sử báo cáo</h4>
              {reportHistory.length === 0 ? (
                <p className="text-slate-400 text-sm">Chưa có báo cáo nào.</p>
              ) : (
                <ul className="space-y-2">
                  {reportHistory.map((r, i) => (
                    <li key={i} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                      <span className="text-slate-600">{r.date}</span>
                      <span className="text-slate-700 flex-1 ml-3 truncate">{r.result}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {canEdit && onSaveEdit && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              {!editOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle(task.title || '');
                    setEditContent(task.content || '');
                    setEditObjective(task.objective || '');
                    setEditDeadline(toDatetimeLocal(task.deadline));
                    setEditWeight(task.weight != null ? String(task.weight) : '0.5');
                    setEditStatus((task.status || 'NEW').toUpperCase());
                    setEditQuality(task.quality != null ? String(task.quality) : '');
                    setEditError('');
                    setEditOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Chỉnh sửa nội dung, thời hạn, trọng số
                </button>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-bold text-slate-800">Chỉnh sửa công việc (Admin/Leader)</h4>
                  {editError && <p className="text-red-600 text-sm">{editError}</p>}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tiêu đề</label>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nội dung công việc</label>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mục tiêu</label>
                    <input value={editObjective} onChange={(e) => setEditObjective(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Thời hạn</label>
                    <input type="datetime-local" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trọng số</label>
                      <select
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        {WEIGHT_LEVELS.map((lvl) => (
                          <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trạng thái</label>
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <option value="NEW">Mới</option>
                        <option value="ACCEPTED">Đang thực hiện</option>
                        <option value="PENDING_APPROVAL">Đợi duyệt</option>
                        <option value="COMPLETED">Hoàn thành</option>
                        <option value="PAUSED">Tạm dừng</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Chất lượng (0–1, tùy chọn)</label>
                    <input type="number" step="0.01" min="0" max="1" value={editQuality} onChange={(e) => setEditQuality(e.target.value)} placeholder="Để trống nếu chưa đánh giá" className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={editSaving}
                      onClick={() => {
                        setEditError('');
                        setEditSaving(true);
                        const payload = {
                          title: editTitle.trim() || undefined,
                          content: editContent.trim() || undefined,
                          objective: editObjective.trim() || undefined,
                          deadline: editDeadline ? `${editDeadline}:00` : undefined,
                          weight: editWeight !== '' ? Number(editWeight) : undefined,
                          status: editStatus || undefined,
                          quality: editQuality !== '' ? Number(editQuality) : undefined,
                        };
                        onSaveEdit(payload)
                          .then(() => setEditOpen(false))
                          .catch((err) => { setEditError(err?.message || 'Lỗi lưu.'); })
                          .finally(() => setEditSaving(false));
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ backgroundColor: VIETTEL_RED }}
                    >
                      {editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                    <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-100">
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** Tab Giao việc mới: form giao việc cho Admin/Leader (hiển thị trong tab, không dùng modal) */
const AssignTaskForm = ({ currentUser, role, users, onCreated }) => {
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [content, setContent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [weight, setWeight] = useState(String(WEIGHT_LEVELS[2].value));
  const [leaderId, setLeaderId] = useState(currentUser?.id ? String(currentUser.id) : '');
  const [assigneeId, setAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const teamLabel = (team) => (team === 'old_product' ? 'Sản phẩm cũ' : team === 'new_product' ? 'Sản phẩm mới' : '—');
  const isAdmin = role === 'admin';

  const leaderOptions = useMemo(
    () => (users || []).filter((u) => String(u.role || '').toLowerCase() === 'leader'),
    [users],
  );

  const assigneeOptions = useMemo(
    () => (users || []).filter((u) => String(u.role || '').toLowerCase() !== 'admin'),
    [users],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Tiêu đề không được để trống.');
      return;
    }
    if (!deadline) {
      setError('Vui lòng chọn hạn chót.');
      return;
    }
    const chosenLeaderId = isAdmin ? leaderId : String(currentUser.id);
    if (!chosenLeaderId) {
      setError('Vui lòng chọn trưởng nhóm.');
      return;
    }
    if (!assigneeId) {
      setError('Vui lòng chọn người thực hiện.');
      return;
    }
    try {
      setSaving(true);
      const newTask = await createTask(
        {
          title,
          objective,
          content,
          deadline: deadline || null,
          weight: weight || WEIGHT_LEVELS[2].value,
          leaderId: Number(chosenLeaderId),
          assigneeId: Number(assigneeId),
        },
        currentUser.id,
      );
      onCreated(newTask);
      setTitle('');
      setObjective('');
      setContent('');
      setDeadline('');
      setWeight(String(WEIGHT_LEVELS[2].value));
      setAssigneeId('');
      if (isAdmin) setLeaderId(currentUser?.id ? String(currentUser.id) : '');
    } catch (err) {
      setError(err?.message || 'Không tạo được nhiệm vụ.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-slate-900">Giao việc mới</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          {isAdmin ? 'Chọn trưởng nhóm và người thực hiện, điền thông tin nhiệm vụ.' : 'Giao nhiệm vụ cho thành viên trong nhóm của bạn.'}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Tiêu đề nhiệm vụ <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/20 outline-none"
            placeholder="Ví dụ: Rà soát khách hàng ngành dược"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mục tiêu</label>
          <textarea
            rows={2}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/20 outline-none"
            placeholder="Mục tiêu chính của nhiệm vụ..."
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nội dung chi tiết</label>
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/20 outline-none"
            placeholder="Mô tả cụ thể các bước, yêu cầu báo cáo..."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Hạn chót <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trọng số</label>
            <select
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/20 outline-none bg-white"
            >
              {WEIGHT_LEVELS.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isAdmin && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trưởng nhóm (Leader)</label>
              <select
                value={leaderId}
                onChange={(e) => setLeaderId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/20 outline-none bg-white"
              >
                <option value="">-- Chọn leader --</option>
                {leaderOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Người thực hiện <span className="text-red-500">*</span>
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#D4384E]/20 outline-none bg-white"
            >
              <option value="">-- Chọn nhân sự --</option>
              {assigneeOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({teamLabel(u.team)})
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 hover:opacity-90"
            style={{ backgroundColor: VIETTEL_RED }}
          >
            {saving ? 'Đang lưu...' : 'Giao việc'}
          </button>
        </div>
      </form>
    </section>
  );
};

const SidebarLink = ({ icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
      active ? 'text-white' : 'text-slate-600 hover:bg-slate-100'
    }`}
    style={active ? { backgroundColor: VIETTEL_RED } : undefined}
  >
    {icon}
    <span className="text-sm font-medium">{label}</span>
  </button>
);

/** Thẻ trong danh sách – chỉ click để mở chi tiết, không có nút Tiếp nhận */
const TaskListCard = ({ task, users, onClick }) => {
  const isOverdue = task.deadline && new Date(String(task.deadline).replace(' ', 'T')) < new Date() && task.status !== 'completed' && task.status !== 'paused';
  const statusLabel =
    task.status === 'completed' ? 'Hoàn thành' : task.status === 'pending_approval' ? 'Đợi duyệt' : task.status === 'accepted' ? 'Đang thực hiện' : task.status === 'paused' ? 'Tạm dừng' : 'Mới';
  const statusClass =
    task.status === 'completed' ? 'bg-slate-100 text-slate-600' : task.status === 'pending_approval' ? 'bg-amber-50 text-amber-600' : task.status === 'accepted' ? 'bg-green-50 text-green-600' : task.status === 'paused' ? 'bg-violet-50 text-violet-600' : 'bg-orange-50 text-orange-600';
  // Chủ trì = người phụ trách việc (người được giao), không phải trưởng nhóm
  const displayChuTriName = task.assigneeName
    || (users && users.find((u) => String(u.id ?? u.userId) === String(task.assigneeId))?.name)
    || null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-white border border-slate-200 p-6 rounded-2xl hover:border-[#D4384E]/30 hover:shadow-lg transition-all text-left relative overflow-hidden group"
    >
      {task.status === 'new' && <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500" />}
      {task.status === 'paused' && <div className="absolute top-0 left-0 w-1.5 h-full bg-violet-500" />}
      {task.status === 'pending_approval' && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />}
      {isOverdue && task.status === 'accepted' && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h4 className="font-bold text-slate-900 group-hover:text-[#D4384E] transition-colors">{task.title}</h4>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${statusClass}`}>{statusLabel}</span>
      </div>
      <p className="text-slate-500 text-sm line-clamp-2">{task.objective}</p>
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-100">
        <TaskMetric label="Chủ trì" value={displayChuTriName} icon={<Users size={14} />} />
        <TaskMetric label="Hạn chót" value={task.deadline} icon={<Clock size={14} />} />
        <TaskMetric label="Trọng số" value={weightLabel(task.weight)} icon={<TrendingUp size={14} />} color="blue" />
        <span className="text-slate-400 text-xs ml-auto">Xem chi tiết →</span>
      </div>
    </button>
  );
};

const TaskMetric = ({ label, value, icon, color = 'slate' }) => {
  const colorMap = {
    slate: 'text-slate-400',
    blue: 'text-[#D4384E]',
    orange: 'text-orange-500',
  };

  const formatValue = () => {
    if (value === null || value === undefined || value === '') return '—';
    // Định dạng riêng cho Hạn chót: dd/MM/yyyy HH:mm
    if (label === 'Hạn chót') {
      let dateObj;
      if (value instanceof Date) {
        dateObj = value;
      } else {
        // Chuỗi kiểu '2026-05-30 17:00' → thay ' ' bằng 'T' cho chuẩn ISO
        dateObj = new Date(String(value).replace(' ', 'T'));
      }
      if (Number.isNaN(dateObj.getTime())) return String(value);
      const datePart = dateObj.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const timePart = dateObj.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${datePart} ${timePart}`;
    }
    return value;
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`${colorMap[color]} bg-slate-50 p-1.5 rounded-lg`}>{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</span>
        <span className="text-xs font-bold text-slate-700 leading-none truncate">{formatValue()}</span>
      </div>
    </div>
  );
};

export default App;
