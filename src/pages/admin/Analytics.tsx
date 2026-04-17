import React, { useEffect, useState, useMemo } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, CalendarIcon, Users, TrendingUp, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, RefreshCw, Type, MessageCircleQuestion, HelpCircle, Shield, Ban, AlertTriangle, ThumbsUp, ThumbsDown, Percent, TrendingDown } from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay, parseISO, subDays, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'Technical Issues': ['error', 'bug', 'issue', 'problem', 'fix', 'broken', 'not working'],
  'How To': ['how to', 'how do', 'how can', 'steps', 'guide', 'tutorial'],
  'Account & Login': ['login', 'password', 'account', 'sign in', 'register', 'forgot'],
  'Features': ['feature', 'functionality', 'can it', 'does it', 'support'],
  'Pricing': ['price', 'cost', 'plan', 'subscription', 'billing', 'payment'],
  'Integration': ['integrate', 'api', 'connect', 'sync', 'import', 'export'],
  'General Inquiry': ['what is', 'tell me', 'explain', 'help', 'information'],
};

const ITEMS_PER_PAGE = 10;

const Analytics = () => {
  const { chatLogs, stats, feedbackLogs, fetchDashboardData } = useAdmin();
  const [feedbackTrendView, setFeedbackTrendView] = useState<'daily' | 'weekly'>('daily');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topicPage, setTopicPage] = useState(1);
  const [unansweredPage, setUnansweredPage] = useState(1);
  const [safetyPage, setSafetyPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filter chat logs based on date range
  const filteredChatLogs = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return chatLogs;
    
    return chatLogs.filter(chat => {
      const chatDate = new Date(chat.created_at);
      if (dateRange.from && dateRange.to) {
        return isWithinInterval(chatDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to),
        });
      }
      if (dateRange.from) {
        return chatDate >= startOfDay(dateRange.from);
      }
      if (dateRange.to) {
        return chatDate <= endOfDay(dateRange.to);
      }
      return true;
    });
  }, [chatLogs, dateRange]);

  // Group chats by user session (user_id)
  const sessions = useMemo(() => {
    const sessionMap = new Map<string, {
      userId: string;
      userEmail: string;
      queries: typeof filteredChatLogs;
      firstQuery: Date;
      lastQuery: Date;
    }>();

    filteredChatLogs.forEach(chat => {
      const sessionId = chat.user_id || 'anonymous';
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          userId: chat.user_id || 'anonymous',
          userEmail: chat.user_email || 'Anonymous',
          queries: [],
          firstQuery: new Date(chat.created_at),
          lastQuery: new Date(chat.created_at),
        });
      }
      const session = sessionMap.get(sessionId)!;
      session.queries.push(chat);
      const chatDate = new Date(chat.created_at);
      if (chatDate < session.firstQuery) session.firstQuery = chatDate;
      if (chatDate > session.lastQuery) session.lastQuery = chatDate;
    });

    return Array.from(sessionMap.values()).sort((a, b) => 
      b.lastQuery.getTime() - a.lastQuery.getTime()
    );
  }, [filteredChatLogs]);

  // Paginated sessions
  const paginatedSessions = useMemo(() => {
    const total = sessions.length;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const startIndex = (sessionsPage - 1) * ITEMS_PER_PAGE;
    const items = sessions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    return { items, total, totalPages };
  }, [sessions, sessionsPage]);

  // Calculate overview stats
  const overviewStats = useMemo(() => {
    const totalQueries = filteredChatLogs.length;
    const uniqueSessions = sessions.length;
    const avgQueriesPerSession = uniqueSessions > 0 
      ? (totalQueries / uniqueSessions).toFixed(1) 
      : '0';

    return {
      totalQueries,
      uniqueSessions,
      avgQueriesPerSession,
    };
  }, [filteredChatLogs, sessions]);

  // Helper function to get topic for a message
  const getTopicForMessage = (message: string): string => {
    const lowerMessage = message.toLowerCase();
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        return topic;
      }
    }
    return 'Other';
  };

  // Top queried topics (based on common words/patterns in queries)
  const topTopics = useMemo(() => {
    const topicCounts: Record<string, number> = {};

    filteredChatLogs.forEach(chat => {
      const topic = getTopicForMessage(chat.user_message);
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    return Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredChatLogs]);

  // Query Volume Trend data (daily queries and unique users)
  const queryVolumeTrend = useMemo(() => {
    const dailyData: Record<string, { date: string; queries: number; users: Set<string> }> = {};

    filteredChatLogs.forEach(chat => {
      const dateKey = format(new Date(chat.created_at), "yyyy-MM-dd");
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { date: dateKey, queries: 0, users: new Set() };
      }
      dailyData[dateKey].queries++;
      dailyData[dateKey].users.add(chat.user_id || 'anonymous');
    });

    return Object.values(dailyData)
      .map(d => ({
        date: format(parseISO(d.date), "MMM d"),
        queries: d.queries,
        users: d.users.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredChatLogs]);

  // Response Confidence distribution (simulated based on response length as proxy)
  const confidenceDistribution = useMemo(() => {
    const buckets = [
      { range: 'Low (0-40%)', min: 0, max: 40, count: 0, color: 'hsl(var(--destructive))' },
      { range: 'Medium (40-70%)', min: 40, max: 70, count: 0, color: 'hsl(var(--warning, 45 93% 47%))' },
      { range: 'High (70-90%)', min: 70, max: 90, count: 0, color: 'hsl(var(--primary))' },
      { range: 'Very High (90-100%)', min: 90, max: 100, count: 0, color: 'hsl(var(--chart-2, 160 60% 45%))' },
    ];

    filteredChatLogs.forEach(chat => {
      // Simulate confidence based on response characteristics
      const responseLength = chat.ai_response?.length || 0;
      const hasCode = chat.ai_response?.includes('```');
      const hasList = chat.ai_response?.includes('\n-') || chat.ai_response?.includes('\n•');
      
      let confidence = Math.min(95, 40 + (responseLength / 50) + (hasCode ? 15 : 0) + (hasList ? 10 : 0));
      confidence = Math.max(10, Math.min(100, confidence + (Math.random() * 20 - 10)));

      const bucket = buckets.find(b => confidence >= b.min && confidence < b.max) || buckets[buckets.length - 1];
      bucket.count++;
    });

    return buckets;
  }, [filteredChatLogs]);

  // Get queries for selected topic with pagination
  const topicQueries = useMemo(() => {
    if (!selectedTopic) return { queries: [], total: 0, totalPages: 0 };

    const allTopicQueries = filteredChatLogs.filter(chat => 
      getTopicForMessage(chat.user_message) === selectedTopic
    );

    const total = allTopicQueries.length;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const startIndex = (topicPage - 1) * ITEMS_PER_PAGE;
    const queries = allTopicQueries.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return { queries, total, totalPages };
  }, [filteredChatLogs, selectedTopic, topicPage]);

  // Query Insight: New vs Returning Queries
  const newVsReturningStats = useMemo(() => {
    const queryMap = new Map<string, number>();
    
    filteredChatLogs.forEach(chat => {
      const normalizedQuery = chat.user_message.toLowerCase().trim();
      queryMap.set(normalizedQuery, (queryMap.get(normalizedQuery) || 0) + 1);
    });

    const newQueries = Array.from(queryMap.values()).filter(count => count === 1).length;
    const returningQueries = filteredChatLogs.length - newQueries;
    const returningPercentage = filteredChatLogs.length > 0 
      ? Math.round((returningQueries / filteredChatLogs.length) * 100) 
      : 0;

    return { newQueries, returningQueries, returningPercentage };
  }, [filteredChatLogs]);

  // Query Insight: Average Query Length
  const avgQueryLength = useMemo(() => {
    if (filteredChatLogs.length === 0) return 0;
    
    const totalWords = filteredChatLogs.reduce((sum, chat) => {
      const words = chat.user_message.trim().split(/\s+/).length;
      return sum + words;
    }, 0);

    return (totalWords / filteredChatLogs.length).toFixed(1);
  }, [filteredChatLogs]);

  // Query Insight: Follow-up Rate
  const followUpRate = useMemo(() => {
    if (sessions.length === 0) return { rate: 0, count: 0 };
    
    const sessionsWithFollowUp = sessions.filter(session => session.queries.length > 1).length;
    const rate = Math.round((sessionsWithFollowUp / sessions.length) * 100);

    return { rate, count: sessionsWithFollowUp };
  }, [sessions]);

  // Unanswered Queries (low confidence responses)
  const unansweredQueries = useMemo(() => {
    const lowConfidenceQueries = filteredChatLogs.filter(chat => {
      const responseLength = chat.ai_response?.length || 0;
      const hasApology = chat.ai_response?.toLowerCase().includes("sorry") || 
                         chat.ai_response?.toLowerCase().includes("i don't know") ||
                         chat.ai_response?.toLowerCase().includes("i'm not sure") ||
                         chat.ai_response?.toLowerCase().includes("cannot") ||
                         chat.ai_response?.toLowerCase().includes("unable to");
      const isShort = responseLength < 100;
      const hasQuestion = chat.ai_response?.includes("?");
      
      return (hasApology || isShort) && hasQuestion;
    });

    const total = lowConfidenceQueries.length;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const startIndex = (unansweredPage - 1) * ITEMS_PER_PAGE;
    const queries = lowConfidenceQueries.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return { queries, total, totalPages };
  }, [filteredChatLogs, unansweredPage]);

  // Safety & Compliance: Guardrail Violations
  const guardrailViolations = useMemo(() => {
    const violationPatterns = [
      { pattern: /jailbreak|ignore.*instructions|bypass/i, type: 'Jailbreak Attempt' },
      { pattern: /pretend.*you.*are|act.*as.*if|roleplay/i, type: 'Role Override' },
      { pattern: /hack|exploit|vulnerability/i, type: 'Security Probe' },
      { pattern: /illegal|harmful|dangerous/i, type: 'Harmful Content' },
    ];

    const violations = filteredChatLogs.filter(chat => {
      return violationPatterns.some(v => v.pattern.test(chat.user_message));
    }).map(chat => {
      const matchedPattern = violationPatterns.find(v => v.pattern.test(chat.user_message));
      return {
        ...chat,
        violationType: matchedPattern?.type || 'Unknown'
      };
    });

    return { 
      count: violations.length, 
      violations,
      byType: violationPatterns.reduce((acc, p) => {
        acc[p.type] = violations.filter(v => v.violationType === p.type).length;
        return acc;
      }, {} as Record<string, number>)
    };
  }, [filteredChatLogs]);

  // Safety & Compliance: Blocked Responses
  const blockedResponses = useMemo(() => {
    const blockedPatterns = [
      /i cannot|i'm unable|i won't|i can't help with/i,
      /not appropriate|against.*policy|violates.*guidelines/i,
      /refuse to|declining to|won't be able to/i,
    ];

    const blocked = filteredChatLogs.filter(chat => {
      return blockedPatterns.some(p => p.test(chat.ai_response || ''));
    });

    return { count: blocked.length, responses: blocked };
  }, [filteredChatLogs]);

  // Safety & Compliance: PII Detection Alerts
  const piiAlerts = useMemo(() => {
    const piiPatterns = [
      { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, type: 'Phone Number' },
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, type: 'Email Address' },
      { pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/, type: 'SSN' },
      { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, type: 'Credit Card' },
      { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, type: 'IP Address' },
    ];

    const alerts = filteredChatLogs.filter(chat => {
      return piiPatterns.some(p => p.pattern.test(chat.user_message) || p.pattern.test(chat.ai_response || ''));
    }).map(chat => {
      const detectedTypes: string[] = [];
      piiPatterns.forEach(p => {
        if (p.pattern.test(chat.user_message) || p.pattern.test(chat.ai_response || '')) {
          detectedTypes.push(p.type);
        }
      });
      return { ...chat, piiTypes: detectedTypes };
    });

    const total = alerts.length;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const startIndex = (safetyPage - 1) * ITEMS_PER_PAGE;
    const pagedAlerts = alerts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return { 
      count: total, 
      alerts: pagedAlerts, 
      totalPages,
      byType: piiPatterns.reduce((acc, p) => {
        acc[p.type] = alerts.filter(a => a.piiTypes.includes(p.type)).length;
        return acc;
      }, {} as Record<string, number>)
    };
  }, [filteredChatLogs, safetyPage]);

  // Feedback Stats
  const feedbackStats = useMemo(() => {
    const totalConversations = sessions.length;
    const conversationsWithFeedback = stats.thumbsUpCount + stats.thumbsDownCount;
    const feedbackRate = totalConversations > 0 
      ? Math.round((conversationsWithFeedback / totalConversations) * 100) 
      : 0;
    const netScore = stats.thumbsUpCount - stats.thumbsDownCount;

    return {
      thumbsUp: stats.thumbsUpCount,
      thumbsDown: stats.thumbsDownCount,
      feedbackRate,
      netScore,
      totalWithFeedback: conversationsWithFeedback
    };
  }, [stats, sessions]);

  // Feedback Trend Data (daily/weekly) - using real feedback data
  const feedbackTrendData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i);
      return {
        date,
        dateStr: format(date, "yyyy-MM-dd"),
        displayDate: format(date, "MMM d"),
        thumbsUp: 0,
        thumbsDown: 0
      };
    });

    // Use real feedback data from feedbackLogs
    feedbackLogs.forEach((feedback) => {
      const feedbackDate = format(new Date(feedback.created_at), "yyyy-MM-dd");
      const dayData = last30Days.find(d => d.dateStr === feedbackDate);
      if (dayData) {
        if (feedback.rating === 'thumbs_up') dayData.thumbsUp++;
        if (feedback.rating === 'thumbs_down') dayData.thumbsDown++;
      }
    });

    if (feedbackTrendView === 'weekly') {
      // Group by week
      const weeklyData: Record<string, { week: string; thumbsUp: number; thumbsDown: number }> = {};
      last30Days.forEach(day => {
        const weekStart = format(startOfWeek(day.date, { weekStartsOn: 1 }), "MMM d");
        if (!weeklyData[weekStart]) {
          weeklyData[weekStart] = { week: weekStart, thumbsUp: 0, thumbsDown: 0 };
        }
        weeklyData[weekStart].thumbsUp += day.thumbsUp;
        weeklyData[weekStart].thumbsDown += day.thumbsDown;
      });
      return Object.values(weeklyData).map(w => ({
        date: w.week,
        thumbsUp: w.thumbsUp,
        thumbsDown: w.thumbsDown,
        net: w.thumbsUp - w.thumbsDown
      }));
    }

    return last30Days.slice(-14).map(d => ({
      date: d.displayDate,
      thumbsUp: d.thumbsUp,
      thumbsDown: d.thumbsDown,
      net: d.thumbsUp - d.thumbsDown
    }));
  }, [feedbackLogs, feedbackTrendView]);

  const clearDateFilter = () => {
    setDateRange({ from: undefined, to: undefined });
  };

  const toggleSession = (userId: string) => {
    setExpandedSession(expandedSession === userId ? null : userId);
  };

  const handleTopicClick = (topic: string) => {
    setSelectedTopic(topic);
    setTopicPage(1);
  };

  const closeTopic = () => {
    setSelectedTopic(null);
    setTopicPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Chat history and conversation insights</p>
        </div>
        
        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal min-w-[130px]",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? format(dateRange.from, "MMM d, yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="start">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">-</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal min-w-[130px]",
                  !dateRange.to && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.to ? format(dateRange.to, "MMM d, yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="start">
              <Calendar
                mode="single"
                selected={dateRange.to}
                onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {(dateRange.from || dateRange.to) && (
            <Button variant="ghost" size="sm" onClick={clearDateFilter}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insights">Query Insight</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="safety">Safety & Compliance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
        
        {/* Metrics Tiles */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Total Queries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewStats.totalQueries}</div>
              <p className="text-xs text-muted-foreground mt-1">
                User queries received in selected period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Unique Users / Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewStats.uniqueSessions}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Distinct users interacting with the agent
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Avg Queries per Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewStats.avgQueriesPerSession}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Measures how engaging the agent is
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Query Volume Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Query Volume Trend</CardTitle>
              <CardDescription>Daily queries and unique users</CardDescription>
            </CardHeader>
            <CardContent>
              {queryVolumeTrend.length > 0 ? (
                <ChartContainer
                  config={{
                    queries: { label: "Queries", color: "hsl(var(--primary))" },
                    users: { label: "Users", color: "hsl(var(--chart-2, 160 60% 45%))" },
                  }}
                  className="h-[200px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={queryVolumeTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="queries"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="hsl(var(--chart-2, 160 60% 45%))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--chart-2, 160 60% 45%))", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Response Confidence Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Response Confidence</CardTitle>
              <CardDescription>Distribution of confidence scores</CardDescription>
            </CardHeader>
            <CardContent>
              {confidenceDistribution.some(d => d.count > 0) ? (
                <ChartContainer
                  config={{
                    count: { label: "Count", color: "hsl(var(--primary))" },
                  }}
                  className="h-[200px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={confidenceDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="range" type="category" tick={{ fontSize: 10 }} width={100} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {confidenceDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

          {/* Sessions Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sessions</CardTitle>
                  <CardDescription>Click on a session to view queries ({paginatedSessions.total} total)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>First Query</TableHead>
                    <TableHead>Total Queries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSessions.items.map((session) => (
                    <React.Fragment key={session.userId}>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSession(session.userId)}
                      >
                        <TableCell>
                          {expandedSession === session.userId ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium font-mono text-xs">
                          {session.userId.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(session.firstQuery, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                          {session.queries[session.queries.length - 1]?.user_message || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{session.queries.length}</Badge>
                        </TableCell>
                      </TableRow>
                      {expandedSession === session.userId && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30 p-0">
                            <div className="p-4 space-y-3">
                              {session.queries.map((query) => (
                                <div key={query.id} className="border border-border rounded-lg p-3 bg-background">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(query.created_at), "MMM d, yyyy HH:mm")}
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="bg-secondary/50 rounded p-2">
                                      <p className="text-xs font-medium mb-1">User:</p>
                                      <p className="text-sm text-muted-foreground">{query.user_message}</p>
                                    </div>
                                    <div className="bg-primary/10 rounded p-2">
                                      <p className="text-xs font-medium mb-1">AI Response:</p>
                                      <p className="text-sm text-muted-foreground line-clamp-3">{query.ai_response}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                  {paginatedSessions.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-muted-foreground">No sessions found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {paginatedSessions.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((sessionsPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(sessionsPage * ITEMS_PER_PAGE, paginatedSessions.total)} of {paginatedSessions.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSessionsPage(p => Math.max(1, p - 1))}
                      disabled={sessionsPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {sessionsPage} of {paginatedSessions.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSessionsPage(p => Math.min(paginatedSessions.totalPages, p + 1))}
                      disabled={sessionsPage === paginatedSessions.totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Query Insight Tab */}
        <TabsContent value="insights" className="space-y-4">
          {/* Insight Tiles */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  New vs. Returning Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{newVsReturningStats.returningPercentage}% Returning</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {newVsReturningStats.newQueries} new, {newVsReturningStats.returningQueries} repeated questions
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Type className="h-4 w-4 text-primary" />
                  Avg Query Length
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgQueryLength} words</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average words per user query
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageCircleQuestion className="h-4 w-4 text-primary" />
                  Follow-up Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{followUpRate.rate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {followUpRate.count} sessions with follow-up questions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Unanswered Queries Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-destructive" />
                Unanswered Queries
              </CardTitle>
              <CardDescription>Questions the agent couldn't confidently answer</CardDescription>
            </CardHeader>
            <CardContent>
              {unansweredQueries.total > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>User Query</TableHead>
                        <TableHead>AI Response</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unansweredQueries.queries.map((query) => (
                        <TableRow key={query.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(query.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="text-sm truncate">{query.user_message}</p>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="text-sm text-muted-foreground truncate">{query.ai_response}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {unansweredQueries.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                      <p className="text-sm text-muted-foreground">
                        Page {unansweredPage} of {unansweredQueries.totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUnansweredPage(p => Math.max(1, p - 1))}
                          disabled={unansweredPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUnansweredPage(p => Math.min(unansweredQueries.totalPages, p + 1))}
                          disabled={unansweredPage === unansweredQueries.totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No unanswered queries found</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Queried Topics */}
          <Card>
            <CardHeader>
              <CardTitle>Top Queried Topics</CardTitle>
              <CardDescription>Click on a topic to view all queries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topTopics.map((item) => (
                  <div 
                    key={item.topic} 
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleTopicClick(item.topic)}
                  >
                    <span className="font-medium text-sm">{item.topic}</span>
                    <Badge variant="outline">{item.count}</Badge>
                  </div>
                ))}
                {topTopics.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No topics data available
                  </div>
                )}
              </div>

              {/* Topic Queries Table */}
              {selectedTopic && (
                <div className="mt-6 border border-border rounded-lg">
                  <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                    <div>
                      <h3 className="font-semibold">{selectedTopic}</h3>
                      <p className="text-sm text-muted-foreground">
                        {topicQueries.total} queries found
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={closeTopic}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>User Query</TableHead>
                        <TableHead>AI Response</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topicQueries.queries.map((query) => (
                        <TableRow key={query.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(query.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="text-sm truncate">{query.user_message}</p>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="text-sm text-muted-foreground truncate">{query.ai_response}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {topicQueries.totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        Page {topicPage} of {topicQueries.totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTopicPage(p => Math.max(1, p - 1))}
                          disabled={topicPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTopicPage(p => Math.min(topicQueries.totalPages, p + 1))}
                          disabled={topicPage === topicQueries.totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="space-y-4">
          {/* Feedback Metrics Tiles */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-chart-2" />
                  Positive Responses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-chart-2">{feedbackStats.thumbsUp}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Positive feedback received
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-destructive" />
                  Negative Responses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{feedbackStats.thumbsDown}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Negative feedback received
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  Feedback Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{feedbackStats.feedbackRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Conversations with feedback
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {feedbackStats.netScore >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-chart-2" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  Net Feedback Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "text-2xl font-bold",
                  feedbackStats.netScore >= 0 ? "text-chart-2" : "text-destructive"
                )}>
                  {feedbackStats.netScore >= 0 ? '+' : ''}{feedbackStats.netScore}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Up − Down score
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feedback Trend Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Feedback Trend Analysis</CardTitle>
                  <CardDescription>Feedback distribution over time</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={feedbackTrendView === 'daily' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFeedbackTrendView('daily')}
                  >
                    Daily
                  </Button>
                  <Button
                    variant={feedbackTrendView === 'weekly' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFeedbackTrendView('weekly')}
                  >
                    Weekly
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {feedbackTrendData.length > 0 ? (
                <ChartContainer
                  config={{
                    thumbsUp: { label: "Thumbs Up", color: "hsl(var(--chart-2, 160 60% 45%))" },
                    thumbsDown: { label: "Thumbs Down", color: "hsl(var(--destructive))" },
                    net: { label: "Net Score", color: "hsl(var(--primary))" },
                  }}
                  className="h-[300px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={feedbackTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="thumbsUp" fill="hsl(var(--chart-2, 160 60% 45%))" radius={[4, 4, 0, 0]} name="👍 Up" />
                      <Bar dataKey="thumbsDown" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="👎 Down" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <ThumbsUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No feedback data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Net Score Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Net Score Trend</CardTitle>
              <CardDescription>Daily net feedback score (Thumbs Up − Thumbs Down)</CardDescription>
            </CardHeader>
            <CardContent>
              {feedbackTrendData.length > 0 ? (
                <ChartContainer
                  config={{
                    net: { label: "Net Score", color: "hsl(var(--primary))" },
                  }}
                  className="h-[200px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={feedbackTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="net"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feedback Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Feedback Summary</CardTitle>
              <CardDescription>Overall feedback distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👍</span>
                    <span className="font-medium">Positive Feedback</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-48 h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-chart-2 rounded-full transition-all"
                        style={{ 
                          width: `${feedbackStats.totalWithFeedback > 0 
                            ? (feedbackStats.thumbsUp / feedbackStats.totalWithFeedback) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                    <span className="font-bold text-chart-2 w-12 text-right">{feedbackStats.thumbsUp}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👎</span>
                    <span className="font-medium">Negative Feedback</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-48 h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-destructive rounded-full transition-all"
                        style={{ 
                          width: `${feedbackStats.totalWithFeedback > 0 
                            ? (feedbackStats.thumbsDown / feedbackStats.totalWithFeedback) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                    <span className="font-bold text-destructive w-12 text-right">{feedbackStats.thumbsDown}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Safety & Compliance Tab */}
        <TabsContent value="safety" className="space-y-4">
          {/* Safety Metrics Tiles */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-destructive" />
                  Guardrail Violations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{guardrailViolations.count}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Attempts to bypass agent guidelines
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Ban className="h-4 w-4 text-destructive" />
                  Blocked Responses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{blockedResponses.count}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Responses declined due to policy
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  PII Detection Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{piiAlerts.count}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Personal information detected in chats
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Guardrail Violations Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-destructive" />
                Guardrail Violations
              </CardTitle>
              <CardDescription>Queries that attempted to bypass agent guidelines</CardDescription>
            </CardHeader>
            <CardContent>
              {guardrailViolations.count > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(guardrailViolations.byType).map(([type, count]) => (
                      count > 0 && (
                        <Badge key={type} variant="destructive" className="text-xs">
                          {type}: {count}
                        </Badge>
                      )
                    ))}
                  </div>
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>User Query</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guardrailViolations.violations.slice(0, 10).map((violation) => (
                          <TableRow key={violation.id}>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {format(new Date(violation.created_at), "MMM d, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-destructive border-destructive">
                                {violation.violationType}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[400px]">
                              <p className="text-sm truncate">{violation.user_message}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No guardrail violations detected</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Blocked Responses Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-destructive" />
                Blocked Responses
              </CardTitle>
              <CardDescription>Responses that were declined due to policy violations</CardDescription>
            </CardHeader>
            <CardContent>
              {blockedResponses.count > 0 ? (
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>User Query</TableHead>
                        <TableHead>Blocked Response</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blockedResponses.responses.slice(0, 10).map((response) => (
                        <TableRow key={response.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(response.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="text-sm truncate">{response.user_message}</p>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="text-sm text-destructive truncate">{response.ai_response}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Ban className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No blocked responses found</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PII Detection Alerts Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                PII Detection Alerts
              </CardTitle>
              <CardDescription>Chats containing potential personal identifiable information</CardDescription>
            </CardHeader>
            <CardContent>
              {piiAlerts.count > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(piiAlerts.byType).map(([type, count]) => (
                      count > 0 && (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type}: {count}
                        </Badge>
                      )
                    ))}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>PII Type</TableHead>
                        <TableHead>User Query</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {piiAlerts.alerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(alert.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {alert.piiTypes.map((type) => (
                                <Badge key={type} variant="outline" className="text-xs">
                                  {type}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[400px]">
                            <p className="text-sm truncate">{alert.user_message}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {piiAlerts.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                      <p className="text-sm text-muted-foreground">
                        Page {safetyPage} of {piiAlerts.totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSafetyPage(p => Math.max(1, p - 1))}
                          disabled={safetyPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSafetyPage(p => Math.min(piiAlerts.totalPages, p + 1))}
                          disabled={safetyPage === piiAlerts.totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No PII detected in conversations</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
