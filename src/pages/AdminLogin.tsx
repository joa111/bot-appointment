import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Shield, ArrowLeft, RefreshCw } from "lucide-react";
import { adminLoginRateLimiter } from "@/lib/security";
import { ErrorLogger } from "@/lib/errorHandler";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const logger = ErrorLogger.getInstance();

  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: isAdmin } = await supabase.rpc("is_admin");
        if (isAdmin) {
          navigate("/admin-dashboard-2025");
          return;
        }
      }
    } catch (error) {
      console.error("Auth check error:", error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter both email and password.",
      });
      return;
    }

    const rateCheck = adminLoginRateLimiter.isAllowed(email);
    if (!rateCheck.allowed) {
      toast({
        variant: "destructive",
        title: "Too Many Attempts",
        description: `Please wait ${rateCheck.timeLeft} seconds before trying again.`,
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        { email, password }
      );

      if (authError) {
        logger.log({
          code: "ADMIN_LOGIN_FAILED",
          message: `Admin login failed for ${email}: ${authError.message}`,
          severity: "medium",
          context: { email, error: authError.message },
          userMessage: "Login failed",
        });

        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid email or password.",
        });
        return;
      }

      const { data: isAdmin, error: adminError } = await supabase.rpc(
        "is_admin"
      );

      if (adminError || !isAdmin) {
        await supabase.auth.signOut();

        logger.log({
          code: "UNAUTHORIZED_ADMIN_LOGIN",
          message: `Non-admin user ${email} attempted admin login`,
          severity: "high",
          context: { email, userId: data.user?.id },
          userMessage: "Access denied",
        });

        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have admin privileges.",
        });
        return;
      }

      navigate("/admin-dashboard-2025");
    } catch (error) {
      logger.log({
        code: "ADMIN_LOGIN_ERROR",
        message: `Admin login error: ${error}`,
        severity: "high",
        context: { email, error: String(error) },
        userMessage: "Login failed due to system error",
      });

      toast({
        variant: "destructive",
        title: "System Error",
        description: "Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dot-grid flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm animate-fade-up" style={{ animationFillMode: "both" }}>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-7">
          <h1 className="text-xl font-semibold text-foreground mb-1.5">Admin access</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage appointments</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-3">
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-ui">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              disabled={loading}
              required
              className="w-full bg-surface-elevated border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-ui">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
                className="w-full bg-surface-elevated border border-border/60 rounded-xl px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            id="admin-signin-btn"
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-1 shadow-lg shadow-primary/20"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-6 space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            Need an account?{" "}
            <Link
              to="/admin-dashboard-2025/signup"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Sign up
            </Link>
          </p>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to booking
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;