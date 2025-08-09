export function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in px-2 sm:px-0">
      <div className="bg-gradient-to-br from-chat-bot-bg to-muted/50 text-chat-bot-fg rounded-2xl rounded-bl-md px-4 py-3 shadow-lg backdrop-blur-sm animate-slide-in-left border border-border/30">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-chat-typing font-medium">AppointmentBot is typing</span>
          <div className="flex space-x-1">
            <div 
              className="w-2 h-2 bg-chat-typing rounded-full animate-typing-dots shadow-sm"
              style={{ animationDelay: "0ms" }}
            ></div>
            <div 
              className="w-2 h-2 bg-chat-typing rounded-full animate-typing-dots shadow-sm"
              style={{ animationDelay: "200ms" }}
            ></div>
            <div 
              className="w-2 h-2 bg-chat-typing rounded-full animate-typing-dots shadow-sm"
              style={{ animationDelay: "400ms" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}