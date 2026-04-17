import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export interface ActivityLog {
  id: string;
  user_id: string | null;
  activity_type: string;
  description: string | null;
  metadata: Json;
  created_at: string;
  user_email?: string;
}

export interface ChatLog {
  id: string;
  user_id: string | null;
  user_message: string;
  ai_response: string;
  created_at: string;
  user_email?: string;
  topic?: string;
  confidence_score?: number;
  response_time_ms?: number;
  session_id?: string;
  provider?: string | null;
  model?: string | null;
  rag_context?: string | null;
  retrieved_chunks?: Json;
  context_images?: Json;
  debug_payload?: Json;
}

export interface ChatAnalytics {
  id: string;
  date: string;
  total_conversations: number;
  total_messages: number;
  unique_users: number;
  avg_response_time_ms: number | null;
  thumbs_up_count: number;
  thumbs_down_count: number;
  topics: Record<string, number>;
  peak_hour: number | null;
}

export interface FeedbackLog {
  id: string;
  chat_log_id: string | null;
  user_id: string | null;
  rating: string | null;
  csat_score: number | null;
  is_abandoned: boolean | null;
  created_at: string;
}

export interface UserWithRole {
  id: string;
  user_id: string;
  email: string | null;
  created_at: string;
  role: string;
}

export interface DashboardStats {
  totalUsers: number;
  totalChats: number;
  totalSavedResponses: number;
  todayActivity: number;
  // New metrics
  conversationsToday: number;
  conversationsWeek: number;
  conversationsMonth: number;
  activeUsers: number;
  peakHour: number;
  avgResponseTime: number;
  csatScore: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  repeatedQuestions: number;
  abandonedConversations: number;
}

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalChats: 0,
    totalSavedResponses: 0,
    todayActivity: 0,
    conversationsToday: 0,
    conversationsWeek: 0,
    conversationsMonth: 0,
    activeUsers: 0,
    peakHour: 12,
    avgResponseTime: 0,
    csatScore: 0,
    thumbsUpCount: 0,
    thumbsDownCount: 0,
    repeatedQuestions: 0,
    abandonedConversations: 0,
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [chatAnalytics, setChatAnalytics] = useState<ChatAnalytics[]>([]);
  const [feedbackLogs, setFeedbackLogs] = useState<FeedbackLog[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    } else {
      setIsAdmin(false);
      setLoading(false);
    }
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!data && !error);
    setLoading(false);
  };

  const fetchDashboardData = async () => {
    // Calculate date ranges
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all stats in parallel
    const [
      profilesResult, 
      chatsResult, 
      responsesResult, 
      todayActivityResult,
      chatsToday,
      chatsWeek,
      chatsMonth,
      activeUsersResult,
      allChatsForPeak,
      feedbackResult,
      repeatedResult,
      abandonedResult
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('chat_logs').select('id', { count: 'exact', head: true }),
      supabase.from('saved_responses').select('id', { count: 'exact', head: true }),
      supabase.from('activity_logs').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('chat_logs').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('chat_logs').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('chat_logs').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
      supabase.from('activity_logs').select('user_id').gte('created_at', weekAgo),
      supabase.from('chat_logs').select('created_at, response_time_ms').gte('created_at', weekAgo),
      supabase.from('chat_feedback').select('rating, csat_score'),
      supabase.from('chat_logs').select('id', { count: 'exact', head: true }).eq('is_repeated', true),
      supabase.from('chat_feedback').select('id', { count: 'exact', head: true }).eq('is_abandoned', true),
    ]);

    // Calculate peak hour from chat logs
    let peakHour = 12;
    if (allChatsForPeak.data && allChatsForPeak.data.length > 0) {
      const hourCounts: Record<number, number> = {};
      allChatsForPeak.data.forEach(chat => {
        const hour = new Date(chat.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      peakHour = parseInt(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '12');
    }

    // Calculate average response time
    let avgResponseTime = 0;
    if (allChatsForPeak.data) {
      const validTimes = allChatsForPeak.data.filter(c => c.response_time_ms).map(c => c.response_time_ms!);
      if (validTimes.length > 0) {
        avgResponseTime = Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length);
      }
    }

    // Calculate CSAT and thumbs up/down
    let csatScore = 0;
    let thumbsUpCount = 0;
    let thumbsDownCount = 0;
    if (feedbackResult.data) {
      const csatScores = feedbackResult.data.filter(f => f.csat_score).map(f => f.csat_score!);
      if (csatScores.length > 0) {
        csatScore = parseFloat((csatScores.reduce((a, b) => a + b, 0) / csatScores.length).toFixed(1));
      }
      thumbsUpCount = feedbackResult.data.filter(f => f.rating === 'thumbs_up').length;
      thumbsDownCount = feedbackResult.data.filter(f => f.rating === 'thumbs_down').length;
    }

    // Count active users (unique users with activity in past week)
    const activeUsers = activeUsersResult.data 
      ? new Set(activeUsersResult.data.filter(a => a.user_id).map(a => a.user_id)).size 
      : 0;

    setStats({
      totalUsers: profilesResult.count || 0,
      totalChats: chatsResult.count || 0,
      totalSavedResponses: responsesResult.count || 0,
      todayActivity: todayActivityResult.count || 0,
      conversationsToday: chatsToday.count || 0,
      conversationsWeek: chatsWeek.count || 0,
      conversationsMonth: chatsMonth.count || 0,
      activeUsers,
      peakHour,
      avgResponseTime,
      csatScore,
      thumbsUpCount,
      thumbsDownCount,
      repeatedQuestions: repeatedResult.count || 0,
      abandonedConversations: abandonedResult.count || 0,
    });

    // Fetch activity logs with user info
    const { data: activities } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (activities) {
      const userIds = [...new Set(activities.filter(a => a.user_id).map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.email]) || []);
      
      setActivityLogs(activities.map(a => ({
        ...a,
        user_email: a.user_id ? profileMap.get(a.user_id) || 'Unknown' : 'Anonymous',
      })));
    }

    // Fetch chat logs with user info (increased limit for better analytics)
    const { data: chats } = await supabase
      .from('chat_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (chats) {
      const userIds = [...new Set(chats.filter(c => c.user_id).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.email]) || []);
      
      setChatLogs(chats.map(c => ({
        ...c,
        user_email: c.user_id ? profileMap.get(c.user_id) || 'Unknown' : 'Anonymous',
      })));
    }

    // Fetch aggregated chat analytics (last 30 days)
    const { data: analyticsData } = await supabase
      .from('chat_analytics')
      .select('*')
      .order('date', { ascending: false })
      .limit(30);

    if (analyticsData) {
      setChatAnalytics(analyticsData.map(a => ({
        ...a,
        topics: (a.topics as Record<string, number>) || {},
      })));
    }

    // Fetch feedback logs
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('chat_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (feedbackError) {
      console.error('Error fetching feedback:', feedbackError);
    }
    
    if (feedbackData) {
      console.log('Feedback data fetched:', feedbackData.length, 'records');
      setFeedbackLogs(feedbackData);
    }

    // Fetch users with roles
    const { data: usersData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersData) {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', usersData.map(u => u.user_id));

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      setUsers(usersData.map(u => ({
        ...u,
        role: roleMap.get(u.user_id) || 'user',
      })));
    }
  };

  const logActivity = async (activityType: string, description: string, metadata: Json = {}) => {
    if (!user) return;

    await supabase.from('activity_logs').insert([{
      user_id: user.id,
      activity_type: activityType,
      description,
      metadata,
    }]);
  };

  const logChat = async (userMessage: string, aiResponse: string) => {
    if (!user) return;

    await supabase.from('chat_logs').insert([{
      user_id: user.id,
      user_message: userMessage,
      ai_response: aiResponse,
    }]);
  };

  return {
    isAdmin,
    loading,
    stats,
    activityLogs,
    chatLogs,
    chatAnalytics,
    feedbackLogs,
    users,
    fetchDashboardData,
    logActivity,
    logChat,
    checkAdminStatus,
  };
};
