export function TypingIndicator() {
  return (
    <div className="flex justify-start px-3 animate-fade-in">
      {/* Bot avatar */}
      <div className="flex-shrink-0 mt-auto mb-1 mr-2">
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <span className="text-primary text-[10px] font-semibold font-ui">AB</span>
        </div>
      </div>

      {/* Dots bubble */}
      <div className="bg-chat-bot-bg rounded-[14px] rounded-bl-[4px] px-4 py-3.5 flex items-center gap-[5px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[6px] h-[6px] rounded-full bg-chat-dot animate-typing-dot"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}