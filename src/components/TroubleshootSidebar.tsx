import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Zap,
  WifiOff,
  HardDrive,
  AlertCircle,
  RefreshCw,
  Terminal,
  HelpCircle,
  History,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatHistory } from "./ChatHistory";

interface QuickAction {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
}

interface FAQ {
  question: string;
  prompt: string;
}

const quickActions: QuickAction[] = [
  {
    title: "System Performance",
    icon: Zap,
    prompt: "My system is running slow. Help me diagnose performance issues.",
  },
  {
    title: "Network Issues",
    icon: WifiOff,
    prompt: "I'm having connectivity problems. Help me troubleshoot my network.",
  },
  {
    title: "Disk Space",
    icon: HardDrive,
    prompt: "I'm running out of disk space. Help me free up storage.",
  },
  {
    title: "Error Diagnostics",
    icon: AlertCircle,
    prompt: "I'm getting an error message. Help me understand and fix it.",
  },
  {
    title: "Update Problems",
    icon: RefreshCw,
    prompt: "I'm having issues with system updates. Help me resolve them.",
  },
  {
    title: "Command Line Help",
    icon: Terminal,
    prompt: "I need help with command line troubleshooting.",
  },
];

const faqs: FAQ[] = [
  {
    question: "How to check system logs?",
    prompt: "Show me how to check system logs for troubleshooting.",
  },
  {
    question: "What if my app won't start?",
    prompt: "My application won't start. What should I check?",
  },
  {
    question: "How to reset network settings?",
    prompt: "Guide me through resetting my network settings.",
  },
  {
    question: "Safe mode troubleshooting",
    prompt: "How do I use safe mode for troubleshooting?",
  },
];

interface TroubleshootSidebarProps {
  onQuickAction: (prompt: string) => void;
  currentSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onNewChat?: () => void;
}

export function TroubleshootSidebar({ 
  onQuickAction, 
  currentSessionId,
  onSelectSession,
  onNewChat 
}: TroubleshootSidebarProps) {
  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Assistant</h2>
      </SidebarHeader>
      
      <SidebarContent className="flex flex-col h-full">
        <Tabs defaultValue="actions" className="flex flex-col h-full">
          <TabsList className="mx-2 mt-2 grid w-auto grid-cols-2">
            <TabsTrigger value="actions" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Actions
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <History className="h-3 w-3 mr-1" />
              History
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="actions" className="flex-1 mt-0">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs text-muted-foreground">
                Common Issues
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {quickActions.map((action) => (
                    <SidebarMenuItem key={action.title}>
                      <SidebarMenuButton
                        onClick={() => onQuickAction(action.prompt)}
                        className="hover:bg-secondary/50 transition-smooth"
                      >
                        <action.icon className="h-4 w-4" />
                        <span className="text-sm">{action.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="text-xs text-muted-foreground flex items-center gap-2">
                <HelpCircle className="h-3 w-3" />
                FAQs
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {faqs.map((faq) => (
                    <SidebarMenuItem key={faq.question}>
                      <SidebarMenuButton
                        onClick={() => onQuickAction(faq.prompt)}
                        className="hover:bg-secondary/50 transition-smooth text-xs"
                      >
                        <span>{faq.question}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </TabsContent>
          
          <TabsContent value="history" className="flex-1 mt-0 overflow-hidden">
            <ChatHistory 
              currentSessionId={currentSessionId || null}
              onSelectSession={onSelectSession || (() => {})}
              onNewChat={onNewChat || (() => {})}
            />
          </TabsContent>
        </Tabs>
      </SidebarContent>
    </Sidebar>
  );
}
