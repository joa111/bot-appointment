import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, User, CheckCircle } from "lucide-react";

interface WelcomeScreenProps {
  onStartBooking: () => void;
}

export function WelcomeScreen({ onStartBooking }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-card border-border shadow-lg animate-fade-in">
        <div className="p-8 text-center">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Welcome to AppointmentBot Pro! 🤖
            </h1>
            <p className="text-lg text-muted-foreground">
              Your friendly AI assistant for quick and easy appointment booking
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="flex items-center space-x-3 p-4 bg-muted rounded-lg">
              <User className="h-6 w-6 text-primary" />
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Personal Details</h3>
                <p className="text-sm text-muted-foreground">
                  We'll collect your name safely
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-muted rounded-lg">
              <Clock className="h-6 w-6 text-primary" />
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Time Selection</h3>
                <p className="text-sm text-muted-foreground">
                  Choose morning or afternoon
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-muted rounded-lg">
              <Calendar className="h-6 w-6 text-primary" />
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Queue Number</h3>
                <p className="text-sm text-muted-foreground">
                  Get your unique position
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-muted rounded-lg">
              <CheckCircle className="h-6 w-6 text-primary" />
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Confirmation</h3>
                <p className="text-sm text-muted-foreground">
                  Instant booking confirmation
                </p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-8 p-6 bg-primary/5 rounded-lg border border-primary/20">
            <h3 className="font-semibold text-foreground mb-3">How it works:</h3>
            <div className="text-left space-y-2 text-muted-foreground">
              <p className="flex items-center">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">1</span>
                Tell me your full name (first and last name)
              </p>
              <p className="flex items-center">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">2</span>
                Select your preferred time slot
              </p>
              <p className="flex items-center">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">3</span>
                Receive your queue number and confirmation
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            onClick={onStartBooking}
            size="lg"
            className="w-full md:w-auto px-8 py-3 text-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 hover:scale-105"
          >
            🚀 Start Booking My Appointment
          </Button>

          <p className="mt-4 text-sm text-muted-foreground">
            The whole process takes less than 2 minutes!
          </p>
        </div>
      </Card>
    </div>
  );
}