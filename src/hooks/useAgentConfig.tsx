import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AgentConfig {
  welcome_message: string;
  agent_name: string;
  agent_tagline: string;
  primary_color: string;
  secondary_color: string;
  system_prompt: string;
  llm_model: string;
  llm_provider: 'lovable' | 'openai' | 'anthropic' | 'google' | 'nvidia';
  custom_api_key_set: boolean;
  logo_url: string;
  font_heading: string;
  font_body: string;
  theme_preset: string;
  temperature: number;
  max_response_tokens: number;
  conversation_memory: number;
}

export const THEME_PRESETS = [
  { 
    value: 'default', 
    label: 'Default', 
    primary: 'hsl(262, 83%, 58%)', 
    secondary: 'hsl(220, 14%, 96%)',
    fontHeading: 'Inter',
    fontBody: 'Inter'
  },
  { 
    value: 'ocean', 
    label: 'Ocean', 
    primary: 'hsl(199, 89%, 48%)', 
    secondary: 'hsl(199, 89%, 96%)',
    fontHeading: 'Poppins',
    fontBody: 'Inter'
  },
  { 
    value: 'forest', 
    label: 'Forest', 
    primary: 'hsl(142, 76%, 36%)', 
    secondary: 'hsl(142, 76%, 96%)',
    fontHeading: 'Merriweather',
    fontBody: 'Open Sans'
  },
  { 
    value: 'sunset', 
    label: 'Sunset', 
    primary: 'hsl(25, 95%, 53%)', 
    secondary: 'hsl(25, 95%, 96%)',
    fontHeading: 'Playfair Display',
    fontBody: 'Lato'
  },
  { 
    value: 'midnight', 
    label: 'Midnight', 
    primary: 'hsl(250, 87%, 65%)', 
    secondary: 'hsl(222, 47%, 11%)',
    fontHeading: 'Space Grotesk',
    fontBody: 'Inter'
  },
  { 
    value: 'coral', 
    label: 'Coral', 
    primary: 'hsl(350, 89%, 60%)', 
    secondary: 'hsl(350, 89%, 96%)',
    fontHeading: 'DM Sans',
    fontBody: 'DM Sans'
  },
];

export const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter', category: 'sans-serif' },
  { value: 'Poppins', label: 'Poppins', category: 'sans-serif' },
  { value: 'Open Sans', label: 'Open Sans', category: 'sans-serif' },
  { value: 'Lato', label: 'Lato', category: 'sans-serif' },
  { value: 'DM Sans', label: 'DM Sans', category: 'sans-serif' },
  { value: 'Space Grotesk', label: 'Space Grotesk', category: 'sans-serif' },
  { value: 'Roboto', label: 'Roboto', category: 'sans-serif' },
  { value: 'Playfair Display', label: 'Playfair Display', category: 'serif' },
  { value: 'Merriweather', label: 'Merriweather', category: 'serif' },
  { value: 'Lora', label: 'Lora', category: 'serif' },
  { value: 'Source Code Pro', label: 'Source Code Pro', category: 'monospace' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono', category: 'monospace' },
];

export const LLM_PROVIDERS = [
  { value: 'lovable', label: 'Lovable AI', description: 'Built-in AI gateway (no API key required)' },
  { value: 'openai', label: 'OpenAI', description: 'Use your own OpenAI API key' },
  { value: 'anthropic', label: 'Anthropic', description: 'Use your own Anthropic API key' },
  { value: 'google', label: 'Google AI', description: 'Use your own Google AI API key' },
  { value: 'nvidia', label: 'NVIDIA', description: 'Use your own NVIDIA API key' },
];

export const LLM_MODELS = {
  lovable: [
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Balanced speed and quality (recommended)' },
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Best for complex reasoning and large context' },
    { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: 'Fastest and most cost-effective' },
    { value: 'openai/gpt-5', label: 'GPT-5', description: 'Powerful all-rounder, excellent reasoning' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini', description: 'Good balance of performance and cost' },
    { value: 'openai/gpt-5-nano', label: 'GPT-5 Nano', description: 'Speed optimized for simple tasks' },
  ],
  openai: [
    { value: 'gpt-5', label: 'GPT-5', description: 'Most capable OpenAI model' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini', description: 'Fast and cost-effective' },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Previous generation flagship' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Previous generation fast model' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', description: 'Most capable Claude model' },
    { value: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku', description: 'Fast and efficient' },
  ],
  google: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Most capable Gemini model' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Balanced performance' },
  ],
  nvidia: [
    { value: 'meta/llama-3.1-8b-instruct', label: 'llama-3.1-8b-instruct', description: 'Fast and reliable chat model' },
    { value: 'meta/llama-3.1-70b-instruct', label: 'llama-3.1-70b-instruct', description: 'Strong general-purpose chat model' },
    { value: 'meta/llama-3.3-70b-instruct', label: 'llama-3.3-70b-instruct', description: 'Improved chat and reasoning model' },
  ],
};

const defaultConfig: AgentConfig = {
  welcome_message: "Hello! I'm your AI troubleshooting assistant. I'm here to help you diagnose and solve technical issues. What problem are you experiencing today?",
  agent_name: "AI Troubleshoot",
  agent_tagline: "Your intelligent assistant",
  primary_color: "hsl(262, 83%, 58%)",
  secondary_color: "hsl(220, 14%, 96%)",
  system_prompt: "You are a helpful AI troubleshooting assistant. Help users diagnose and solve technical issues. Be clear, concise, and provide actionable solutions.",
  llm_model: "meta/llama-3.1-70b-instruct",
  llm_provider: "nvidia",
  custom_api_key_set: false,
  logo_url: "",
  font_heading: "Inter",
  font_body: "Inter",
  theme_preset: "default",
  temperature: 0.7,
  max_response_tokens: 2048,
  conversation_memory: 10,
};

export const useAgentConfig = () => {
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_config')
        .select('key, value');

      if (error) throw error;

      if (data) {
        const configObj: AgentConfig = { ...defaultConfig };
        data.forEach((item) => {
          const key = item.key as keyof AgentConfig;
          if (key in configObj) {
            // Value is stored as jsonb, so it might be a JSON string that needs parsing
            let parsedValue = item.value;
            // If it's a string that looks like JSON, try to parse it
            if (typeof parsedValue === 'string') {
              try {
                parsedValue = JSON.parse(parsedValue);
              } catch {
                // Keep as-is if not valid JSON
              }
            }
            (configObj as any)[key] = parsedValue;
          }
        });
        setConfig(configObj);
      }
    } catch (error) {
      console.error('Error fetching agent config:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (key: keyof AgentConfig, value: string | number | boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('agent_config')
        .upsert(
          { key, value: value, updated_at: new Date().toISOString() }, // Store directly
          { onConflict: 'key' }
        );

      if (error) throw error;

      setConfig((prev) => ({ ...prev, [key]: value }));
      return { success: true };
    } catch (error) {
      console.error('Error updating agent config:', error);
      return { success: false, error };
    } finally {
      setSaving(false);
    }
  };

  const updateMultipleConfigs = async (updates: Partial<AgentConfig>) => {
    setSaving(true);
    try {
      const upserts = Object.entries(updates).map(([key, value]) => ({
        key,
        value: value, // Store directly - jsonb column handles serialization
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('agent_config')
        .upsert(upserts, { onConflict: 'key' });

      if (error) throw error;

      setConfig((prev) => ({ ...prev, ...updates }));
      return { success: true };
    } catch (error) {
      console.error('Error updating agent configs:', error);
      return { success: false, error };
    } finally {
      setSaving(false);
    }
  };

  return {
    config,
    loading,
    saving,
    fetchConfig,
    updateConfig,
    updateMultipleConfigs,
  };
};
