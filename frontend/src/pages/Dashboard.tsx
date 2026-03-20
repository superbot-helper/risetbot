import { useGetDashboardStats, useGetRecentActivity } from '@/services/api';
import { AppLayout } from "@/components/layout/AppLayout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Folder, FileText, CheckCircle2, Activity, Clock } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();

  // Mock chart data since API doesn't provide historical data yet
  const chartData = [
    { name: "Mon", processed: 4 },
    { name: "Tue", processed: 7 },
    { name: "Wed", processed: 12 },
    { name: "Thu", processed: 25 },
    { name: "Fri", processed: 18 },
    { name: "Sat", processed: 5 },
    { name: "Sun", processed: 8 },
  ];

  return (
    <AppLayout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground">Monitor your automated survey processing operations.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Projects" 
            value={stats?.totalProjects ?? 0} 
            icon={Folder} 
            isLoading={statsLoading}
            trend="+2 this week"
          />
          <StatCard 
            title="Surveys Uploaded" 
            value={stats?.totalSurveys ?? 0} 
            icon={FileText} 
            isLoading={statsLoading}
            trend="14 pending"
          />
          <StatCard 
            title="Successfully Processed" 
            value={stats?.processedSurveys ?? 0} 
            icon={CheckCircle2} 
            isLoading={statsLoading}
            color="text-green-500"
          />
          <StatCard 
            title="Active Processes" 
            value={stats?.activeProcessing ?? 0} 
            icon={Activity} 
            isLoading={statsLoading}
            color="text-primary"
            pulse={stats?.activeProcessing ? stats.activeProcessing > 0 : false}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart Area */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Processing Throughput</h3>
              <select className="bg-gray-50 border-none text-sm rounded-lg px-3 py-1 outline-none text-muted-foreground font-medium">
                <option>Last 7 days</option>
                <option>Last 30 days</option>
              </select>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="processed" fill="#007AFF" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm flex flex-col">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Recent Activity
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              {activityLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-2 h-2 rounded-full bg-gray-200 mt-2 shrink-0"></div>
                    <div className="space-y-2 w-full">
                      <div className="h-4 bg-gray-100 rounded w-full animate-pulse"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse"></div>
                    </div>
                  </div>
                ))
              ) : activity?.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">No recent activity</div>
              ) : (
                activity?.map((item) => (
                  <div key={item.id} className="flex gap-4 group">
                    <div className="relative flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-sm z-10 ${
                        item.type === 'error' ? 'bg-red-500' : 
                        item.type === 'process' ? 'bg-green-500' : 
                        'bg-primary'
                      }`}></div>
                      <div className="w-[1px] h-full bg-gray-100 absolute top-4 group-last:hidden"></div>
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-medium text-foreground">{item.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{item.projectName}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="text-xs text-muted-foreground">{format(new Date(item.createdAt), 'MMM d, HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon: Icon, isLoading, color = "text-foreground", trend, pulse }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className={`p-2 bg-gray-50 rounded-xl group-hover:bg-primary/5 transition-colors ${color}`}>
          <Icon className={`w-5 h-5 ${pulse ? 'animate-pulse' : ''}`} />
        </div>
      </div>
      {isLoading ? (
        <div className="h-8 bg-gray-100 rounded w-16 animate-pulse"></div>
      ) : (
        <div className="flex items-baseline gap-3">
          <span className={`text-3xl font-bold tracking-tight ${color}`}>{value}</span>
          {trend && <span className="text-xs font-medium text-muted-foreground">{trend}</span>}
        </div>
      )}
      
      {/* Decorative gradient blob */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </div>
  );
}
