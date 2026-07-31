import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  CalendarDays,
  CalendarClock,
  History,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isToday, isFuture, isPast, startOfDay } from "date-fns";

interface Appointment {
  id: string;
  full_name: string;
  phone_number?: string;
  notes?: string;
  appointment_date: string;
  time_slot: string;
  queue_number: number;
  status: string;
  booking_reference?: string;
  created_at: string;
  updated_at: string;
}

type TabKey = "today" | "future" | "past";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "today",  label: "Today",   icon: <CalendarDays  className="w-4 h-4" /> },
  { key: "future", label: "Upcoming", icon: <CalendarClock className="w-4 h-4" /> },
  { key: "past",   label: "Past",    icon: <History       className="w-4 h-4" /> },
];

function toLocalDateStr(isoDate: string) {
  // Parse YYYY-MM-DD without timezone shift
  return isoDate.split("T")[0];
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const styles: Record<string, string> = {
    pending:   "bg-amber-50 text-amber-700 border-amber-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border font-ui ${styles[lower] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

function SlotBadge({ slot }: { slot: string }) {
  const isMorning = slot === "Morning";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border font-ui ${
      isMorning ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-indigo-50 text-indigo-600 border-indigo-200"
    }`}>
      {isMorning ? "🌅" : "🌇"} {slot}
    </span>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const messages: Record<TabKey, { icon: string; text: string }> = {
    today:  { icon: "📅", text: "No appointments scheduled for today." },
    future: { icon: "🔮", text: "No upcoming appointments yet." },
    past:   { icon: "📁", text: "No past appointments found." },
  };
  const { icon, text } = messages[tab];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function AppointmentsManagement() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeSlotFilter, setTimeSlotFilter] = useState("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchAppointments(); }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("appointment_date", { ascending: true })
        .order("queue_number", { ascending: true });

      if (error) throw error;
      setAppointments(
        (data || []).map((apt: any) => ({
          ...apt,
          booking_reference: apt.booking_reference || "",
        }))
      );
    } catch {
      toast({ variant: "destructive", title: "Failed to fetch appointments." });
    } finally {
      setLoading(false);
    }
  };

  // ── Tab-split data ───────────────────────────────────────────────────────
  const todayStr = getTodayStr();

  const tabData = useMemo(() => {
    const today: Appointment[] = [];
    const future: Appointment[] = [];
    const past: Appointment[] = [];

    appointments.forEach((apt) => {
      const d = toLocalDateStr(apt.appointment_date);
      if (d === todayStr)       today.push(apt);
      else if (d > todayStr)    future.push(apt);
      else                      past.push(apt);
    });

    // Future: ascending (soonest first); Past: descending (most recent first)
    future.sort((a, b) => toLocalDateStr(a.appointment_date).localeCompare(toLocalDateStr(b.appointment_date)));
    past.sort((a, b) => toLocalDateStr(b.appointment_date).localeCompare(toLocalDateStr(a.appointment_date)));

    return { today, future, past };
  }, [appointments, todayStr]);

  const tabCounts: Record<TabKey, number> = {
    today:  tabData.today.length,
    future: tabData.future.length,
    past:   tabData.past.length,
  };

  // ── Filtered view within active tab ────────────────────────────────────
  const filteredAppointments = useMemo(() => {
    let list = tabData[activeTab];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (apt) =>
          apt.full_name.toLowerCase().includes(q) ||
          (apt.booking_reference?.toLowerCase() ?? "").includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((apt) => apt.status.toLowerCase() === statusFilter);
    }
    if (timeSlotFilter !== "all") {
      list = list.filter((apt) => apt.time_slot === timeSlotFilter);
    }

    return list;
  }, [tabData, activeTab, searchTerm, statusFilter, timeSlotFilter]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status: newStatus } : apt))
      );
      toast({ title: `Marked as ${newStatus}.` });
    } catch {
      toast({ variant: "destructive", title: "Failed to update status." });
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    const ids = filteredAppointments
      .filter((apt) => apt.status === "Pending")
      .map((apt) => apt.id);
    if (!ids.length) {
      toast({ title: "No pending appointments in current view." });
      return;
    }
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      await fetchAppointments();
      toast({ title: `${ids.length} appointments marked as ${status}.` });
    } catch {
      toast({ variant: "destructive", title: "Bulk update failed." });
    }
  };

  const exportToCsv = () => {
    const rows = [
      "Name,Phone,Date,Time Slot,Queue #,Status,Reference,Notes,Booked At",
      ...filteredAppointments.map((apt) =>
        `"${apt.full_name}","${apt.phone_number || ""}","${apt.appointment_date}","${apt.time_slot}",${apt.queue_number},"${apt.status}","${apt.booking_reference}","${(apt.notes || "").replace(/"/g, "''")}","${format(new Date(apt.created_at), "yyyy-MM-dd HH:mm")}"`
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appointments-${activeTab}-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-7 bg-muted rounded-lg w-48 animate-pulse" />
        <div className="h-12 bg-muted rounded-xl animate-pulse" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tabCounts.today} today · {tabCounts.future} upcoming
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAppointments}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-elevated border border-border/60 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={exportToCsv}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated border border-border/60 transition-colors font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 bg-surface-elevated rounded-xl p-1 border border-border/50">
        {TABS.map(({ key, label, icon }) => {
          const isActive = activeTab === key;
          const count = tabCounts[key];
          return (
            <button
              key={key}
              id={`tab-${key}-btn`}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive
                  ? "bg-surface text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {icon}
              <span>{label}</span>
              {count > 0 && (
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full font-ui ${
                  isActive ? "bg-primary/10 text-primary" : "bg-border text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            id="search-appointments-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name or reference…"
            className="w-full bg-surface border border-border/60 rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 rounded-xl border-border/60 text-sm h-[42px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* Slot filter */}
        <Select value={timeSlotFilter} onValueChange={setTimeSlotFilter}>
          <SelectTrigger className="w-full sm:w-36 rounded-xl border-border/60 text-sm h-[42px]">
            <SelectValue placeholder="Time Slot" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Slots</SelectItem>
            <SelectItem value="Morning">🌅 Morning</SelectItem>
            <SelectItem value="Afternoon">🌇 Afternoon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Bulk actions (only for today/future pending) ── */}
      {(activeTab === "today" || activeTab === "future") && filteredAppointments.some((a) => a.status === "Pending") && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200/70 rounded-xl">
          <span className="text-xs text-amber-700 flex-1 font-medium">
            {filteredAppointments.filter((a) => a.status === "Pending").length} pending in this view
          </span>
          <button
            onClick={() => bulkUpdateStatus("Completed")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Complete all
          </button>
          <button
            onClick={() => bulkUpdateStatus("Cancelled")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancel all
          </button>
        </div>
      )}

      {/* ── Appointments table ── */}
      <div className="bg-surface border border-border/50 rounded-2xl overflow-hidden">
        {filteredAppointments.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-surface-elevated">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-ui">Name</th>
                  {activeTab !== "today" && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-ui">Date</th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-ui">Slot</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-ui">Queue</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-ui">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-ui hidden md:table-cell">Reference</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-ui">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-surface-elevated/50 transition-colors group">
                    <td className="px-4 py-3.5 font-medium text-foreground whitespace-nowrap">
                      {apt.full_name}
                    </td>
                    {activeTab !== "today" && (
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                        {format(parseISO(apt.appointment_date), "EEE, MMM d")}
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <SlotBadge slot={apt.time_slot} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-foreground font-semibold">#{apt.queue_number}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={apt.status} />
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="font-mono text-xs text-muted-foreground">
                        {apt.booking_reference || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View detail */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <button
                              id={`view-apt-${apt.id}`}
                              onClick={() => setSelectedAppointment(apt)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-elevated border border-border/50 transition-colors"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-sm rounded-2xl">
                            <DialogHeader>
                              <DialogTitle className="text-base">Appointment Details</DialogTitle>
                            </DialogHeader>
                            {selectedAppointment && (
                              <div className="space-y-3 pt-1">
                                {[
                                  { label: "Full Name",   value: selectedAppointment.full_name },
                                  { label: "Phone",       value: selectedAppointment.phone_number || "—" },
                                  { label: "Date",        value: format(parseISO(selectedAppointment.appointment_date), "EEEE, MMMM d yyyy") },
                                  { label: "Time Slot",   value: selectedAppointment.time_slot },
                                  { label: "Queue",       value: `#${selectedAppointment.queue_number}` },
                                  { label: "Reference",   value: selectedAppointment.booking_reference || "—", mono: true },
                                  { label: "Booked at",   value: format(new Date(selectedAppointment.created_at), "MMM d, yyyy · HH:mm") },
                                ].map(({ label, value, mono }) => (
                                  <div key={label} className="flex justify-between items-start gap-3 py-2 border-b border-border/40 last:border-0">
                                    <span className="text-xs text-muted-foreground font-ui font-medium">{label}</span>
                                    <span className={`text-sm text-foreground text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
                                  </div>
                                ))}
                                {selectedAppointment.notes && (
                                  <div className="py-2 border-b border-border/40">
                                    <span className="text-xs text-muted-foreground font-ui font-medium block mb-1">Notes / Reason</span>
                                    <p className={`text-sm text-foreground whitespace-pre-wrap ${
                                      selectedAppointment.notes.startsWith("🚨") ? "text-red-600 font-medium" : ""
                                    }`}>{selectedAppointment.notes}</p>
                                  </div>
                                )}
                                <div className="flex justify-between items-center pt-1">
                                  <span className="text-xs text-muted-foreground font-ui font-medium">Status</span>
                                  <StatusBadge status={selectedAppointment.status} />
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>

                        {/* Quick-action buttons for pending */}
                        {apt.status === "Pending" && (
                          <>
                            <button
                              id={`complete-apt-${apt.id}`}
                              onClick={() => updateStatus(apt.id, "Completed")}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-colors"
                              title="Mark complete"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`cancel-apt-${apt.id}`}
                              onClick={() => updateStatus(apt.id, "Cancelled")}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 border border-red-200 transition-colors"
                              title="Cancel"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {filteredAppointments.length > 0 && (
          <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? "s" : ""}
            </p>
            {(searchTerm || statusFilter !== "all" || timeSlotFilter !== "all") && (
              <button
                onClick={() => { setSearchTerm(""); setStatusFilter("all"); setTimeSlotFilter("all"); }}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}