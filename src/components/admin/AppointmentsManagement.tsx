import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Filter, Download, Eye, CheckCircle, XCircle, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Appointment {
  id: string;
  full_name: string;
  appointment_date: string;
  time_slot: string;
  queue_number: number;
  status: string;
  booking_reference?: string;
  created_at: string;
  updated_at: string;
}

export function AppointmentsManagement() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeSlotFilter, setTimeSlotFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Filter appointments when search/filter criteria change
  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    filterAppointments();
  }, [appointments, searchTerm, statusFilter, timeSlotFilter, dateFilter]);

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Ensure booking_reference exists, set empty string if null
      const appointmentsWithRef = (data || []).map((apt: any) => ({
        ...apt,
        booking_reference: apt.booking_reference || ''
      }));
      setAppointments(appointmentsWithRef);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch appointments.",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAppointments = () => {
    let filtered = appointments;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(apt =>
        apt.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (apt.booking_reference?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(apt => apt.status.toLowerCase() === statusFilter);
    }

    // Time slot filter
    if (timeSlotFilter !== "all") {
      filtered = filtered.filter(apt => apt.time_slot === timeSlotFilter);
    }

    // Date filter
    if (dateFilter) {
      filtered = filtered.filter(apt => apt.appointment_date === dateFilter);
    }

    setFilteredAppointments(filtered);
  };

  const updateAppointmentStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setAppointments(prev =>
        prev.map(apt =>
          apt.id === id ? { ...apt, status: newStatus } : apt
        )
      );

      toast({
        title: "Success",
        description: `Appointment ${newStatus.toLowerCase()} successfully.`,
      });
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update appointment status.",
      });
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    const selectedIds = filteredAppointments
      .filter(apt => apt.status === 'Pending')
      .map(apt => apt.id);

    if (selectedIds.length === 0) {
      toast({
        title: "No appointments",
        description: "No pending appointments to update.",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', selectedIds);

      if (error) throw error;

      await fetchAppointments();
      toast({
        title: "Success",
        description: `${selectedIds.length} appointments updated to ${status.toLowerCase()}.`,
      });
    } catch (error) {
      console.error('Error in bulk update:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update appointments.",
      });
    }
  };

  const exportToCsv = () => {
    const csvContent = [
      "Name,Date,Time Slot,Queue Number,Status,Booking Reference,Created At",
      ...filteredAppointments.map(apt =>
        `"${apt.full_name}","${apt.appointment_date}","${apt.time_slot}",${apt.queue_number},"${apt.status}","${apt.booking_reference}","${format(new Date(apt.created_at), 'yyyy-MM-dd HH:mm')}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse"></div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Appointments Management</h1>
        <div className="flex gap-2">
          <Button onClick={exportToCsv} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={timeSlotFilter} onValueChange={setTimeSlotFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Time Slot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Slots</SelectItem>
                <SelectItem value="Morning">Morning</SelectItem>
                <SelectItem value="Afternoon">Afternoon</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="Filter by date"
            />

            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={() => bulkUpdateStatus('Completed')}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Complete All
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => bulkUpdateStatus('Cancelled')}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Appointments ({filteredAppointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time Slot</TableHead>
                <TableHead>Queue #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell className="font-medium">
                    {appointment.full_name}
                  </TableCell>
                  <TableCell>
                    {format(new Date(appointment.appointment_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {appointment.time_slot === 'Morning' ? '🌅 Morning' : '🌇 Afternoon'}
                    </Badge>
                  </TableCell>
                  <TableCell>{appointment.queue_number}</TableCell>
                  <TableCell>
                    {getStatusBadge(appointment.status)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {appointment.booking_reference}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedAppointment(appointment)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Appointment Details</DialogTitle>
                          </DialogHeader>
                          {selectedAppointment && (
                            <div className="space-y-4">
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Full Name</label>
                                <p className="text-sm">{selectedAppointment.full_name}</p>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Appointment Date</label>
                                <p className="text-sm">{format(new Date(selectedAppointment.appointment_date), 'MMMM dd, yyyy')}</p>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Time Slot</label>
                                <p className="text-sm">{selectedAppointment.time_slot}</p>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Queue Number</label>
                                <p className="text-sm">{selectedAppointment.queue_number}</p>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Status</label>
                                {getStatusBadge(selectedAppointment.status)}
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Booking Reference</label>
                                <p className="text-sm font-mono">{selectedAppointment.booking_reference}</p>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Created At</label>
                                <p className="text-sm">{format(new Date(selectedAppointment.created_at), 'MMM dd, yyyy HH:mm')}</p>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      {appointment.status === 'Pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => updateAppointmentStatus(appointment.id, 'Completed')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateAppointmentStatus(appointment.id, 'Cancelled')}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredAppointments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No appointments found matching your filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}