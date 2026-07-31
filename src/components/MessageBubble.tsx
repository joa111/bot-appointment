import { Message } from "@/components/AppointmentChatbot";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === "user";

  return (
    <div
      className={`message-group flex ${isUser ? "justify-end" : "justify-start"} px-3`}
    >
      {/* Bot avatar dot */}
      {!isUser && (
        <div className="flex-shrink-0 mt-auto mb-1 mr-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-primary text-[10px] font-semibold font-ui">AB</span>
          </div>
        </div>
      )}

      <div
        className={`
          flex flex-col max-w-[78%]
          ${isUser ? "items-end animate-message-in-right" : "items-start animate-message-in"}
        `}
        style={{ animationFillMode: "both" }}
      >
        <div
          className={`
            px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line
            ${isUser
              ? "bg-chat-user-bg text-chat-user-fg rounded-[14px] rounded-br-[4px]"
              : "bg-chat-bot-bg text-chat-bot-fg rounded-[14px] rounded-bl-[4px]"
            }
          `}
        >
          {message.text}
        </div>
        <span className="msg-timestamp text-[11px] text-muted-foreground mt-1 px-1 font-ui">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}