import { useState, useEffect, useRef, useCallback } from "react";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeQueueCounters } from "@/hooks/useRealtimeQueueCounters";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Link } from "react-router-dom";
import { Shield, RotateCcw, ArrowUp, RefreshCw, ChevronRight } from "lucide-react";
import {
  validateName,
  bookingRateLimiter,
  generateSimpleCaptcha,
} from "@/lib/security";
import {
  handleDatabaseError,
  withRetry,
  ErrorLogger,
} from "@/lib/errorHandler";
import {
  useDebounce,
  CacheManager,
  usePerformanceMetric,
} from "@/lib/performance";

export type ChatStep =
  | "welcome"
  | "captcha"
  | "name"
  | "phone"
  | "notes"
  | "date"
  | "timeSlot"
  | "confirmation"
  | "completed";

export interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

export interface AppointmentData {
  fullName: string;
  phoneNumber: string;
  notes: string;
  timeSlot: string;
  queueNumber: number;
  appointmentDate: string;
  bookingReference: string;
}

// ── Time slot availability constants ──────────────────────────────────────
// Morning: bookable until 11:30 AM on the same day
const MORNING_CUTOFF_HOUR = 11;
const MORNING_CUTOFF_MINUTE = 30;
// Afternoon: bookable until the admin-configured cutoff (default 5 PM)
const DEFAULT_AFTERNOON_CUTOFF_HOUR = 17;

// ── Date helpers ──────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function formatDay(d: Date, index: number): { label: string; sub: string } {
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const short = d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
  const label = index === 0 ? "Today" : index === 1 ? "Tomorrow" : weekday;
  const sub = index === 0 || index === 1 ? `${weekday}, ${short}` : short;
  return { label, sub };
}

export function AppointmentChatbot() {
  const [currentStep, setCurrentStep] = useState<ChatStep>("welcome");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [captcha, setCaptcha] = useState(generateSimpleCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appointmentData, setAppointmentData] = useState<AppointmentData>({
    fullName: "",
    phoneNumber: "",
    notes: "",
    timeSlot: "",
    queueNumber: 0,
    appointmentDate: toDateStr(new Date()),
    bookingReference: "",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { getCurrentQueueNumber } = useRealtimeQueueCounters();
  const cache = CacheManager.getInstance();
  const logger = ErrorLogger.getInstance();
  const startTimer = usePerformanceMetric("booking-process");
  const { settings } = useSystemSettings();

  // ── Scroll & focus helpers ──────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (currentStep === "name" || currentStep === "phone") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [currentStep]);

  // ── Slot availability logic ─────────────────────────────────────────────
  const afternoonCutoffHour =
    settings?.booking_cutoff_hour ?? DEFAULT_AFTERNOON_CUTOFF_HOUR;

  /** Is morning bookable for the given date string? */
  const isMorningAvailable = (dateStr: string): boolean => {
    const today = toDateStr(new Date());
    if (dateStr !== today) return true; // future date — always open
    const now = new Date();
    return (
      now.getHours() < MORNING_CUTOFF_HOUR ||
      (now.getHours() === MORNING_CUTOFF_HOUR &&
        now.getMinutes() < MORNING_CUTOFF_MINUTE)
    );
  };

  /** Is afternoon bookable for the given date string? */
  const isAfternoonAvailable = (dateStr: string): boolean => {
    const today = toDateStr(new Date());
    if (dateStr !== today) return true;
    return new Date().getHours() < afternoonCutoffHour;
  };

  /** Build the list of bookable dates (today + 2 days forward) */
  const getBookingDates = () => {
    const today = new Date();
    return [0, 1, 2].map((i) => {
      const d = addDays(today, i);
      const dateStr = toDateStr(d);
      const { label, sub } = formatDay(d, i);
      const morningOk = isMorningAvailable(dateStr);
      const afternoonOk = isAfternoonAvailable(dateStr);
      return { dateStr, label, sub, morningOk, afternoonOk, hasSlots: morningOk || afternoonOk };
    });
  };

  // ── Message helpers ─────────────────────────────────────────────────────
  const addMessage = (text: string, sender: "user" | "bot") => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), text, sender, timestamp: new Date() },
    ]);
  };

  const showTypingAndAddMessage = async (text: string, delay = 1500) => {
    setIsTyping(true);
    await new Promise((resolve) => setTimeout(resolve, delay));
    setIsTyping(false);
    addMessage(text, "bot");
  };

  const debouncedNameValidation = useDebounce((name: string) => {
    const v = validateName(name);
    if (!v.isValid && name.length > 0) console.log("Name validation:", v.error);
  }, 500);

  // ── Booking helpers ─────────────────────────────────────────────────────
  const generateBookingReference = (): string => {
    const ts = Date.now().toString(36);
    const rnd = Math.random().toString(36).substring(2, 8);
    return `APT-${ts.toUpperCase()}-${rnd.toUpperCase()}`;
  };

  const checkDuplicateBooking = useCallback(
    async (fullName: string, date: string): Promise<boolean> => {
      const key = `dup-${fullName}-${date}`;
      const cached = cache.get(key);
      if (cached !== null) return cached;
      try {
        const result = await withRetry(async () => {
          const { data, error } = await supabase
            .from("appointments")
            .select("id")
            .eq("full_name", fullName)
            .eq("appointment_date", date)
            .eq("status", "Pending");
          if (error) throw error;
          return data && data.length > 0;
        });
        cache.set(key, result, 60000);
        return result;
      } catch (error) {
        handleDatabaseError(error, "duplicate-check");
        return false;
      }
    },
    [cache]
  );

  const checkDailyLimit = async (
    timeSlot: "Morning" | "Afternoon",
    dateStr: string
  ): Promise<boolean> => {
    const limit =
      timeSlot === "Morning"
        ? (settings?.daily_morning_limit ?? 50)
        : (settings?.daily_afternoon_limit ?? 50);
    try {
      const { data } = await supabase
        .from("queue_counters")
        .select("*")
        .eq("date", dateStr)
        .maybeSingle(); // maybeSingle() returns null (not 406) when no row exists
      if (data) {
        const count =
          timeSlot === "Morning" ? data.morning_count : data.afternoon_count;
        return count < limit;
      }
      return true;
    } catch {
      return true;
    }
  };

  const generateQueueNumber = async (
    timeSlot: "Morning" | "Afternoon",
    dateStr: string
  ): Promise<number> => {
    try {
      const field = timeSlot === "Morning" ? "morning_count" : "afternoon_count";
      const other = timeSlot === "Morning" ? "afternoon_count" : "morning_count";

      const { data: existing } = await supabase
        .from("queue_counters")
        .select("*")
        .eq("date", dateStr);

      let num: number;

      if (existing && existing.length > 0) {
        num = existing[0][field] + 1;
        await supabase
          .from("queue_counters")
          .update({ [field]: num })
          .eq("id", existing[0].id);
      } else {
        num = 1;
        await supabase.from("queue_counters").insert({
          date: dateStr,
          [field]: 1,
          [other]: 0,
        });
      }
      return num;
    } catch {
      return 1;
    }
  };

  const saveAppointment = async (data: AppointmentData) => {
    try {
      const { error } = await supabase.from("appointments").insert({
        full_name: data.fullName,
        phone_number: data.phoneNumber || null,
        notes: data.notes || null,
        time_slot: data.timeSlot,
        queue_number: data.queueNumber,
        appointment_date: data.appointmentDate,
        booking_reference: data.bookingReference,
      });
      if (error) throw error;
      toast({ title: "Appointment Booked!", description: "Successfully scheduled." });
    } catch {
      toast({ title: "Error", description: "Failed to save. Please try again.", variant: "destructive" });
    }
  };

  // ── Flow handlers ───────────────────────────────────────────────────────
  const startBooking = () => setCurrentStep("captcha");

  const handleCaptchaVerify = async () => {
    if (parseInt(captchaAnswer) !== captcha.answer) {
      setCaptcha(generateSimpleCaptcha());
      setCaptchaAnswer("");
      setCaptchaError("Wrong answer — try this new one!");
      return;
    }
    setCaptchaError("");
    setCaptchaAnswer("");
    setCurrentStep("name");
    await showTypingAndAddMessage(
      "Hey! Let's get you booked in. What's your full name? (first and last name please)"
    );
  };

  const handleNameSubmit = async () => {
    const endTimer = startTimer();
    setIsSubmitting(true);
    try {
      const rateCheck = bookingRateLimiter.isAllowed(nameInput.toLowerCase());
      if (!rateCheck.allowed) {
        await showTypingAndAddMessage(
          `Hold on — please wait ${rateCheck.timeLeft}s before trying again.`,
          800
        );
        return;
      }

      const validation = validateName(nameInput);
      if (!validation.isValid) {
        await showTypingAndAddMessage(validation.error!, 800);
        return;
      }

      addMessage(nameInput, "user");
      setAppointmentData((prev) => ({ ...prev, fullName: nameInput }));
      setNameInput("");
      setCurrentStep("phone");

      await showTypingAndAddMessage(
        `Nice to meet you, ${nameInput.split(" ")[0]}! What's your phone number? We may call you if something comes up. (You can skip this if you'd like)`
      );
    } catch (error) {
      logger.log({
        code: "NAME_SUBMIT_ERROR",
        message: error instanceof Error ? error.message : "Name submission failed",
        severity: "medium",
        context: { nameInput },
        userMessage: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
      endTimer();
    }
  };

  const handlePhoneSubmit = async (skip = false) => {
    const phone = skip ? "" : phoneInput.trim();
    if (!skip) addMessage(phone || "(skipped)", "user");
    else addMessage("Skip", "user");
    setAppointmentData((prev) => ({ ...prev, phoneNumber: phone }));
    setPhoneInput("");
    setCurrentStep("notes");
    await showTypingAndAddMessage(
      "Got it! Could you briefly describe what brings you in today? Is it a regular check-up, a specific issue, or an emergency? (You can skip this too)"
    );
  };

  const handleNotesSubmit = async (skip = false) => {
    const finalNotes = skip
      ? ""
      : isEmergency
      ? `🚨 EMERGENCY — ${notesInput.trim()}`
      : notesInput.trim();
    if (!skip) addMessage(isEmergency ? `🚨 Emergency: ${notesInput.trim() || "(no details)"}` : notesInput.trim() || "(no details)", "user");
    else addMessage("Skip", "user");
    setAppointmentData((prev) => ({ ...prev, notes: finalNotes }));
    setNotesInput("");
    setIsEmergency(false);
    setCurrentStep("date");
    await showTypingAndAddMessage(
      `Thanks! Now let's find you a slot — which day works for you?`
    );
  };

  const handleDateSelection = async (
    dateStr: string,
    label: string,
    morningOk: boolean,
    afternoonOk: boolean
  ) => {
    addMessage(label, "user");
    setAppointmentData((prev) => ({ ...prev, appointmentDate: dateStr }));
    setCurrentStep("timeSlot");

    // Build an availability hint for the bot message
    let hint = "";
    if (morningOk && afternoonOk) {
      hint = "Both morning and afternoon slots are open.";
    } else if (morningOk) {
      hint = "Only the morning slot is still available for that day.";
    } else if (afternoonOk) {
      hint = "Only the afternoon slot is still available for that day.";
    }

    await showTypingAndAddMessage(
      `Got it — ${label.toLowerCase()}! ${hint} Which time works for you?`
    );
  };

  const handleTimeSlotSelection = async (timeSlot: "Morning" | "Afternoon") => {
    addMessage(`${timeSlot} slot`, "user");

    const dateStr = appointmentData.appointmentDate;

    // Real-time availability check (in case time passed since date was chosen)
    const slotOk =
      timeSlot === "Morning"
        ? isMorningAvailable(dateStr)
        : isAfternoonAvailable(dateStr);

    if (!slotOk) {
      const when = toDateStr(new Date()) === dateStr ? "for today" : "for that day";
      await showTypingAndAddMessage(
        `Sorry, the ${timeSlot.toLowerCase()} slot is no longer available ${when}. Please pick the other slot or choose a different date.`,
        800
      );
      setCurrentStep("timeSlot");
      return;
    }

    // Duplicate booking check
    const isDuplicate = await checkDuplicateBooking(
      appointmentData.fullName,
      dateStr
    );
    if (isDuplicate) {
      const dateLabel =
        toDateStr(new Date()) === dateStr ? "that day" : "that date";
      await showTypingAndAddMessage(
        `You already have a pending appointment for ${dateLabel}. Only one booking per day is allowed.`,
        800
      );
      return;
    }

    // Daily capacity check
    const withinLimit = await checkDailyLimit(timeSlot, dateStr);
    if (!withinLimit) {
      await showTypingAndAddMessage(
        `The ${timeSlot.toLowerCase()} slots are fully booked for that day. Try the other time slot!`,
        800
      );
      return;
    }

    // All good — generate and save
    const queueNumber = await generateQueueNumber(timeSlot, dateStr);
    const bookingReference = generateBookingReference();
    const updatedData = {
      ...appointmentData,
      timeSlot,
      queueNumber,
      bookingReference,
    };
    setAppointmentData(updatedData);
    setCurrentStep("confirmation");

    const dateDisplay = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    await showTypingAndAddMessage(
      `You're queue #${queueNumber} for the ${timeSlot.toLowerCase()} session on ${dateDisplay}. Processing your booking…`,
      1000
    );

    await saveAppointment(updatedData);
    await sendNotifications(updatedData);

    const confirmationText =
      settings?.confirmation_message ||
      "Your appointment is confirmed! Keep your reference number handy.";

    await showTypingAndAddMessage(
      `All done! ✓ ${confirmationText}\n\nBooking details:\nRef: ${bookingReference}\nName: ${updatedData.fullName}\nDate: ${dateDisplay}\nSlot: ${timeSlot}\nQueue: #${queueNumber}\n\nPlease arrive a few minutes early.`,
      1500
    );

    setCurrentStep("completed");
  };

  const sendNotifications = (data: AppointmentData) => {
    // Fire-and-forget: if the edge function isn't deployed, this silently
    // does nothing rather than logging a CORS/network error to the console.
    supabase.functions
      .invoke("send-admin-notification", { body: { appointmentData: data } })
      .catch(() => { /* notification is best-effort — never block the booking */ });
  };

  const resetChat = () => {
    setCurrentStep("welcome");
    setMessages([]);
    setAppointmentData({
      fullName: "",
      phoneNumber: "",
      notes: "",
      timeSlot: "",
      queueNumber: 0,
      appointmentDate: toDateStr(new Date()),
      bookingReference: "",
    });
    setNameInput("");
    setPhoneInput("");
    setNotesInput("");
    setIsEmergency(false);
    setCaptcha(generateSimpleCaptcha());
    setCaptchaAnswer("");
    setCaptchaError("");
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (currentStep === "welcome") {
    return (
      <WelcomeScreen
        onStartBooking={startBooking}
        welcomeMessage={settings?.welcome_message}
      />
    );
  }

  // Pre-chat CAPTCHA gate
  if (currentStep === "captcha") {
    return (
      <div className="min-h-screen bg-background dot-grid flex flex-col items-center justify-center p-5">
        <div className="w-full max-w-sm animate-fade-up" style={{ animationFillMode: "both" }}>
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                <span className="text-primary text-xl font-bold font-ui">AB</span>
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[hsl(var(--online-dot))] rounded-full border-2 border-background online-pulse" />
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-1.5">Quick check</h2>
            <p className="text-sm text-muted-foreground">Just making sure you're human — answer this to continue.</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border/50 p-5 mb-4">
            <p className="text-sm font-medium text-foreground mb-3 text-center">{captcha.question}</p>
            <div className="flex items-center gap-2">
              <input
                id="captcha-gate-input"
                type="number"
                value={captchaAnswer}
                onChange={(e) => { setCaptchaAnswer(e.target.value); setCaptchaError(""); }}
                onKeyDown={(e) => e.key === "Enter" && captchaAnswer.trim() && handleCaptchaVerify()}
                placeholder="Your answer"
                autoFocus
                className="flex-1 bg-surface-elevated border border-border/60 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors text-center"
              />
              <button
                id="refresh-captcha-gate-btn"
                onClick={() => { setCaptcha(generateSimpleCaptcha()); setCaptchaAnswer(""); setCaptchaError(""); }}
                className="w-10 h-10 rounded-xl bg-surface-elevated border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title="New question"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {captchaError && (
              <p className="text-xs text-destructive mt-2 text-center animate-fade-in">{captchaError}</p>
            )}
          </div>

          <button
            id="captcha-verify-btn"
            onClick={handleCaptchaVerify}
            disabled={!captchaAnswer.trim()}
            className="w-full h-12 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-40 shadow-lg shadow-primary/20"
          >
            Continue
          </button>

          <button
            onClick={() => setCurrentStep("welcome")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto mt-4"
          >
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  // ── Main chat UI ────────────────────────────────────────────────────────
  const bookingDates = getBookingDates();
  const selectedDate = appointmentData.appointmentDate;
  const morningOkNow = isMorningAvailable(selectedDate);
  const afternoonOkNow = isAfternoonAvailable(selectedDate);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-surface border-b border-border/60 px-4 py-3 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                <span className="text-primary text-xs font-bold font-ui">AB</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[hsl(var(--online-dot))] rounded-full border-[1.5px] border-surface online-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">Appointment Bot</p>
              <p className="text-[11px] text-[hsl(var(--online-dot))] mt-0.5 leading-none">Online</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/admin-dashboard-2025">
              <button id="admin-link-btn" className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors" title="Admin">
                <Shield className="w-4 h-4" />
              </button>
            </Link>
            <button id="new-booking-btn" onClick={resetChat} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors" title="New booking">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto chat-scroll-area py-4 space-y-2 max-w-lg mx-auto w-full">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input / action area */}
        <div className="flex-shrink-0 border-t border-border/40 bg-surface/80 backdrop-blur-sm pb-safe">
          <div className="max-w-lg mx-auto w-full p-3">

            {/* ── Name input ── */}
            {currentStep === "name" && (
              <div
                className={`animate-fade-up transition-opacity duration-300 ${isTyping ? "opacity-40 pointer-events-none" : ""}`}
                style={{ animationFillMode: "both" }}
              >
                <div className="flex items-center gap-2 bg-surface-elevated rounded-2xl px-4 py-1 border border-border/60 focus-within:border-primary/50 transition-colors">
                  <input
                    ref={inputRef}
                    id="name-input"
                    value={nameInput}
                    onChange={(e) => { setNameInput(e.target.value); debouncedNameValidation(e.target.value); }}
                    onKeyDown={(e) => e.key === "Enter" && !isSubmitting && !isTyping && nameInput.trim() && handleNameSubmit()}
                    placeholder="Your full name…"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground py-3 outline-none min-w-0 font-sans"
                    disabled={isSubmitting || isTyping}
                    autoComplete="name"
                  />
                  <button
                    id="send-name-btn"
                    onClick={handleNameSubmit}
                    disabled={!nameInput.trim() || isSubmitting || isTyping}
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center disabled:opacity-30 transition-opacity flex-shrink-0 active:scale-95"
                  >
                    {isSubmitting
                      ? <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" />
                      : <ArrowUp className="w-3.5 h-3.5 text-white" />
                    }
                  </button>
                </div>
              </div>
            )}

            {/* ── Phone number input ── */}
            {currentStep === "phone" && (
              <div
                className={`animate-fade-up transition-opacity duration-300 ${isTyping ? "opacity-40 pointer-events-none" : ""}`}
                style={{ animationFillMode: "both" }}
              >
                <div className="flex items-center gap-2 bg-surface-elevated rounded-2xl px-4 py-1 border border-border/60 focus-within:border-primary/50 transition-colors">
                  <input
                    ref={inputRef}
                    id="phone-input"
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isTyping && handlePhoneSubmit(false)}
                    placeholder="e.g. +91 98765 43210"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground py-3 outline-none min-w-0 font-sans"
                    disabled={isTyping}
                    autoComplete="tel"
                  />
                  <button
                    id="skip-phone-btn"
                    onClick={() => handlePhoneSubmit(true)}
                    disabled={isTyping}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-surface flex-shrink-0"
                  >
                    Skip
                  </button>
                  <button
                    id="send-phone-btn"
                    onClick={() => handlePhoneSubmit(false)}
                    disabled={!phoneInput.trim() || isTyping}
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center disabled:opacity-30 transition-opacity flex-shrink-0 active:scale-95"
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Notes / reason input ── */}
            {currentStep === "notes" && (
              <div
                className={`animate-fade-up transition-opacity duration-300 ${isTyping ? "opacity-40 pointer-events-none" : ""}`}
                style={{ animationFillMode: "both" }}
              >
                <div className="space-y-2">
                  {/* Emergency toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      id="emergency-toggle-btn"
                      onClick={() => setIsEmergency((v) => !v)}
                      disabled={isTyping}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200 ${
                        isEmergency
                          ? "bg-red-500 border-red-400 text-white shadow-sm shadow-red-200"
                          : "bg-surface-elevated border-border/60 text-muted-foreground hover:border-red-300 hover:text-red-500"
                      }`}
                    >
                      🚨 Emergency
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {isEmergency ? "Marked as emergency" : "Regular visit"}
                    </span>
                  </div>

                  {/* Textarea */}
                  <div className="bg-surface-elevated rounded-2xl border border-border/60 focus-within:border-primary/50 transition-colors">
                    <textarea
                      id="notes-input"
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      placeholder={isEmergency ? "Briefly describe the emergency…" : "Describe your issue or reason for visit… (optional)"}
                      rows={3}
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground px-4 pt-3 pb-1 outline-none min-w-0 font-sans resize-none"
                      disabled={isTyping}
                    />
                    <div className="flex items-center justify-end gap-2 px-3 pb-2">
                      <button
                        id="skip-notes-btn"
                        onClick={() => handleNotesSubmit(true)}
                        disabled={isTyping}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-surface"
                      >
                        Skip
                      </button>
                      <button
                        id="send-notes-btn"
                        onClick={() => handleNotesSubmit(false)}
                        disabled={isTyping}
                        className="w-8 h-8 rounded-full bg-primary flex items-center justify-center disabled:opacity-30 transition-opacity flex-shrink-0 active:scale-95"
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Date selection ── */}
            {currentStep === "date" && (
              <div
                className={`space-y-2 animate-fade-up transition-opacity duration-300 ${isTyping ? "opacity-40 pointer-events-none" : ""}`}
                style={{ animationFillMode: "both" }}
              >
                {bookingDates.map(({ dateStr, label, sub, morningOk, afternoonOk, hasSlots }) => (
                  <button
                    key={dateStr}
                    id={`date-btn-${dateStr}`}
                    onClick={() => hasSlots && !isTyping && handleDateSelection(dateStr, label, morningOk, afternoonOk)}
                    disabled={!hasSlots || isTyping}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all duration-200 group
                      ${hasSlots
                        ? "bg-surface-elevated border-border/60 hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99] cursor-pointer"
                        : "bg-surface-elevated border-border/30 opacity-40 cursor-not-allowed"
                      }`}
                  >
                    <div className="text-left">
                      <p className={`text-sm font-medium leading-none mb-1 ${hasSlots ? "text-foreground" : "text-muted-foreground"}`}>
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasSlots ? (
                        <>
                          {morningOk && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium font-ui">AM</span>
                          )}
                          {afternoonOk && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium font-ui">PM</span>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors ml-1" />
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground font-ui">No slots</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── Time slot selection (with real-time availability) ── */}
            {currentStep === "timeSlot" && (
              <div
                className={`grid grid-cols-2 gap-2.5 animate-fade-up transition-opacity duration-300 ${isTyping ? "opacity-40 pointer-events-none" : ""}`}
                style={{ animationFillMode: "both" }}
              >
                {[
                  { id: "morning", label: "Morning", sub: "Before noon", emoji: "🌅", available: morningOkNow, slot: "Morning" as const },
                  { id: "afternoon", label: "Afternoon", sub: "After noon", emoji: "🌇", available: afternoonOkNow, slot: "Afternoon" as const },
                ].map(({ id, label, sub, emoji, available, slot }) => (
                  <button
                    key={id}
                    id={`${id}-slot-btn`}
                    onClick={() => available && !isTyping && handleTimeSlotSelection(slot)}
                    disabled={!available || isTyping}
                    className={`flex flex-col items-center justify-center gap-1 py-5 rounded-2xl border transition-all duration-200
                      ${available
                        ? "bg-surface-elevated border-border/60 hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97] group cursor-pointer"
                        : "bg-surface-elevated border-border/30 opacity-40 cursor-not-allowed"
                      }`}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className={`text-sm font-medium ${available ? "text-foreground group-hover:text-primary transition-colors" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-ui">
                      {available ? sub : "Closed"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Completed ── */}
            {currentStep === "completed" && (
              <div className="flex items-center justify-center gap-3 py-2 animate-fade-up" style={{ animationFillMode: "both" }}>
                <span className="text-xs text-muted-foreground">Need another appointment?</span>
                <button
                  id="book-another-btn"
                  onClick={resetChat}
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
                >
                  Start over
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
