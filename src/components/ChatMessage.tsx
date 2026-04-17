import { cn } from "@/lib/utils";
import { Bot, User, FileText, ThumbsUp, ThumbsDown, ExternalLink, Copy, Check, Video, File, FileCode, BookOpen, Bookmark } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "@/components/CodeBlock";
import { Button } from "@/components/ui/button";
import { useSavedResponses } from "@/hooks/useSavedResponses";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  files?: File[];
  rating?: number;
  followUpQuestion?: string;
  relatedResources?: Array<{ title: string; url: string }>;
  onRating?: (delta: number) => void;
  onFollowUpClick?: (question: string) => void;
}

const ChatMessage = ({ 
  role, 
  content, 
  files, 
  rating, 
  followUpQuestion, 
  relatedResources,
  onRating,
  onFollowUpClick 
}: ChatMessageProps) => {
  const isAssistant = role === "assistant";
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveCategory, setSaveCategory] = useState("General");
  const { saveResponse, categories } = useSavedResponses();
  const { toast } = useToast();
  const { config } = useAgentConfig();

  const handleRating = (delta: number) => {
    onRating?.(delta);
    setFeedbackGiven(true);
    setTimeout(() => setFeedbackGiven(false), 3000);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (saveTitle.trim()) {
      saveResponse(content, saveTitle, saveCategory);
      toast({
        title: "Response saved",
        description: "You can view it in Saved Responses",
      });
      setSaveDialogOpen(false);
      setSaveTitle("");
      setSaveCategory("General");
    }
  };

  const getResourceIcon = (url: string) => {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerUrl.includes('vimeo.com') || lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm')) {
      return Video;
    }
    if (lowerUrl.endsWith('.pdf')) {
      return FileText;
    }
    if (lowerUrl.endsWith('.doc') || lowerUrl.endsWith('.docx')) {
      return File;
    }
    if (lowerUrl.includes('github.com') || lowerUrl.endsWith('.js') || lowerUrl.endsWith('.ts') || lowerUrl.endsWith('.tsx') || lowerUrl.endsWith('.jsx')) {
      return FileCode;
    }
    if (lowerUrl.includes('/docs') || lowerUrl.includes('/documentation') || lowerUrl.includes('/guide')) {
      return BookOpen;
    }
    return ExternalLink;
  };

  // Render markdown content with proper formatting
  const renderContent = (text: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-5 mb-3 text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-3 mb-2 text-foreground">{children}</h4>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="mb-3 leading-relaxed text-foreground/90">{children}</p>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-1 text-foreground/90">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-1 text-foreground/90">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="ml-2">{children}</li>
          ),
          // Code blocks
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match && !className;
            
            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground" {...props}>
                  {children}
                </code>
              );
            }
            
            return (
              <CodeBlock
                code={String(children).replace(/\n$/, "")}
                language={match ? match[1] : "text"}
              />
            );
          },
          pre: ({ children }) => <>{children}</>,
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border-collapse border border-border rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-border">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold text-foreground border-r border-border last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-foreground/90 border-r border-border last:border-r-0">
              {children}
            </td>
          ),
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-4 my-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          // Horizontal rule
          hr: () => <hr className="my-4 border-border" />,
          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    );
  };

  return (
    <div
      className={cn(
        "flex gap-4 py-6 px-4 animate-in fade-in slide-in-from-bottom-2 duration-500",
        isAssistant ? "bg-card" : "bg-background"
      )}
    >
      {!isAssistant && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-secondary">
          <User className="w-5 h-5 text-secondary-foreground" />
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-hidden">
        {!isAssistant && (
          <p className="text-sm font-medium text-foreground">You</p>
        )}
        {files && files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg text-xs border border-border"
              >
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-secondary-foreground">{file.name}</span>
              </div>
            ))}
          </div>
        )}
        {/* Related Resources */}
        {isAssistant && relatedResources && relatedResources.length > 0 && (
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {relatedResources.map((resource, idx) => {
              const ResourceIcon = getResourceIcon(resource.url);
              return (
                <a
                  key={idx}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-card hover:border-primary/50 transition-all duration-200 hover-scale"
                >
                  <ResourceIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-0.5" />
                  <span className="text-xs text-foreground/90 group-hover:text-foreground font-medium leading-relaxed">
                    {resource.title}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        <div className="prose prose-sm max-w-none text-foreground/90 leading-relaxed">
          {renderContent(content)}
        </div>

        {/* Follow-up Question */}
        {isAssistant && followUpQuestion && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 h-auto py-2 px-3 text-xs"
            onClick={() => onFollowUpClick?.(followUpQuestion)}
          >
            {followUpQuestion}
          </Button>
        )}

        {/* Community Ratings */}
        {isAssistant && onRating && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">Was this helpful?</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5"
              onClick={() => handleRating(1)}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              <span className="text-xs">{rating && rating > 0 ? rating : ""}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => handleRating(-1)}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-primary">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="text-xs">Copy</span>
                </>
              )}
            </Button>
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  <span className="text-xs">Save</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Response</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={saveTitle}
                      onChange={(e) => setSaveTitle(e.target.value)}
                      placeholder="Enter a title for this response"
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={saveCategory} onValueChange={setSaveCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSave} className="w-full">
                    Save Response
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            {feedbackGiven && (
              <span className="text-xs text-primary animate-in fade-in slide-in-from-left-2 duration-300">
                Thanks for your feedback!
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
