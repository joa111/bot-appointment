import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle, XCircle, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useRealtimeAppointments } from "@/hooks/useRealtimeAppointments";
import { useRealtimeQueueCounters } from "@/hooks/useRealtimeQueueCounters";

interface DashboardStats {
  totalToday: number;
  morningToday: number;
  afternoonToday: number;
  pending: number;
  completed: number;
  cancelled: number;
}

interface TrendData {
  date: string;
  appointments: number;
}

export function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalToday: 0,
    morningToday: 0,
    afternoonToday: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
  });
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const { appointments } = useRealtimeAppointments();
  const { todayCounter } = useRealtimeQueueCounters();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Update stats when appointments change (real-time)
  useEffect(() => {
    if (appointments.length > 0) {
      updateStatsFromAppointments();
    }
  }, [appointments]);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch today's appointments
      const { data: todayAppointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_date', today);

      // Fetch all appointments for status counts
      const { data: allAppointments } = await supabase
        .from('appointments')
        .select('*');

      // Fetch last 7 days trend
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const trendPromises = last7Days.map(async (date) => {
        const { data, count } = await supabase
          .from('appointments')
          .select('*', { count: 'exact' })
          .eq('appointment_date', date);
        
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          appointments: count || 0,
        };
      });

      const trendResults = await Promise.all(trendPromises);

      // Calculate stats
      const todayStats = {
        totalToday: todayAppointments?.length || 0,
        morningToday: todayAppointments?.filter(apt => apt.time_slot === 'Morning').length || 0,
        afternoonToday: todayAppointments?.filter(apt => apt.time_slot === 'Afternoon').length || 0,
        pending: allAppointments?.filter(apt => apt.status === 'Pending').length || 0,
        completed: allAppointments?.filter(apt => apt.status === 'Completed').length || 0,
        cancelled: allAppointments?.filter(apt => apt.status === 'Cancelled').length || 0,
      };

      setStats(todayStats);
      setTrendData(trendResults);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatsFromAppointments = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = appointments.filter(apt => apt.appointment_date === today);
    
    const todayStats = {
      totalToday: todayAppointments.length,
      morningToday: todayAppointments.filter(apt => apt.time_slot === 'Morning').length,
      afternoonToday: todayAppointments.filter(apt => apt.time_slot === 'Afternoon').length,
      pending: appointments.filter(apt => apt.status === 'Pending').length,
      completed: appointments.filter(apt => apt.status === 'Completed').length,
      cancelled: appointments.filter(apt => apt.status === 'Cancelled').length,
    };

    setStats(todayStats);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Today's Total",
      value: stats.totalToday,
      description: "Total appointments today",
      icon: Calendar,
      color: "text-primary",
    },
    {
      title: "Morning Slots",
      value: stats.morningToday,
      description: "Morning appointments",
      icon: Clock,
      color: "text-yellow-600",
    },
    {
      title: "Afternoon Slots",
      value: stats.afternoonToday,
      description: "Afternoon appointments",
      icon: Clock,
      color: "text-orange-600",
    },
    {
      title: "Pending",
      value: stats.pending,
      description: "Awaiting confirmation",
      icon: Users,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => (
          <Card key={index} className="hover:shadow-elegant transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-elegant transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              Successfully completed
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-elegant transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cancelled
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
            <p className="text-xs text-muted-foreground">
              Cancelled appointments
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-elegant transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Queue
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending + stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              All active appointments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>7-Day Booking Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs text-muted-foreground"
                />
                <YAxis 
                  className="text-xs text-muted-foreground"
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="appointments" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}