import { Bot, Moon, Sun, Keyboard, Trash2, Bookmark } from "lucide-react";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatHeaderProps {
  onShowShortcuts?: () => void;
  onClearChat?: () => void;
}

const ChatHeader = ({ onShowShortcuts, onClearChat }: ChatHeaderProps) => {
  const { theme, setTheme } = useTheme();
  const { config } = useAgentConfig();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3 flex-1">
      {config.logo_url ? (
        <img 
          src={config.logo_url} 
          alt={config.agent_name}
          className="w-8 h-8 rounded-lg object-cover shadow-soft"
        />
      ) : (
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center shadow-soft"
          style={{ background: `linear-gradient(135deg, ${config.primary_color}, ${config.primary_color})` }}
        >
          <Bot className="w-5 h-5 text-primary-foreground" />
        </div>
      )}
      <div className="flex-1">
        <h1 className="text-base font-semibold text-foreground">
          {config.agent_name}
        </h1>
        <p className="text-xs text-muted-foreground hidden sm:block">
          {config.agent_tagline}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/saved")}
              className="h-9 w-9"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Saved responses</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearChat}
              className="h-9 w-9"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Clear chat (Ctrl+N)</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowShortcuts}
              className="h-9 w-9"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Keyboard shortcuts (Ctrl+?)</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-9 w-9"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Toggle theme (Ctrl+D)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default ChatHeader;
