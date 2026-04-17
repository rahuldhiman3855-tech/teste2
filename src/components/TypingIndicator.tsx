import { Bot } from "lucide-react";

const TypingIndicator = () => {
  return (
    <div className="flex gap-4 py-6 px-4 bg-card animate-in fade-in slide-in-from-bottom-2">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-soft">
        <Bot className="w-5 h-5 text-primary-foreground" />
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium text-foreground">AI Assistant</p>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
