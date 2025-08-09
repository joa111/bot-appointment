import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { Calendar, Clock, TrendingUp, Users } from "lucide-react";

interface AnalyticsData {
  weeklyData: Array<{ date: string; appointments: number; morning: number; afternoon: number }>;
  monthlyData: Array<{ month: string; appointments: number }>;
  timeSlotData: Array<{ slot: string; count: number; percentage: number }>;
  peakHoursData: Array<{ hour: string; count: number }>;
  statusData: Array<{ status: string; count: number; color: string }>;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#8884d8', '#82ca9d'];

export function AnalyticsSection() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    weeklyData: [],
    monthlyData: [],
    timeSlotData: [],
    peakHoursData: [],
    statusData: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("weekly");

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*');

      if (!appointments) return;

      // Weekly data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const weeklyData = last7Days.map(date => {
        const dayAppointments = appointments.filter(apt => apt.appointment_date === date);
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          appointments: dayAppointments.length,
          morning: dayAppointments.filter(apt => apt.time_slot === 'Morning').length,
          afternoon: dayAppointments.filter(apt => apt.time_slot === 'Afternoon').length,
        };
      });

      // Monthly data (last 6 months)
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        return {
          year: date.getFullYear(),
          month: date.getMonth(),
          label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        };
      }).reverse();

      const monthlyData = last6Months.map(({ year, month, label }) => {
        const monthAppointments = appointments.filter(apt => {
          const aptDate = new Date(apt.appointment_date);
          return aptDate.getFullYear() === year && aptDate.getMonth() === month;
        });
        return {
          month: label,
          appointments: monthAppointments.length,
        };
      });

      // Time slot analysis
      const morningCount = appointments.filter(apt => apt.time_slot === 'Morning').length;
      const afternoonCount = appointments.filter(apt => apt.time_slot === 'Afternoon').length;
      const total = morningCount + afternoonCount;

      const timeSlotData = [
        {
          slot: 'Morning',
          count: morningCount,
          percentage: total > 0 ? Math.round((morningCount / total) * 100) : 0,
        },
        {
          slot: 'Afternoon',
          count: afternoonCount,
          percentage: total > 0 ? Math.round((afternoonCount / total) * 100) : 0,
        },
      ];

      // Peak hours (simulated data based on creation time)
      const peakHoursData = Array.from({ length: 24 }, (_, hour) => {
        const hourAppointments = appointments.filter(apt => {
          const createdHour = new Date(apt.created_at).getHours();
          return createdHour === hour;
        }).length;
        
        return {
          hour: `${hour.toString().padStart(2, '0')}:00`,
          count: hourAppointments,
        };
      }).filter(item => item.count > 0);

      // Status distribution
      const statusCounts = appointments.reduce((acc, apt) => {
        acc[apt.status] = (acc[apt.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusData = Object.entries(statusCounts).map(([status, count], index) => ({
        status,
        count,
        color: COLORS[index % COLORS.length],
      }));

      setAnalytics({
        weeklyData,
        monthlyData,
        timeSlotData,
        peakHoursData,
        statusData,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalAppointments = analytics.statusData.reduce((sum, item) => sum + item.count, 0);
  const completionRate = analytics.statusData.find(item => item.status === 'Completed')?.count || 0;
  const completionPercentage = totalAppointments > 0 ? Math.round((completionRate / totalAppointments) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse"></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          Data insights and trends
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAppointments}</div>
            <p className="text-xs text-muted-foreground">All time appointments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completionPercentage}%</div>
            <p className="text-xs text-muted-foreground">Successful appointments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Popular</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.timeSlotData.find(slot => slot.count === Math.max(...analytics.timeSlotData.map(s => s.count)))?.slot || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Preferred time slot</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Daily</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.weeklyData.length > 0 
                ? Math.round(analytics.weeklyData.reduce((sum, day) => sum + day.appointments, 0) / analytics.weeklyData.length)
                : 0
              }
            </div>
            <p className="text-xs text-muted-foreground">Appointments per day</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="weekly">Weekly Trends</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Reports</TabsTrigger>
          <TabsTrigger value="timeslots">Time Slots</TabsTrigger>
          <TabsTrigger value="status">Status Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Booking Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="morning" fill="hsl(var(--primary))" name="Morning" />
                    <Bar dataKey="afternoon" fill="hsl(var(--secondary))" name="Afternoon" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Booking Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="appointments" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeslots" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Time Slot Popularity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.timeSlotData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ slot, percentage }) => `${slot} (${percentage}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {analytics.timeSlotData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak Booking Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.peakHoursData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appointment Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.statusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}