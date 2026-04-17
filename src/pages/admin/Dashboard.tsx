import { useEffect, useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Users, 
  MessageSquare, 
  BookmarkCheck, 
  Activity, 
  Clock, 
  User, 
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  XCircle,
  Star,
  Timer,
  RefreshCw
} from "lucide-react";
import { format, subDays, startOfDay, eachHourOfInterval, eachDayOfInterval } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

type TimePeriod = "today" | "week" | "month";

const Dashboard = () => {
  const { stats, activityLogs, chatLogs, fetchDashboardData } = useAdmin();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("week");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getActivityBadgeColor = (type: string) => {
    switch (type) {
      case "user_registered":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "user_login":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "response_saved":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "response_shared":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatPeakHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${ampm}`;
  };

  const thumbsRatio = stats.thumbsUpCount + stats.thumbsDownCount > 0
    ? ((stats.thumbsUpCount / (stats.thumbsUpCount + stats.thumbsDownCount)) * 100).toFixed(0)
    : "N/A";

  // Generate chart data based on time period
  const getChartData = () => {
    const now = new Date();
    
    if (timePeriod === "today") {
      const todayStart = startOfDay(now);
      const hours = eachHourOfInterval({ start: todayStart, end: now });
      
      return hours.map(hour => {
        const count = chatLogs.filter(log => {
          const logDate = new Date(log.created_at);
          return logDate >= hour && logDate < new Date(hour.getTime() + 60 * 60 * 1000);
        }).length;
        
        return {
          label: format(hour, "ha"),
          conversations: count
        };
      });
    } else if (timePeriod === "week") {
      const weekStart = subDays(now, 6);
      const days = eachDayOfInterval({ start: weekStart, end: now });
      
      return days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const count = chatLogs.filter(log => {
          const logDate = new Date(log.created_at);
          return logDate >= dayStart && logDate < dayEnd;
        }).length;
        
        return {
          label: format(day, "EEE"),
          conversations: count
        };
      });
    } else {
      const monthStart = subDays(now, 29);
      const days = eachDayOfInterval({ start: monthStart, end: now });
      
      return days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const count = chatLogs.filter(log => {
          const logDate = new Date(log.created_at);
          return logDate >= dayStart && logDate < dayEnd;
        }).length;
        
        return {
          label: format(day, "d"),
          conversations: count
        };
      });
    }
  };

  const chartData = getChartData();
  const totalConversations = timePeriod === "today" 
    ? stats.conversationsToday 
    : timePeriod === "week" 
      ? stats.conversationsWeek 
      : stats.conversationsMonth;

  const chartConfig = {
    conversations: {
      label: "Conversations",
      color: "hsl(var(--primary))",
    },
  };

  // Find repeated queries (similar questions asked multiple times)
  const getRepeatedQueries = () => {
    const queryMap = new Map<string, { count: number; query: string; users: string[]; lastAsked: string }>();
    
    chatLogs.forEach(log => {
      // Normalize query for comparison (lowercase, trim)
      const normalizedQuery = log.user_message.toLowerCase().trim();
      const existing = queryMap.get(normalizedQuery);
      
      if (existing) {
        existing.count++;
        if (!existing.users.includes(log.user_email || 'Anonymous')) {
          existing.users.push(log.user_email || 'Anonymous');
        }
        if (new Date(log.created_at) > new Date(existing.lastAsked)) {
          existing.lastAsked = log.created_at;
        }
      } else {
        queryMap.set(normalizedQuery, {
          count: 1,
          query: log.user_message,
          users: [log.user_email || 'Anonymous'],
          lastAsked: log.created_at
        });
      }
    });
    
    // Filter to only repeated queries (count > 1) and sort by count
    return Array.from(queryMap.values())
      .filter(q => q.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  };

  const repeatedQueries = getRepeatedQueries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your AI agent performance</p>
      </div>

      {/* Primary Stats - 2 tiles */}
      <div className="grid gap-4 grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Active this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saved Responses</CardTitle>
            <BookmarkCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSavedResponses}</div>
            <p className="text-xs text-muted-foreground">Bookmarked solutions</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversations Trend Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversations
            </CardTitle>
            <CardDescription>
              {totalConversations} total conversations
            </CardDescription>
          </div>
          <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <TabsList className="h-8">
              <TabsTrigger value="today" className="text-xs px-3">Today</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillConversations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="label" 
                tickLine={false} 
                axisLine={false} 
                fontSize={12}
                tickMargin={8}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                fontSize={12}
                tickMargin={8}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="conversations"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#fillConversations)"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Performance & Quality Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Performance & Quality</h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Peak Usage Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-2xl font-bold">{formatPeakHour(stats.peakHour)}</div>
                  <p className="text-xs text-muted-foreground">Most active hour</p>
                </div>
                <div className="h-12 w-24">
                  <ChartContainer config={{ usage: { label: "Usage", color: "hsl(var(--primary))" } }} className="h-full w-full">
                    <AreaChart 
                      data={Array.from({ length: 24 }, (_, i) => ({
                        hour: i,
                        usage: chatLogs.filter(log => new Date(log.created_at).getHours() === i).length
                      }))}
                      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="fillUsage" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="usage"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.5}
                        fill="url(#fillUsage)"
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.avgResponseTime > 0 ? `${(stats.avgResponseTime / 1000).toFixed(1)}s` : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">Average AI response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CSAT Score</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-2xl font-bold">
                    {stats.csatScore > 0 ? `${stats.csatScore}/5` : "N/A"}
                  </div>
                  <p className="text-xs text-muted-foreground">User satisfaction</p>
                </div>
                <div className="h-12 w-24">
                  <ChartContainer config={{ score: { label: "Score", color: "hsl(var(--chart-2))" } }} className="h-full w-full">
                    <AreaChart 
                      data={[
                        { label: "1", score: 1 },
                        { label: "2", score: 2 },
                        { label: "3", score: 3 },
                        { label: "4", score: stats.csatScore > 0 ? stats.csatScore : 3.5 },
                        { label: "5", score: stats.csatScore > 0 ? Math.min(stats.csatScore + 0.3, 5) : 4 },
                      ]}
                      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="fillCsat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={1.5}
                        fill="url(#fillCsat)"
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Thumbs Ratio</CardTitle>
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3 text-green-500" />
                <ThumbsDown className="h-3 w-3 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {thumbsRatio !== "N/A" ? `${thumbsRatio}%` : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.thumbsUpCount} up / {stats.thumbsDownCount} down
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Repeated Queries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Repeated Questions
          </CardTitle>
          <CardDescription>Questions asked multiple times by users</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Count</TableHead>
                  <TableHead className="w-[50%]">Query</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Last Asked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repeatedQueries.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {item.count}x
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-2">{item.query}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {item.users.length} {item.users.length === 1 ? 'user' : 'users'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(item.lastAsked), "MMM d, HH:mm")}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {repeatedQueries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No repeated questions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

    </div>
  );
};

export default Dashboard;