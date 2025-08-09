import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Shield, UserPlus } from "lucide-react";
import { adminLoginRateLimiter } from "@/lib/security";
import { ErrorLogger } from "@/lib/errorHandler";

const AdminSignup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  const validateInputs = () => {
    if (!email || !password || !confirmPassword) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all fields.",
      });
      return false;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Password Mismatch",
        description: "Passwords do not match.",
      });
      return false;
    }

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Weak Password",
        description: "Password must be at least 8 characters long.",
      });
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address.",
      });
      return false;
    }

    return true;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateInputs()) {
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
      // Sign up with Supabase Auth
      const redirectUrl = `${window.location.origin}/admin-dashboard-2025`;
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (signupError) {
        logger.log({
          code: 'ADMIN_SIGNUP_FAILED',
          message: `Admin signup failed for ${email}: ${signupError.message}`,
          severity: 'medium',
          context: { email, error: signupError.message },
          userMessage: 'Signup failed',
        });

        toast({
          variant: "destructive",
          title: "Signup Failed",
          description: signupError.message,
        });
        return;
      }

      if (data.user) {
        // Always try to create admin user entry, regardless of session state
        try {
          const { error: adminError } = await supabase.rpc('create_admin_user', {
            user_email: data.user.email
          });

          if (adminError) {
            console.warn("Admin user entry error:", adminError);
          }
        } catch (error) {
          console.error("Error adding admin user:", error);
        }

        if (!data.session) {
          // Email confirmation required
          toast({
            title: "Check Your Email",
            description: "Please check your email and click the confirmation link to complete your admin account setup.",
          });
        } else {
          // User is immediately signed in
          toast({
            title: "Admin Account Created",
            description: "Your admin account has been created successfully!",
          });
          
          navigate("/admin-dashboard-2025");
        }
      }
      
    } catch (error) {
      logger.log({
        code: 'ADMIN_SIGNUP_ERROR',
        message: `Admin signup error: ${error}`,
        severity: 'high',
        context: { email, error: String(error) },
        userMessage: 'Signup failed due to system error',
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
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Admin Account</CardTitle>
          <CardDescription>
            Set up your administrator account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
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
                  placeholder="Minimum 8 characters"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  disabled={loading}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  {showConfirmPassword ? (
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
                  Creating Account...
                </div>
              ) : (
                "Create Admin Account"
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center space-y-4">
            <div className="text-sm text-muted-foreground">
              Already have an admin account?{" "}
              <Link 
                to="/admin-dashboard-2025/login" 
                className="text-primary hover:underline"
              >
                Sign in here
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

export default AdminSignup;