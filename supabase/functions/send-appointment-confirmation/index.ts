import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// ─────────────────────────────────────────────────────────────────────────────
// TODO: Telegram Bot Integration (patient confirmation)
//
// When you have the patient's phone/Telegram username, you could send them
// a confirmation message here using the Telegram Bot API.
//
// For now this function is a stub. The same setup instructions apply as in
// send-admin-notification/index.ts.
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AppointmentData {
  fullName: string;
  phoneNumber?: string;
  notes?: string;
  timeSlot: string;
  queueNumber: number;
  appointmentDate: string;
  bookingReference: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentData }: { appointmentData: AppointmentData } = await req.json();

    // ── Placeholder: add patient-facing Telegram notification here ───────────
    console.log("Appointment confirmation stub:", appointmentData.bookingReference);
    // ─────────────────────────────────────────────────────────────────────────

    return new Response(
      JSON.stringify({ success: true, message: "Confirmation stub — Telegram not yet configured." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-appointment-confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);