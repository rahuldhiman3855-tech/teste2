import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import CodeBlock from '@/components/CodeBlock';

interface SharedResponse {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

const SharedResponse = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [response, setResponse] = useState<SharedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSharedResponse = async () => {
      if (!token) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('saved_responses')
        .select('id, title, content, created_at')
        .eq('share_token', token)
        .eq('is_public', true)
        .maybeSingle();

      if (fetchError) {
        setError('Failed to load response');
      } else if (!data) {
        setError('Response not found or no longer shared');
      } else {
        setResponse(data);
      }
      setLoading(false);
    };

    fetchSharedResponse();
  }, [token]);

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

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  if (!response) return null;

  const contentParts = parseContent(response.content);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Shared Response</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{response.title}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">Shared</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(response.created_at).toLocaleDateString()}
              </span>
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
      </div>
    </div>
  );
};

export default SharedResponse;
