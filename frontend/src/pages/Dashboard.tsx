import { useGetDashboardStats, useGetRecentActivity, useListProjects } from '@/services/api';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Folder,
  FileText,
  CheckCircle2,
  Activity,
  Clock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'wouter';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: projects, isLoading: projectsLoading } = useListProjects();

  const chartData = [
    { name: 'Mon', processed: 4 },
    { name: 'Tue', processed: 7 },
    { name: 'Wed', processed: 12 },
    { name: 'Thu', processed: 25 },
    { name: 'Fri', processed: 18 },
    { name: 'Sat', processed: 5 },
    { name: 'Sun', processed: 8 },
  ];

  const statCards = [
    {
      title: 'Total Projects',
      value: stats?.totalProjects ?? 0,
      icon: Folder,
      trend: '+2 this week',
      color: 'text-foreground',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-primary',
    },
    {
      title: 'Surveys Uploaded',
      value: stats?.totalSurveys ?? 0,
      icon: FileText,
      trend: '14 pending',
      color: 'text-foreground',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      title: 'Successfully Processed',
      value: stats?.processedSurveys ?? 0,
      icon: CheckCircle2,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Active Processes',
      value: stats?.activeProcessing ?? 0,
      icon: Activity,
      color: 'text-primary',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      pulse: stats?.activeProcessing ? stats.activeProcessing > 0 : false,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="text-muted-foreground">
            Monitor your automated survey processing operations.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, idx) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <StatCard {...card} isLoading={statsLoading} />
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart Area */}
          <div className="lg:col-span-2 bg-card rounded-2xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  Processing Throughput
                </h3>
              </div>
              <select className="bg-secondary border-none text-sm rounded-lg px-3 py-1 outline-none text-muted-foreground font-medium">
                <option>Last 7 days</option>
                <option>Last 30 days</option>
              </select>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      background: 'var(--color-card)',
                      color: 'var(--color-foreground)',
                    }}
                  />
                  <Bar
                    dataKey="processed"
                    fill="var(--color-primary)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Recent Activity
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              {activityLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-2 h-2 rounded-full bg-muted mt-2 shrink-0" />
                    <div className="space-y-2 w-full">
                      <div className="h-4 bg-muted rounded w-full animate-pulse" />
                      <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))
              ) : activity?.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  No recent activity
                </div>
              ) : (
                activity?.map((item) => (
                  <div key={item.id} className="flex gap-4 group">
                    <div className="relative flex flex-col items-center">
                      <div
                        className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-sm z-10 ${
                          item.type === 'error'
                            ? 'bg-red-500'
                            : item.type === 'process'
                              ? 'bg-green-500'
                              : 'bg-primary'
                        }`}
                      />
                      <div className="w-[1px] h-full bg-border absolute top-4 group-last:hidden" />
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-medium text-foreground">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {item.projectName}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.createdAt), 'MMM d, HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Project Status Table */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Folder className="w-5 h-5 text-muted-foreground" />
              Project Status
            </h3>
            <Link
              href="/projects"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Project</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Files</th>
                  <th className="px-6 py-3 font-medium">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {projectsLoading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-gray-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : projects?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      No projects yet
                    </td>
                  </tr>
                ) : (
                  projects?.slice(0, 5).map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <Link
                          href={`/projects/${p.id}/knowledge`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-6 py-3">
                        <ProjectStatusBadge status={p.status || 'active'} />
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {p.fileCount ?? 0} files
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {p.updatedAt
                          ? format(new Date(p.updatedAt), 'MMM d, HH:mm')
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  isLoading,
  color = 'text-foreground',
  bg,
  iconColor,
  trend,
  pulse,
}: any) {
  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div
          className={`p-2 rounded-xl transition-colors ${bg || 'bg-secondary'} ${iconColor || color}`}
        >
          <Icon className={`w-5 h-5 ${pulse ? 'animate-pulse' : ''}`} />
        </div>
      </div>
      {isLoading ? (
        <div className="h-8 bg-muted rounded w-16 animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-3">
          <span className={`text-3xl font-bold tracking-tight ${color}`}>
            {value}
          </span>
          {trend && (
            <span className="text-xs font-medium text-muted-foreground">
              {trend}
            </span>
          )}
        </div>
      )}

      {/* Decorative gradient blob */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

function ProjectStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
    processing: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    completed: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
    draft: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${styles[status] || styles.active}`}
    >
      {status}
    </span>
  );
}
