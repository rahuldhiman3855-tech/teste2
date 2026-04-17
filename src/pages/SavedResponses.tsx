import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSavedResponses } from '@/hooks/useSavedResponses';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Search, 
  Trash2, 
  Edit, 
  Calendar,
  FolderPlus,
  X,
  Share2,
  Link,
  Loader2,
  LogOut,
  Copy,
  Check
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import CodeBlock from '@/components/CodeBlock';
import { useToast } from '@/hooks/use-toast';

const SavedResponses = () => {
  const navigate = useNavigate();
  const { savedResponses, categories, loading, deleteResponse, updateResponse, addCategory, generateShareLink, revokeShareLink } = useSavedResponses();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredResponses = savedResponses.filter(response => {
    const matchesSearch = response.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         response.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || response.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (id: string, title: string, category: string) => {
    setEditingId(id);
    setEditTitle(title);
    setEditCategory(category);
  };

  const handleSaveEdit = () => {
    if (editingId) {
      updateResponse(editingId, { title: editTitle, category: editCategory });
      setEditingId(null);
    }
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const colors = ['bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      addCategory(newCategoryName, randomColor);
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const handleShare = async (id: string) => {
    setGeneratingLinkFor(id);
    const link = await generateShareLink(id);
    setGeneratingLinkFor(null);
    
    if (link) {
      await navigator.clipboard.writeText(link);
      toast({
        title: 'Share link created!',
        description: 'Link copied to clipboard',
      });
    } else {
      toast({
        title: 'Failed to create share link',
        variant: 'destructive',
      });
    }
  };

  const handleCopyLink = async (token: string) => {
    const link = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: 'Link copied!',
    });
  };

  const handleRevokeShare = async (id: string) => {
    await revokeShareLink(id);
    toast({
      title: 'Share link revoked',
    });
  };

  const handleSignOut = async () => {
    navigate('/');
  };

  const parseContent = (content: string) => {
    const parts = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index)
        });
      }
      parts.push({
        type: 'code',
        language: match[1] || 'text',
        content: match[2].trim()
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }

    return parts;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Saved Responses</h1>
          <Badge variant="secondary" className="ml-auto">
            {filteredResponses.length} saved
          </Badge>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search saved responses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <FolderPlus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Category Name</Label>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter category name"
                  />
                </div>
                <Button onClick={handleAddCategory} className="w-full">
                  Add Category
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-4">
            {filteredResponses.map(response => {
              const category = categories.find(c => c.name === response.category);
              const isEditing = editingId === response.id;
              const contentParts = parseContent(response.content);

              return (
                <Card key={response.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {isEditing ? (
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="mb-2"
                          />
                        ) : (
                          <CardTitle className="text-lg">{response.title}</CardTitle>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {isEditing ? (
                            <Select value={editCategory} onValueChange={setEditCategory}>
                              <SelectTrigger className="w-40">
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
                          ) : (
                            <Badge variant="secondary" className={category?.color}>
                              {response.category}
                            </Badge>
                          )}
                          {response.is_public && (
                            <Badge variant="outline" className="gap-1">
                              <Link className="h-3 w-3" />
                              Shared
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(response.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={handleSaveEdit}>
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {response.is_public && response.share_token ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyLink(response.share_token!)}
                                >
                                  {copiedId === response.share_token ? (
                                    <Check className="h-4 w-4 text-primary" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRevokeShare(response.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleShare(response.id)}
                                disabled={generatingLinkFor === response.id}
                              >
                                {generatingLinkFor === response.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Share2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(response.id, response.title, response.category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteResponse(response.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {contentParts.map((part, idx) => (
                        part.type === 'code' ? (
                          <CodeBlock
                            key={idx}
                            code={part.content}
                            language={part.language}
                          />
                        ) : (
                          <p key={idx} className="text-sm text-foreground whitespace-pre-wrap">
                            {part.content}
                          </p>
                        )
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredResponses.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No saved responses found
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default SavedResponses;
