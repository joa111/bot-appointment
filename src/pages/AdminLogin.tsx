import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Shield } from "lucide-react";
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
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: isAdmin } = await supabase.rpc('is_admin');
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

    // Rate limiting check
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
      // First authenticate with Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        logger.log({
          code: 'ADMIN_LOGIN_FAILED',
          message: `Admin login failed for ${email}: ${authError.message}`,
          severity: 'medium',
          context: { email, error: authError.message },
          userMessage: 'Login failed',
        });

        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid email or password.",
        });
        return;
      }

      // Check if user is admin
      const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
      
      if (adminError || !isAdmin) {
        // Sign out the user if they're not admin
        await supabase.auth.signOut();
        
        logger.log({
          code: 'UNAUTHORIZED_ADMIN_LOGIN',
          message: `Non-admin user ${email} attempted admin login`,
          severity: 'high',
          context: { email, userId: data.user?.id },
          userMessage: 'Access denied',
        });

        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have admin privileges.",
        });
        return;
      }

      // Success - redirect to admin dashboard
      navigate("/admin-dashboard-2025");
      
    } catch (error) {
      logger.log({
        code: 'ADMIN_LOGIN_ERROR',
        message: `Admin login error: ${error}`,
        severity: 'high',
        context: { email, error: String(error) },
        userMessage: 'Login failed due to system error',
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Admin Access</CardTitle>
          <CardDescription>
            Sign in to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                disabled={loading}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center space-y-4">
            <div className="text-sm text-muted-foreground">
              Need an admin account?{" "}
              <Link 
                to="/admin-dashboard-2025/signup" 
                className="text-primary hover:underline"
              >
                Sign up here
              </Link>
            </div>
            
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground"
            >
              ← Back to main site
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;