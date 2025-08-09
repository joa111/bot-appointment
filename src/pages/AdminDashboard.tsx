import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { DashboardOverview } from "@/components/admin/DashboardOverview";
import { AppointmentsManagement } from "@/components/admin/AppointmentsManagement";
import { AnalyticsSection } from "@/components/admin/AnalyticsSection";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { adminLoginRateLimiter } from "@/lib/security";
import { handleDatabaseError, ErrorLogger } from "@/lib/errorHandler";
import { useMemoryOptimization } from "@/lib/performance";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FullPageSpinner } from "@/components/ui/loading-spinner";

export type AdminView = "overview" | "appointments" | "analytics" | "settings";

const AdminDashboard = () => {
  const [currentView, setCurrentView] = useState<AdminView>("overview");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const logger = ErrorLogger.getInstance();
  
  // Enable memory optimization
  useMemoryOptimization();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/admin-dashboard-2025/login");
        return;
      }

      // Rate limiting for admin access attempts
      const rateCheck = adminLoginRateLimiter.isAllowed(user.email || 'unknown');
      if (!rateCheck.allowed) {
        toast({
          variant: "destructive",
          title: "Rate Limit Exceeded",
          description: `Too many login attempts. Try again in ${rateCheck.timeLeft} seconds.`,
        });
        navigate("/admin-dashboard-2025/login");
        return;
      }

      const { data, error } = await supabase.rpc('is_admin');
      
      if (error) {
      handleDatabaseError(error, 'admin-check');
        navigate("/admin-dashboard-2025/login");
        return;
      }

      if (!data) {
        logger.log({
          code: 'UNAUTHORIZED_ADMIN_ACCESS',
          message: `User ${user.email} attempted admin access`,
          severity: 'high',
          context: { userId: user.id, email: user.email },
          userMessage: 'Access denied',
        });
        
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have admin privileges.",
        });
        navigate("/admin-dashboard-2025/login");
        return;
      }

      setIsAdmin(true);
      
      // Set up session timeout (30 minutes of inactivity)
      const timeout = setTimeout(() => {
        toast({
          title: "Session Expired",
          description: "For security, your admin session has expired.",
        });
        navigate("/admin-dashboard-2025/login");
      }, 1800000); // 30 minutes
      
      setSessionTimeout(timeout);
      
    } catch (error) {
      handleDatabaseError(error, 'admin-authentication');
      navigate("/admin-dashboard-2025/login");
    } finally {
      setLoading(false);
    }
  };

  const renderCurrentView = () => {
    return (
      <ErrorBoundary>
        {(() => {
          switch (currentView) {
            case "overview":
              return <DashboardOverview />;
            case "appointments":
              return <AppointmentsManagement />;
            case "analytics":
              return <AnalyticsSection />;
            case "settings":
              return <SettingsPanel />;
            default:
              return <DashboardOverview />;
          }
        })()}
      </ErrorBoundary>
    );
  };

  // Cleanup session timeout on unmount
  useEffect(() => {
    return () => {
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
      }
    };
  }, [sessionTimeout]);

  if (loading) {
    return <FullPageSpinner text="Verifying admin access..." />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-subtle">
        <AdminSidebar 
          currentView={currentView} 
          onViewChange={setCurrentView} 
        />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            {renderCurrentView()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;