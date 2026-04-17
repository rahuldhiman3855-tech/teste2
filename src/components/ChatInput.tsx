import { useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Send, Paperclip, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface FileWithProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
}

interface ChatInputProps {
  onSendMessage: (message: string, files?: File[]) => void;
  disabled?: boolean;
}

const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(({ onSendMessage, disabled }, ref) => {
  const [message, setMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<FileWithProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const completedFiles = attachedFiles.filter(f => f.status === 'complete').map(f => f.file);
    if ((message.trim() || completedFiles.length > 0) && !disabled) {
      onSendMessage(message, completedFiles);
      setMessage("");
      setAttachedFiles([]);
    }
  };

  const simulateFileUpload = async (file: File, index: number) => {
    const uploadTime = Math.min(file.size / 50000, 2000); // Simulate upload time based on size
    const steps = 20;
    const increment = 100 / steps;
    const delay = uploadTime / steps;

    for (let i = 0; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, delay));
      setAttachedFiles(prev => 
        prev.map((f, idx) => 
          idx === index ? { ...f, progress: Math.min(i * increment, 100) } : f
        )
      );
    }

    setAttachedFiles(prev => 
      prev.map((f, idx) => 
        idx === index ? { ...f, status: 'complete' as const } : f
      )
    );
  };

  const validateAndAddFiles = async (files: File[]) => {
    const MAX_FILES = 5;
    const MAX_TOTAL_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    const ALLOWED_TEXT_TYPES = ['text/plain', 'application/json', 'text/csv', 'text/xml', 'application/xml'];
    const ALLOWED_EXTENSIONS = ['.txt', '.log', '.json', '.csv', '.xml', '.yml', '.yaml'];

    // Check file count
    if (attachedFiles.length + files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    // Validate files
    const validFiles: File[] = [];
    let totalSize = attachedFiles.reduce((sum, f) => sum + f.file.size, 0);

    for (const file of files) {
      // Check file type
      const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
      const isText = ALLOWED_TEXT_TYPES.includes(file.type);
      const hasAllowedExtension = ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));

      if (!isImage && !isText && !hasAllowedExtension) {
        toast.error(`${file.name}: Only images and text files allowed`);
        continue;
      }

      // Check total size
      if (totalSize + file.size > MAX_TOTAL_SIZE) {
        toast.error(`Total file size cannot exceed 5MB`);
        break;
      }

      validFiles.push(file);
      totalSize += file.size;
    }

    if (validFiles.length > 0) {
      const currentLength = attachedFiles.length;
      const newFiles: FileWithProgress[] = validFiles.map(file => ({
        file,
        progress: 0,
        status: 'uploading' as const
      }));
      
      setAttachedFiles(prev => [...prev, ...newFiles]);
      
      // Start upload simulation for each file
      validFiles.forEach((_, idx) => {
        simulateFileUpload(validFiles[idx], currentLength + idx);
      });
      
      toast.success(`Uploading ${validFiles.length} file(s)...`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndAddFiles(files);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    validateAndAddFiles(files);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="sticky bottom-0 bg-gradient-surface border-t border-border p-4 backdrop-blur-lg">
      <form 
        onSubmit={handleSubmit} 
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="container max-w-4xl mx-auto relative"
      >
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10 backdrop-blur-sm">
            <p className="text-primary font-medium">Drop files here (max 5 files, 5MB total)</p>
          </div>
        )}
        {attachedFiles.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {attachedFiles.map((fileWithProgress, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-card/50 px-3 py-2.5 rounded-lg border border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground truncate">
                      {fileWithProgress.file.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {(fileWithProgress.file.size / 1024).toFixed(1)} KB
                      </span>
                      {fileWithProgress.status === 'complete' && (
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                      <button
                        type="button"
                        onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                        className="text-muted-foreground hover:text-foreground transition-smooth flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {fileWithProgress.status === 'uploading' && (
                    <Progress value={fileWithProgress.progress} className="h-1.5" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="relative flex items-end gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about troubleshooting..."
            className="min-h-[60px] max-h-[200px] resize-none pr-24 bg-background border-border focus:border-primary focus:ring-primary shadow-soft transition-smooth"
            disabled={disabled}
          />
          <input
            type="file"
            id="file-upload"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept=".txt,.log,.json,.xml,.yaml,.yml,.csv,.png,.jpg,.jpeg,.gif,.webp,image/*"
          />
          <label
            htmlFor="file-upload"
            className="absolute bottom-2 right-12 cursor-pointer"
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 hover:bg-secondary transition-smooth"
              asChild
            >
              <div>
                <Paperclip className="h-4 w-4" />
              </div>
            </Button>
          </label>
          <Button
            type="submit"
            size="icon"
            disabled={
              (!message.trim() && attachedFiles.filter(f => f.status === 'complete').length === 0) || 
              disabled ||
              attachedFiles.some(f => f.status === 'uploading')
            }
            className="absolute bottom-2 right-2 h-9 w-9 bg-gradient-primary hover:opacity-90 shadow-soft transition-smooth"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift + Enter for new line • Drag & drop or attach files (max 5 files, 5MB total)
        </p>
      </form>
    </div>
  );
});

ChatInput.displayName = "ChatInput";

export default ChatInput;
