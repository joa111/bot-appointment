import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

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
  console.log("Send appointment confirmation function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentData, userEmail }: { appointmentData: AppointmentData; userEmail: string } = await req.json();
    console.log("Processing appointment confirmation for:", userEmail);

    if (!appointmentData || !userEmail) {
      throw new Error("Missing appointment data or email");
    }

    const emailResponse = await resend.emails.send({
      from: "AppointmentBot Pro <appointments@resend.dev>",
      to: [userEmail],
      subject: `Appointment Confirmation - ${appointmentData.bookingReference}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4F46E5; text-align: center;">Appointment Confirmed!</h1>
          
          <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #374151; margin-top: 0;">Appointment Details</h2>
            <p><strong>Name:</strong> ${appointmentData.fullName}</p>
            <p><strong>Date:</strong> ${new Date(appointmentData.appointmentDate).toLocaleDateString()}</p>
            <p><strong>Time Slot:</strong> ${appointmentData.timeSlot}</p>
            <p><strong>Queue Number:</strong> #${appointmentData.queueNumber}</p>
            <p><strong>Booking Reference:</strong> ${appointmentData.bookingReference}</p>
          </div>
          
          <div style="background-color: #EFF6FF; padding: 15px; border-radius: 8px; border-left: 4px solid #3B82F6;">
            <h3 style="color: #1E40AF; margin-top: 0;">Important Information</h3>
            <ul style="color: #1F2937;">
              <li>Please arrive 15 minutes before your scheduled time slot</li>
              <li>Keep your booking reference handy for check-in</li>
              <li>Your queue number will be called when it's your turn</li>
            </ul>
          </div>
          
          <p style="text-align: center; color: #6B7280; font-size: 14px; margin-top: 30px;">
            Thank you for using AppointmentBot Pro!
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.data?.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-appointment-confirmation function:", error);
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