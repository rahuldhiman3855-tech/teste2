import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

const SAVED_RESPONSES_KEY = "saved_response_ids";
const DEFAULT_CATEGORIES = [
  { id: 'default-general', name: 'General', color: 'bg-blue-500' },
  { id: 'default-errors', name: 'Error Solutions', color: 'bg-red-500' },
  { id: 'default-code', name: 'Code Snippets', color: 'bg-green-500' },
  { id: 'default-debug', name: 'Debugging', color: 'bg-yellow-500' },
];

export interface SavedResponse {
  id: string;
  content: string;
  category: string;
  category_id: string | null;
  created_at: string;
  title: string;
  share_token: string | null;
  is_public: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

// LocalStorage helpers for anonymous users
function getStoredResponseIds(): string[] {
  try {
    const stored = localStorage.getItem(SAVED_RESPONSES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addStoredResponseId(id: string) {
  const ids = getStoredResponseIds();
  if (!ids.includes(id)) {
    ids.unshift(id);
    localStorage.setItem(SAVED_RESPONSES_KEY, JSON.stringify(ids.slice(0, 100)));
  }
}

function removeStoredResponseId(id: string) {
  const ids = getStoredResponseIds().filter(i => i !== id);
  localStorage.setItem(SAVED_RESPONSES_KEY, JSON.stringify(ids));
}

export const useSavedResponses = () => {
  const { user } = useAuth();
  const [savedResponses, setSavedResponses] = useState<SavedResponse[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    if (user) {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        setCategories(data);
      }
    }
  }, [user]);

  const fetchResponses = useCallback(async () => {
    const responseIds = getStoredResponseIds();
    
    if (responseIds.length === 0) {
      setSavedResponses([]);
      return;
    }

    const { data, error } = await supabase
      .from('saved_responses')
      .select(`
        id,
        title,
        content,
        category_id,
        share_token,
        is_public,
        created_at,
        categories (name)
      `)
      .in('id', responseIds)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mappedResponses: SavedResponse[] = data.map((r: any) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        category_id: r.category_id,
        category: r.categories?.name || 'General',
        share_token: r.share_token,
        is_public: r.is_public,
        created_at: r.created_at,
      }));
      setSavedResponses(mappedResponses);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchResponses()]).then(() => {
      setLoading(false);
    });
  }, [fetchCategories, fetchResponses]);

  const logActivity = async (activityType: string, description: string, metadata: Json = {}) => {
    if (!user) return;
    await supabase.from('activity_logs').insert([{
      user_id: user.id,
      activity_type: activityType,
      description,
      metadata,
    }]);
  };

  const saveResponse = async (content: string, title: string, categoryName: string = 'General') => {
    const category = categories.find(c => c.name === categoryName);
    
    const { data, error } = await supabase
      .from('saved_responses')
      .insert({
        user_id: user?.id || null,
        title,
        content,
        category_id: category?.id?.startsWith('default-') ? null : category?.id || null,
      })
      .select()
      .single();

    if (!error && data) {
      addStoredResponseId(data.id);
      
      const newResponse: SavedResponse = {
        id: data.id,
        title: data.title,
        content: data.content,
        category_id: data.category_id,
        category: categoryName,
        share_token: data.share_token,
        is_public: data.is_public,
        created_at: data.created_at,
      };
      setSavedResponses(prev => [newResponse, ...prev]);
      
      if (user) {
        logActivity('response_saved', `Saved response: ${title}`, { response_id: data.id });
      }
    }
  };

  const deleteResponse = async (id: string) => {
    const { error } = await supabase
      .from('saved_responses')
      .delete()
      .eq('id', id);

    if (!error) {
      removeStoredResponseId(id);
      setSavedResponses(prev => prev.filter(r => r.id !== id));
    }
  };

  const updateResponse = async (id: string, updates: Partial<{ title: string; category: string }>) => {
    const updateData: any = {};
    
    if (updates.title) {
      updateData.title = updates.title;
    }
    
    if (updates.category) {
      const category = categories.find(c => c.name === updates.category);
      updateData.category_id = category?.id?.startsWith('default-') ? null : category?.id || null;
    }

    const { error } = await supabase
      .from('saved_responses')
      .update(updateData)
      .eq('id', id);

    if (!error) {
      setSavedResponses(prev => prev.map(r => 
        r.id === id ? { ...r, ...updates } : r
      ));
    }
  };

  const generateShareLink = async (id: string): Promise<string | null> => {
    const { data: tokenData } = await supabase.rpc('generate_share_token');
    
    if (!tokenData) return null;

    const { error } = await supabase
      .from('saved_responses')
      .update({ 
        share_token: tokenData,
        is_public: true 
      })
      .eq('id', id);

    if (error) return null;

    setSavedResponses(prev => prev.map(r => 
      r.id === id ? { ...r, share_token: tokenData, is_public: true } : r
    ));

    if (user) {
      logActivity('response_shared', 'Generated share link for response', { response_id: id });
    }

    return `${window.location.origin}/shared/${tokenData}`;
  };

  const revokeShareLink = async (id: string) => {
    const { error } = await supabase
      .from('saved_responses')
      .update({ 
        share_token: null,
        is_public: false 
      })
      .eq('id', id);

    if (!error) {
      setSavedResponses(prev => prev.map(r => 
        r.id === id ? { ...r, share_token: null, is_public: false } : r
      ));
    }
  };

  const addCategory = async (name: string, color: string) => {
    if (!user) {
      // For anonymous users, just add to local state
      const newCat = { id: `local-${Date.now()}`, name, color };
      setCategories(prev => [...prev, newCat]);
      return;
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name,
        color,
      })
      .select()
      .single();

    if (!error && data) {
      setCategories(prev => [...prev, data]);
    }
  };

  const deleteCategory = async (id: string) => {
    if (id.startsWith('default-') || id.startsWith('local-')) {
      setCategories(prev => prev.filter(c => c.id !== id));
      return;
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (!error) {
      setCategories(prev => prev.filter(c => c.id !== id));
    }
  };

  return {
    savedResponses,
    categories,
    loading,
    saveResponse,
    deleteResponse,
    updateResponse,
    generateShareLink,
    revokeShareLink,
    addCategory,
    deleteCategory,
  };
};
