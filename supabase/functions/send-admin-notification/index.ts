import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ─────────────────────────────────────────────────────────────────────────────
// TODO: Telegram Bot Integration
//
// When you're ready to wire up Telegram:
//
// 1. Create a bot via @BotFather on Telegram and copy the bot token.
// 2. Get your admin chat ID (send a message to the bot, then call
//    https://api.telegram.org/bot<TOKEN>/getUpdates to find your chat_id).
// 3. Set both as Supabase secrets:
//      supabase secrets set TELEGRAM_BOT_TOKEN=<token>
//      supabase secrets set TELEGRAM_CHAT_ID=<chat_id>
// 4. Uncomment and fill in the sendTelegramMessage helper below, then
//    call it inside the handler.
//
// Example helper (uncomment when ready):
//
// async function sendTelegramMessage(text: string): Promise<void> {
//   const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
//   const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
//   await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
//   });
// }
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentData }: { appointmentData: AppointmentData } = await req.json();

    // ── Placeholder: replace this block with your Telegram sendMessage call ──
    console.log("New appointment received (Telegram notification pending setup):", {
      ref: appointmentData.bookingReference,
      name: appointmentData.fullName,
      date: appointmentData.appointmentDate,
      slot: appointmentData.timeSlot,
      queue: appointmentData.queueNumber,
    });
    // ─────────────────────────────────────────────────────────────────────────

    return new Response(
      JSON.stringify({ success: true, message: "Notification stub — Telegram not yet configured." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-admin-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);