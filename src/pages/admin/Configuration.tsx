import { useState, useEffect, useRef } from 'react';
import { useAgentConfig, AgentConfig, LLM_MODELS, LLM_PROVIDERS, THEME_PRESETS, FONT_OPTIONS } from '@/hooks/useAgentConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, RotateCcw, User, Palette, Cpu, Settings2, Zap, Key, CheckCircle2, AlertCircle, Upload, X, Type, Thermometer, MessageSquare, Brain } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';


const Configuration = () => {
  const { config, loading, saving, updateMultipleConfigs, fetchConfig } = useAgentConfig();
  const [formData, setFormData] = useState<AgentConfig>(config);
  const [hasChanges, setHasChanges] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData(config);
  }, [config]);

  useEffect(() => {
    const changed = Object.keys(formData).some(
      (key) => formData[key as keyof AgentConfig] !== config[key as keyof AgentConfig]
    );
    setHasChanges(changed);
  }, [formData, config]);

  const handleChange = (key: keyof AgentConfig, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleProviderChange = (provider: string) => {
    const typedProvider = provider as AgentConfig['llm_provider'];
    const availableModels = LLM_MODELS[typedProvider] || [];
    const currentModelStillValid = availableModels.some((model) => model.value === formData.llm_model);
    setFormData((prev) => ({
      ...prev,
      llm_provider: typedProvider,
      llm_model: currentModelStillValid ? prev.llm_model : availableModels[0]?.value || prev.llm_model,
    }));
  };

  const handleThemePresetChange = (presetValue: string) => {
    const preset = THEME_PRESETS.find(p => p.value === presetValue);
    if (preset) {
      setFormData((prev) => ({
        ...prev,
        theme_preset: presetValue,
        primary_color: preset.primary,
        secondary_color: preset.secondary,
        font_heading: preset.fontHeading,
        font_body: preset.fontBody,
      }));
    }
  };

  const handleSave = async () => {
    const result = await updateMultipleConfigs(formData);
    if (result.success) {
      toast.success('Configuration saved successfully');
    } else {
      toast.error('Failed to save configuration');
    }
  };

  const handleReset = () => {
    setFormData(config);
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    const result = await updateMultipleConfigs({
      ...formData,
      custom_api_key_set: true,
    });
    if (result.success) {
      toast.success('API key saved securely');
      setApiKeyInput('');
      setFormData((prev) => ({ ...prev, custom_api_key_set: true }));
    } else {
      toast.error('Failed to save API key');
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('agent-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('agent-assets')
        .getPublicUrl(fileName);

      setFormData((prev) => ({ ...prev, logo_url: publicUrl }));
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logo_url: '' }));
  };

  const currentModels = LLM_MODELS[formData.llm_provider] || LLM_MODELS.lovable;
  const currentModelDescription = currentModels.find(m => m.value === formData.llm_model)?.description;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Skeleton className="h-10 w-96" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuration</h1>
          <p className="text-muted-foreground">Customize your AI agent's behavior and appearance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={fetchConfig}>
            Refresh
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="llm" className="gap-2">
            <Cpu className="h-4 w-4" />
            <span className="hidden sm:inline">LLM Integration</span>
          </TabsTrigger>
          <TabsTrigger value="behaviour" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Behaviour</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Agent Profile</CardTitle>
              <CardDescription>Configure your agent's identity and how it introduces itself</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="agent_name">Agent Name</Label>
                  <Input
                    id="agent_name"
                    value={formData.agent_name}
                    onChange={(e) => handleChange('agent_name', e.target.value)}
                    placeholder="AI Troubleshoot"
                  />
                  <p className="text-xs text-muted-foreground">
                    The name displayed to users in the chat interface
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent_tagline">Tagline</Label>
                  <Input
                    id="agent_tagline"
                    value={formData.agent_tagline}
                    onChange={(e) => handleChange('agent_tagline', e.target.value)}
                    placeholder="Your intelligent assistant"
                  />
                  <p className="text-xs text-muted-foreground">
                    A short description shown below the agent name
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="welcome_message">Welcome Message</Label>
                <Textarea
                  id="welcome_message"
                  value={formData.welcome_message}
                  onChange={(e) => handleChange('welcome_message', e.target.value)}
                  placeholder="Hello! How can I help you today?"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  The initial greeting shown when a user starts a conversation
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <div className="space-y-6">
            {/* Logo Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Logo</CardTitle>
                <CardDescription>Upload your agent's logo or avatar</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-6">
                  <div className="relative">
                    {formData.logo_url ? (
                      <div className="relative">
                        <img
                          src={formData.logo_url}
                          alt="Agent logo"
                          className="w-24 h-24 rounded-lg object-cover border"
                        />
                        <button
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50">
                        <Upload className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Uploading...' : 'Upload Logo'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Recommended: Square image, at least 200x200px. Max 2MB.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Colors */}
            <Card>
              <CardHeader>
                <CardTitle>Colors</CardTitle>
                <CardDescription>Customize your brand colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
              {/* Primary Color */}
                <div className="space-y-3">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.primary_color.startsWith('#') ? formData.primary_color : '#8B5CF6'}
                      onChange={(e) => handleChange('primary_color', e.target.value)}
                      className="w-12 h-12 rounded-lg border cursor-pointer"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={(e) => handleChange('primary_color', e.target.value)}
                      placeholder="#8B5CF6"
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Secondary Color */}
                <div className="space-y-3">
                  <Label>Secondary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.secondary_color.startsWith('#') ? formData.secondary_color : '#F1F5F9'}
                      onChange={(e) => handleChange('secondary_color', e.target.value)}
                      className="w-12 h-12 rounded-lg border cursor-pointer"
                    />
                    <Input
                      value={formData.secondary_color}
                      onChange={(e) => handleChange('secondary_color', e.target.value)}
                      placeholder="#F1F5F9"
                      className="flex-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Typography */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Typography
                </CardTitle>
                <CardDescription>Choose fonts for your agent interface</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="font_heading">Heading Font</Label>
                    <Select
                      value={formData.font_heading}
                      onValueChange={(value) => handleChange('font_heading', value)}
                    >
                      <SelectTrigger id="font_heading">
                        <SelectValue placeholder="Select font" />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            <span style={{ fontFamily: font.value }}>{font.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">({font.category})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p
                      className="text-lg font-bold"
                      style={{ fontFamily: formData.font_heading }}
                    >
                      Preview Heading
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="font_body">Body Font</Label>
                    <Select
                      value={formData.font_body}
                      onValueChange={(value) => handleChange('font_body', value)}
                    >
                      <SelectTrigger id="font_body">
                        <SelectValue placeholder="Select font" />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            <span style={{ fontFamily: font.value }}>{font.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">({font.category})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p
                      className="text-sm"
                      style={{ fontFamily: formData.font_body }}
                    >
                      Preview body text that shows how your content will appear.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* LLM Integration Tab */}
        <TabsContent value="llm">
          <Card>
            <CardHeader>
              <CardTitle>LLM Integration</CardTitle>
              <CardDescription>Configure the AI model and connection settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label htmlFor="llm_provider">AI Provider</Label>
                <Select
                  value={formData.llm_provider}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger id="llm_provider" className="w-full">
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        <div className="flex items-center gap-2">
                          <Cpu className="h-3 w-3 text-muted-foreground" />
                          <span>{provider.label}</span>
                          {provider.value === 'lovable' && (
                            <Badge variant="secondary" className="text-xs ml-2">Recommended</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {LLM_PROVIDERS.find(p => p.value === formData.llm_provider)?.description}
                </p>
              </div>

              {/* API Key Input (for custom providers) */}
              {formData.llm_provider !== 'lovable' && (
                <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="api_key" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      API Key
                    </Label>
                    {formData.custom_api_key_set ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not Set
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="api_key"
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={formData.custom_api_key_set ? '••••••••••••••••' : 'Enter your API key'}
                      className="flex-1"
                    />
                    <Button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()}>
                      {formData.custom_api_key_set ? 'Update' : 'Save'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your API key is stored securely and never exposed in the client.
                  </p>
                </div>
              )}

              {/* Model Selection */}
              <div className="space-y-2">
                <Label htmlFor="llm_model">AI Model</Label>
                <Select
                  value={formData.llm_model}
                  onValueChange={(value) => handleChange('llm_model', value)}
                >
                  <SelectTrigger id="llm_model" className="w-full">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        <div className="flex items-center gap-2">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          <span>{model.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {currentModelDescription || 'Select a model to see its description'}
                </p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Model Capabilities
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• All models support text generation and conversation</li>
                  <li>• Pro/GPT-5 models offer better reasoning for complex tasks</li>
                  <li>• Lite/Nano models are optimized for speed and cost</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Behaviour Tab */}
        <TabsContent value="behaviour">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Prompt</CardTitle>
                <CardDescription>Define the agent's personality and response style</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Textarea
                    id="system_prompt"
                    value={formData.system_prompt}
                    onChange={(e) => handleChange('system_prompt', e.target.value)}
                    placeholder="You are a helpful AI assistant..."
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Instructions that define the agent's personality, capabilities, and response style
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-5 w-5" />
                  Temperature
                </CardTitle>
                <CardDescription>Controls randomness in responses (lower = more focused, higher = more creative)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Precise</span>
                    <span className="text-lg font-semibold">{formData.temperature}</span>
                    <span className="text-sm text-muted-foreground">Creative</span>
                  </div>
                  <Slider
                    value={[formData.temperature]}
                    onValueChange={([value]) => handleChange('temperature', value as unknown as string)}
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 0.3, label: 'Factual' },
                    { value: 0.7, label: 'Balanced' },
                    { value: 1.0, label: 'Creative' },
                    { value: 1.5, label: 'Experimental' },
                  ].map((preset) => (
                    <Button
                      key={preset.value}
                      variant={formData.temperature === preset.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleChange('temperature', preset.value as unknown as string)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Response Length
                </CardTitle>
                <CardDescription>Maximum number of tokens the AI can generate per response</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Short</span>
                    <span className="text-lg font-semibold">{formData.max_response_tokens} tokens</span>
                    <span className="text-sm text-muted-foreground">Long</span>
                  </div>
                  <Slider
                    value={[formData.max_response_tokens]}
                    onValueChange={([value]) => handleChange('max_response_tokens', value as unknown as string)}
                    min={256}
                    max={8192}
                    step={256}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 512, label: 'Brief (512)' },
                    { value: 1024, label: 'Standard (1K)' },
                    { value: 2048, label: 'Detailed (2K)' },
                    { value: 4096, label: 'Extended (4K)' },
                  ].map((preset) => (
                    <Button
                      key={preset.value}
                      variant={formData.max_response_tokens === preset.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleChange('max_response_tokens', preset.value as unknown as string)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Conversation Memory
                </CardTitle>
                <CardDescription>Number of previous messages to include for context</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Minimal</span>
                    <span className="text-lg font-semibold">{formData.conversation_memory} messages</span>
                    <span className="text-sm text-muted-foreground">Full Context</span>
                  </div>
                  <Slider
                    value={[formData.conversation_memory]}
                    onValueChange={([value]) => handleChange('conversation_memory', value as unknown as string)}
                    min={2}
                    max={50}
                    step={2}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 4, label: 'Light (4)' },
                    { value: 10, label: 'Standard (10)' },
                    { value: 20, label: 'Extended (20)' },
                    { value: 50, label: 'Maximum (50)' },
                  ].map((preset) => (
                    <Button
                      key={preset.value}
                      variant={formData.conversation_memory === preset.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleChange('conversation_memory', preset.value as unknown as string)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Higher values improve context awareness but increase API costs and latency.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Configuration;
