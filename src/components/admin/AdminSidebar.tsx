import { BarChart3, Calendar, Settings, TrendingUp, LogOut, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import type { AdminView } from "@/pages/AdminDashboard";

interface AdminSidebarProps {
  currentView: AdminView;
  onViewChange: (view: AdminView) => void;
}

const menuItems = [
  { title: "Dashboard", icon: BarChart3, value: "overview" as AdminView },
  { title: "Appointments", icon: Calendar, value: "appointments" as AdminView },
  { title: "Analytics", icon: TrendingUp, value: "analytics" as AdminView },
  { title: "Settings", icon: Settings, value: "settings" as AdminView },
];

export function AdminSidebar({ currentView, onViewChange }: AdminSidebarProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({ title: "Signed out successfully" });
      navigate("/");
    } catch {
      toast({ variant: "destructive", title: "Failed to sign out." });
    }
  };

  return (
    <Sidebar className="border-r border-border/40 bg-[hsl(var(--sidebar-background))]">
      {/* Header */}
      <SidebarHeader className="px-5 py-5 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">Admin Panel</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Appointment Bot</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-3">
        <SidebarGroup>
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-2 mb-2 font-ui">
            Navigation
          </p>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {menuItems.map((item) => {
                const isActive = currentView === item.value;
                return (
                  <SidebarMenuItem key={item.value}>
                    <button
                      id={`sidebar-${item.value}-btn`}
                      onClick={() => onViewChange(item.value)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                        ${isActive
                          ? "bg-primary/15 text-primary border border-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
                        }
                      `}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {item.title}
                    </button>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 border-t border-border/30">
        <button
          id="admin-signout-btn"
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-all duration-150"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}