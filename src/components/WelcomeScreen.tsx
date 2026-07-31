import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, CheckCircle2 } from "lucide-react";

interface WelcomeScreenProps {
  onStartBooking: () => void;
  welcomeMessage?: string;
}

const steps = [
  { icon: User, label: "Tell us your full name" },
  { icon: Clock, label: "Pick a morning or afternoon slot" },
  { icon: Calendar, label: "Get your queue number instantly" },
  { icon: CheckCircle2, label: "Done — you're all set" },
];

export function WelcomeScreen({ onStartBooking, welcomeMessage }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen bg-background dot-grid flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm animate-fade-up" style={{ animationDelay: "0ms" }}>

        {/* Bot avatar */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <span className="text-primary text-xl font-bold font-ui tracking-tight">AB</span>
            </div>
            {/* Online dot */}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[hsl(var(--online-dot))] rounded-full border-2 border-background online-pulse" />
          </div>
        </div>

        {/* Headline */}
        <div className="text-center mb-7">
          <h1 className="text-2xl font-semibold text-foreground leading-tight mb-2">
            Book your appointment
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {welcomeMessage || "Quick and easy. Takes less than 2 minutes — no login needed."}
          </p>
        </div>

        {/* Steps */}
        <div className="bg-surface rounded-2xl border border-border/50 p-4 mb-6 space-y-3">
          {steps.map(({ icon: Icon, label }, i) => (
            <div
              key={i}
              className="flex items-center gap-3 animate-fade-up"
              style={{ animationDelay: `${80 + i * 60}ms`, animationFillMode: "both" }}
            >
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm text-foreground-sub leading-snug">{label}</span>
              <span className="ml-auto text-[11px] font-medium font-ui text-muted-foreground/60">
                {i + 1}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button
          id="start-booking-btn"
          onClick={onStartBooking}
          className="w-full h-12 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-primary/20"
        >
          Get started
        </Button>

        <p className="text-center text-xs text-muted-foreground/60 mt-4">
          Your data is handled securely
        </p>
      </div>
    </div>
  );
}