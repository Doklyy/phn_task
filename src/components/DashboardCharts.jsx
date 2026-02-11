import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const STATUS_COLORS = { new: '#3b82f6', in_progress: '#eab308', overdue: '#ef4444' };

export function DashboardCharts({ tasks }) {
  const byStatus = [
    { name: 'Mới', value: tasks.filter((t) => t.status === 'new').length, fill: STATUS_COLORS.new },
    { name: 'Đang làm', value: tasks.filter((t) => t.status === 'in_progress').length, fill: STATUS_COLORS.in_progress },
    { name: 'Quá hạn', value: tasks.filter((t) => t.status === 'overdue').length, fill: STATUS_COLORS.overdue },
  ].filter((d) => d.value > 0);

  const barData = [
    { name: 'Mới', count: tasks.filter((t) => t.status === 'new').length },
    { name: 'Đang làm', count: tasks.filter((t) => t.status === 'in_progress').length },
    { name: 'Quá hạn', count: tasks.filter((t) => t.status === 'overdue').length },
  ];

  return (
    <div className="dashboard-charts">
      <div className="chart-box">
        <h3>Thống kê theo trạng thái</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" name="Số lượng" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-box">
        <h3>Phân bố nhiệm vụ</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={byStatus.length ? byStatus : [{ name: 'Chưa có', value: 1, fill: '#94a3b8' }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {byStatus.length ? byStatus.map((entry, i) => <Cell key={i} fill={entry.fill} />) : <Cell fill="#94a3b8" />}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
