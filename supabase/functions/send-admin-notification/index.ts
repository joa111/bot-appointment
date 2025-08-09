import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AppointmentData {
  fullName: string;
  timeSlot: string;
  queueNumber: number;
  appointmentDate: string;
  bookingReference: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Send admin notification function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentData }: { appointmentData: AppointmentData } = await req.json();
    console.log("Processing admin notification for appointment:", appointmentData.bookingReference);

    // Get admin users
    const { data: adminUsers, error } = await supabase
      .from('admin_users')
      .select('email');

    if (error) {
      console.error("Error fetching admin users:", error);
      throw error;
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.log("No admin users found");
      return new Response(JSON.stringify({ success: true, message: "No admin users to notify" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminEmails = adminUsers.map(admin => admin.email);
    console.log("Sending notifications to admins:", adminEmails);

    const emailResponse = await resend.emails.send({
      from: "AppointmentBot Pro <notifications@resend.dev>",
      to: adminEmails,
      subject: `New Appointment Booking - ${appointmentData.timeSlot}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #DC2626; text-align: center;">New Appointment Alert</h1>
          
          <div style="background-color: #FEF2F2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
            <h2 style="color: #991B1B; margin-top: 0;">Appointment Details</h2>
            <p><strong>Patient Name:</strong> ${appointmentData.fullName}</p>
            <p><strong>Date:</strong> ${new Date(appointmentData.appointmentDate).toLocaleDateString()}</p>
            <p><strong>Time Slot:</strong> ${appointmentData.timeSlot}</p>
            <p><strong>Queue Number:</strong> #${appointmentData.queueNumber}</p>
            <p><strong>Booking Reference:</strong> ${appointmentData.bookingReference}</p>
            <p><strong>Booked At:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="/admin" style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View in Admin Dashboard
            </a>
          </div>
          
          <p style="text-align: center; color: #6B7280; font-size: 14px;">
            This is an automated notification from AppointmentBot Pro
          </p>
        </div>
      `,
    });

    console.log("Admin notification sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.data?.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-admin-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);