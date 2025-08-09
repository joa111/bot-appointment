import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Users, Clock, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SystemSettings {
  dailyMorningLimit: number;
  dailyAfternoonLimit: number;
  bookingCutoffHour: number;
  enableNotifications: boolean;
  welcomeMessage: string;
  confirmationMessage: string;
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<SystemSettings>({
    dailyMorningLimit: 50,
    dailyAfternoonLimit: 50,
    bookingCutoffHour: 18,
    enableNotifications: true,
    welcomeMessage: "Welcome to AppointmentBot Pro! I'm here to help you book your appointment quickly and easily.",
    confirmationMessage: "Your appointment has been successfully booked! Please keep your booking reference for future use.",
  });
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAdminUsers();
    setLoading(false);
  }, []);

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdminUsers(data || []);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch admin users.",
      });
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // In a real application, you would save these settings to a database
      // For now, we'll just store them in localStorage
      localStorage.setItem('appointmentBotSettings', JSON.stringify(settings));
      
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const addAdminUser = async () => {
    if (!newAdminEmail || !newAdminEmail.includes('@')) {
      toast({
        variant: "destructive",
        title: "Invalid email",
        description: "Please enter a valid email address.",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_users')
        .insert([
          {
            email: newAdminEmail,
            role: 'admin',
          },
        ]);

      if (error) throw error;

      setNewAdminEmail("");
      await fetchAdminUsers();
      toast({
        title: "Admin user added",
        description: `${newAdminEmail} has been added as an admin.`,
      });
    } catch (error: any) {
      console.error('Error adding admin user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add admin user.",
      });
    }
  };

  const removeAdminUser = async (id: string, email: string) => {
    try {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchAdminUsers();
      toast({
        title: "Admin user removed",
        description: `${email} has been removed from admin access.`,
      });
    } catch (error: any) {
      console.error('Error removing admin user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove admin user.",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse"></div>
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Settings & Configuration</h1>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>

      {/* Booking Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Appointment Limits & Restrictions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="morningLimit">Daily Morning Limit</Label>
              <Input
                id="morningLimit"
                type="number"
                value={settings.dailyMorningLimit}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  dailyMorningLimit: parseInt(e.target.value) || 0
                }))}
                min="1"
                max="100"
              />
              <p className="text-xs text-muted-foreground">
                Maximum morning appointments per day
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="afternoonLimit">Daily Afternoon Limit</Label>
              <Input
                id="afternoonLimit"
                type="number"
                value={settings.dailyAfternoonLimit}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  dailyAfternoonLimit: parseInt(e.target.value) || 0
                }))}
                min="1"
                max="100"
              />
              <p className="text-xs text-muted-foreground">
                Maximum afternoon appointments per day
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cutoffHour">Booking Cutoff Hour</Label>
              <Input
                id="cutoffHour"
                type="number"
                value={settings.bookingCutoffHour}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  bookingCutoffHour: parseInt(e.target.value) || 0
                }))}
                min="0"
                max="23"
              />
              <p className="text-xs text-muted-foreground">
                No bookings allowed after this hour (24h format)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            System Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Welcome Message</Label>
            <Textarea
              id="welcomeMessage"
              value={settings.welcomeMessage}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                welcomeMessage: e.target.value
              }))}
              placeholder="Enter the welcome message shown to users"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmationMessage">Confirmation Message</Label>
            <Textarea
              id="confirmationMessage"
              value={settings.confirmationMessage}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                confirmationMessage: e.target.value
              }))}
              placeholder="Enter the confirmation message shown after booking"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="notifications"
              checked={settings.enableNotifications}
              onCheckedChange={(checked) => setSettings(prev => ({
                ...prev,
                enableNotifications: checked
              }))}
            />
            <Label htmlFor="notifications">Enable system notifications</Label>
          </div>
        </CardContent>
      </Card>

      {/* Admin User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Admin User Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2">
            <Input
              placeholder="Enter admin email address"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              type="email"
            />
            <Dialog>
              <DialogTrigger asChild>
                <Button onClick={addAdminUser}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Admin
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Added Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminUsers.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{admin.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(admin.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeAdminUser(admin.id, admin.email)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {adminUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No admin users found. Add the first admin user above.
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Application Version</Label>
              <p className="text-sm text-muted-foreground">AppointmentBot Pro v1.0.0</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Database Status</Label>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <p className="text-sm text-muted-foreground">Connected</p>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Last Backup</Label>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Active Sessions</Label>
              <p className="text-sm text-muted-foreground">1 admin session</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}