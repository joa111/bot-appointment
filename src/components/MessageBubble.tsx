import { Message } from "@/components/AppointmentChatbot";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === "user";
  
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in px-2 sm:px-0`}
    >
      <div
        className={`
          max-w-[90%] sm:max-w-[85%] lg:max-w-[70%] rounded-2xl px-4 py-3 shadow-lg backdrop-blur-sm
          ${
            isUser
              ? "bg-gradient-to-br from-chat-user-bg to-primary/90 text-chat-user-fg animate-slide-in-right border border-primary/20"
              : "bg-gradient-to-br from-chat-bot-bg to-muted/50 text-chat-bot-fg animate-slide-in-left border border-border/30"
          }
          ${isUser ? "rounded-br-md" : "rounded-bl-md"}
          transition-all duration-200 hover:shadow-xl
        `}
      >
        <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line">
          {message.text}
        </p>
        <div className="flex justify-end mt-2">
          <span className={`text-xs opacity-70 ${isUser ? "text-chat-user-fg" : "text-chat-bot-fg"}`}>
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
      </div>
    </div>
  );
}