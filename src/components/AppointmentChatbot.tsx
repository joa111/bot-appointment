import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeQueueCounters } from "@/hooks/useRealtimeQueueCounters";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
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
  | "name"
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
  timeSlot: string;
  queueNumber: number;
  appointmentDate: string;
  bookingReference: string;
}

export function AppointmentChatbot() {
  const [currentStep, setCurrentStep] = useState<ChatStep>("welcome");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [captcha, setCaptcha] = useState(generateSimpleCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appointmentData, setAppointmentData] = useState<AppointmentData>({
    fullName: "",
    timeSlot: "",
    queueNumber: 0,
    appointmentDate: new Date().toISOString().split("T")[0],
    bookingReference: "",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { getCurrentQueueNumber } = useRealtimeQueueCounters();
  const cache = CacheManager.getInstance();
  const logger = ErrorLogger.getInstance();
  const startTimer = usePerformanceMetric("booking-process");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const addMessage = (text: string, sender: "user" | "bot") => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const showTypingAndAddMessage = async (text: string, delay = 1500) => {
    setIsTyping(true);
    await new Promise((resolve) => setTimeout(resolve, delay));
    setIsTyping(false);
    addMessage(text, "bot");
  };

  const debouncedNameValidation = useDebounce((name: string) => {
    const validation = validateName(name);
    if (!validation.isValid && name.length > 0) {
      // Could show inline validation feedback here
      console.log("Name validation:", validation.error);
    }
  }, 500);

  const generateBookingReference = (): string => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `APT-${timestamp.toUpperCase()}-${randomStr.toUpperCase()}`;
  };

  const checkTimeRestriction = (): boolean => {
    const currentHour = new Date().getHours();
    return currentHour < 18; // No booking after 6 PM
  };

  const checkDuplicateBooking = useCallback(
    async (fullName: string, date: string): Promise<boolean> => {
      const cacheKey = `duplicate-check-${fullName}-${date}`;
      const cached = cache.get(cacheKey);
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

        cache.set(cacheKey, result, 60000); // Cache for 1 minute
        return result;
      } catch (error) {
        handleDatabaseError(error, "duplicate-check");
        return false;
      }
    },
    [cache]
  );

  const checkDailyLimit = async (
    timeSlot: "Morning" | "Afternoon"
  ): Promise<boolean> => {
    const DAILY_LIMIT = 50; // Configurable daily limit per time slot
    const today = new Date().toISOString().split("T")[0];

    try {
      const { data } = await supabase
        .from("queue_counters")
        .select("*")
        .eq("date", today)
        .single();

      if (data) {
        const currentCount =
          timeSlot === "Morning" ? data.morning_count : data.afternoon_count;
        return currentCount < DAILY_LIMIT;
      }

      return true; // No counter exists yet, so within limit
    } catch (error) {
      console.error("Error checking daily limit:", error);
      return true; // Default to allowing booking if check fails
    }
  };

  const generateQueueNumber = async (
    timeSlot: "Morning" | "Afternoon"
  ): Promise<number> => {
    const today = new Date().toISOString().split("T")[0];

    try {
      // Use upsert to handle both insert and update atomically
      const field =
        timeSlot === "Morning" ? "morning_count" : "afternoon_count";
      const otherField =
        timeSlot === "Morning" ? "afternoon_count" : "morning_count";

      // First, try to get existing counter
      const { data: existingCounters } = await supabase
        .from("queue_counters")
        .select("*")
        .eq("date", today);

      let newQueueNumber: number;

      if (existingCounters && existingCounters.length > 0) {
        // Update existing counter
        const existingCounter = existingCounters[0];
        newQueueNumber = existingCounter[field] + 1;

        const { error: updateError } = await supabase
          .from("queue_counters")
          .update({ [field]: newQueueNumber })
          .eq("id", existingCounter.id);

        if (updateError) {
          console.error("Error updating queue counter:", updateError);
          return 1;
        }
      } else {
        // Create new counter for today
        newQueueNumber = 1;
        const { error: insertError } = await supabase
          .from("queue_counters")
          .insert({
            date: today,
            [field]: 1,
            [otherField]: 0,
          });

        if (insertError) {
          console.error("Error creating queue counter:", insertError);
          return 1;
        }
      }

      console.log(
        `Generated queue number ${newQueueNumber} for ${timeSlot} slot`
      );
      return newQueueNumber;
    } catch (error) {
      console.error("Error generating queue number:", error);
      return 1; // Fallback
    }
  };

  const saveAppointment = async (data: AppointmentData) => {
    try {
      const { error } = await supabase.from("appointments").insert({
        full_name: data.fullName,
        time_slot: data.timeSlot,
        queue_number: data.queueNumber,
        appointment_date: data.appointmentDate,
        booking_reference: data.bookingReference,
      });

      if (error) throw error;

      toast({
        title: "Appointment Booked!",
        description: "Your appointment has been successfully scheduled.",
      });
    } catch (error) {
      console.error("Error saving appointment:", error);
      toast({
        title: "Error",
        description: "Failed to save appointment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const startBooking = async () => {
    setCurrentStep("name");
    await showTypingAndAddMessage(
      "Great! Let's get you booked. First, could you please tell me your full name? (Please provide your first and last name)"
    );
  };

  const handleNameSubmit = async () => {
    const endTimer = startTimer();
    setIsSubmitting(true);

    try {
      // Rate limiting check
      const rateCheck = bookingRateLimiter.isAllowed(nameInput.toLowerCase());
      if (!rateCheck.allowed) {
        await showTypingAndAddMessage(
          `Please wait ${rateCheck.timeLeft} seconds before trying again.`,
          800
        );
        return;
      }

      // Enhanced name validation
      const validation = validateName(nameInput);
      if (!validation.isValid) {
        await showTypingAndAddMessage(validation.error!, 800);
        return;
      }

      // CAPTCHA verification
      if (parseInt(captchaAnswer) !== captcha.answer) {
        setCaptcha(generateSimpleCaptcha());
        setCaptchaAnswer("");
        await showTypingAndAddMessage(
          "CAPTCHA verification failed. Please try again with the new question.",
          800
        );
        return;
      }

      addMessage(nameInput, "user");
      setAppointmentData((prev) => ({ ...prev, fullName: nameInput }));
      setNameInput("");
      setCaptchaAnswer("");
      setCurrentStep("timeSlot");

      await showTypingAndAddMessage(
        `Thank you, ${nameInput}! Now, when would you prefer your appointment?`
      );
    } catch (error) {
      logger.log({
        code: "NAME_SUBMIT_ERROR",
        message:
          error instanceof Error ? error.message : "Name submission failed",
        severity: "medium",
        context: { nameInput },
        userMessage: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
      endTimer();
    }
  };

  const handleTimeSlotSelection = async (timeSlot: "Morning" | "Afternoon") => {
    addMessage(`${timeSlot} Appointment`, "user");

    // Check time restrictions
    if (!checkTimeRestriction()) {
      await showTypingAndAddMessage(
        "Sorry, bookings are not available after 6:00 PM. Please try again tomorrow during business hours.",
        800
      );
      return;
    }

    // Check duplicate booking
    const isDuplicate = await checkDuplicateBooking(
      appointmentData.fullName,
      appointmentData.appointmentDate
    );
    if (isDuplicate) {
      await showTypingAndAddMessage(
        "It looks like you already have a pending appointment for today. You can only book one appointment per day.",
        800
      );
      return;
    }

    // Check daily limit
    const withinLimit = await checkDailyLimit(timeSlot);
    if (!withinLimit) {
      await showTypingAndAddMessage(
        `Sorry, we've reached the maximum number of ${timeSlot.toLowerCase()} appointments for today. Please try the other time slot or book for another day.`,
        800
      );
      return;
    }

    // Generate queue number and booking reference
    const queueNumber = await generateQueueNumber(timeSlot);
    const bookingReference = generateBookingReference();
    const updatedData = {
      ...appointmentData,
      timeSlot,
      queueNumber,
      bookingReference,
    };
    setAppointmentData(updatedData);
    setCurrentStep("confirmation");

    await showTypingAndAddMessage(
      `Perfect! You've been assigned queue number ${queueNumber} for a ${timeSlot.toLowerCase()} appointment on ${new Date().toLocaleDateString()}. Let me process your booking...`,
      1000
    );

    // Save appointment and show final confirmation
    await saveAppointment(updatedData);

    // Send notifications
    await sendNotifications(updatedData);

    await showTypingAndAddMessage(
      `🎉 Your appointment is confirmed!\n\n📋 Booking Details:\n• Reference: ${bookingReference}\n• Name: ${
        updatedData.fullName
      }\n• Time Slot: ${timeSlot} appointment\n• Queue Number: ${queueNumber}\n• Date: ${new Date().toLocaleDateString()}\n\n✅ Please save your booking reference number for future reference.\n🕐 Please arrive a few minutes early.\n\nThank you for booking with AppointmentBot Pro!`,
      1500
    );

    setCurrentStep("completed");
  };

  const sendNotifications = async (data: AppointmentData) => {
    try {
      // Send admin notification
      await supabase.functions.invoke("send-admin-notification", {
        body: { appointmentData: data },
      });

      console.log("Admin notification sent successfully");
    } catch (error) {
      console.error("Failed to send notifications:", error);
      // Don't throw error here to avoid breaking the booking flow
    }
  };

  const resetChat = () => {
    setCurrentStep("welcome");
    setMessages([]);
    setAppointmentData({
      fullName: "",
      timeSlot: "",
      queueNumber: 0,
      appointmentDate: new Date().toISOString().split("T")[0],
      bookingReference: "",
    });
    setNameInput("");
  };

  if (currentStep === "welcome") {
    return <WelcomeScreen onStartBooking={startBooking} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b border-border/50 p-3 sm:p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-lg sm:text-xl font-bold text-foreground bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            AppointmentBot Pro
          </h1>
          <div className="flex gap-1 sm:gap-2">
            <Link to="/admin-dashboard-2025">
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </Button>
              <Button variant="outline" size="sm" className="sm:hidden">
                <Shield className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={resetChat}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="hidden sm:inline">New Booking</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {isTyping && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {currentStep === "name" && (
            <div className="p-3 sm:p-4">
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                <div className="p-4 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      value={nameInput}
                      onChange={(e) => {
                        setNameInput(e.target.value);
                        debouncedNameValidation(e.target.value);
                      }}
                      placeholder="Enter your full name..."
                      onKeyPress={(e) =>
                        e.key === "Enter" && !isSubmitting && handleNameSubmit()
                      }
                      className="flex-1 h-12 text-base border-border/30 focus:border-primary/50 transition-colors"
                      autoFocus
                      disabled={isSubmitting}
                    />
                    <Button
                      onClick={handleNameSubmit}
                      disabled={!nameInput.trim() || isSubmitting}
                      className="h-12 px-6 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-medium shadow-lg transition-all duration-200"
                      size="lg"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </div>
                      ) : (
                        "Send"
                      )}
                    </Button>
                  </div>

                  {/* Simple CAPTCHA */}
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    <span className="font-medium">{captcha.question}</span>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        value={captchaAnswer}
                        onChange={(e) => setCaptchaAnswer(e.target.value)}
                        placeholder="Answer"
                        className="w-20 h-9 text-center border-border/30"
                        disabled={isSubmitting}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCaptcha(generateSimpleCaptcha());
                          setCaptchaAnswer("");
                        }}
                        disabled={isSubmitting}
                        className="h-9 px-3 text-xs"
                      >
                        New
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {currentStep === "timeSlot" && (
            <div className="p-3 sm:p-4">
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={() => handleTimeSlotSelection("Morning")}
                      className="h-14 sm:h-16 text-base sm:text-lg font-medium bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg transition-all duration-200 hover:scale-[1.02]"
                      size="lg"
                    >
                      <span className="flex items-center gap-2">
                        🌅 <span>Morning Appointment</span>
                      </span>
                    </Button>
                    <Button
                      onClick={() => handleTimeSlotSelection("Afternoon")}
                      variant="secondary"
                      className="h-14 sm:h-16 text-base sm:text-lg font-medium bg-gradient-to-r from-secondary to-muted hover:from-secondary/90 hover:to-muted/90 shadow-lg transition-all duration-200 hover:scale-[1.02]"
                      size="lg"
                    >
                      <span className="flex items-center gap-2">
                        🌇 <span>Afternoon Appointment</span>
                      </span>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {currentStep === "completed" && (
            <div className="p-3 sm:p-4">
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                <div className="p-4 sm:p-6">
                  <Button
                    onClick={resetChat}
                    className="w-full h-14 sm:h-16 text-base sm:text-lg font-medium bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg transition-all duration-200 hover:scale-[1.02]"
                    size="lg"
                  >
                    🎉 Book Another Appointment
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
