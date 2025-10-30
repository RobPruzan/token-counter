'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Settings, X } from 'lucide-react';
import { Message } from '@/lib/types/ai-messages';
import { analyzeMessages, analyzeMessagesWithAPI, MessageTokenInfo, getTotalTokens } from '@/lib/token-counter';
import { TokenHeatmap } from './components/TokenHeatmap';
import { MessageList } from './components/MessageList';
import { TokenStats } from './components/TokenStats';

export default function TokenAnalyzer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [analysis, setAnalysis] = useState<MessageTokenInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('anthropic-api-key');
    if (stored) setApiKey(stored);
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('anthropic-api-key', apiKey);
    setShowSettings(false);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        let messagesToAnalyze: Message[];
        if (Array.isArray(json)) {
          messagesToAnalyze = json;
        } else if (json.data && json.data.messages && Array.isArray(json.data.messages)) {
          messagesToAnalyze = json.data.messages;
        } else if (json.messages && Array.isArray(json.messages)) {
          messagesToAnalyze = json.messages;
        } else {
          setError('Invalid format. Expected array of messages, object with "messages" field, or object with "data.messages" field.');
          setIsLoading(false);
          return;
        }

        // Transform messages: convert 'parts' to 'content' if needed
        messagesToAnalyze = messagesToAnalyze.map((msg: any) => {
          if (msg.parts && !msg.content) {
            return {
              ...msg,
              content: msg.parts
            };
          }
          return msg;
        });

        if (messagesToAnalyze.length === 0) {
          setError('No messages found in the file.');
          setIsLoading(false);
          return;
        }

        setMessages(messagesToAnalyze);
        
        // Try to use API if key is available, otherwise fall back to estimates
        let analyzed;
        if (apiKey) {
          console.log('Using Anthropic API for accurate token counting...');
          try {
            analyzed = await analyzeMessagesWithAPI(messagesToAnalyze, apiKey);
            console.log('Successfully analyzed with API');
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            console.error('API failed, using estimates:', errorMsg);
            setError(`API counting failed: ${errorMsg}. Using estimated token counts instead.`);
            analyzed = analyzeMessages(messagesToAnalyze);
          }
        } else {
          console.log('No API key, using estimated token counts');
          setError('Using estimated token counts. Set API key in settings for accurate counts.');
          analyzed = analyzeMessages(messagesToAnalyze);
        }
        
        setAnalysis(analyzed);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to parse JSON: ' + (err as Error).message);
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file');
      setIsLoading(false);
    };

    reader.readAsText(file);
  }, [apiKey]);

  const filteredAnalysis = analysis.filter(msg => {
    const matchesRole = roleFilter === 'all' || msg.role === roleFilter;
    const matchesSearch = searchQuery === '' || 
      msg.parts.some(part => part.preview?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  const totalTokens = getTotalTokens(analysis);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-[#1a1a1a] bg-[#0f0f0f]">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">AI SDK Token Analyzer</h1>
            {messages.length > 0 && (
              <div className="text-sm text-[#888]">
                {messages.length} messages • {totalTokens.total.toLocaleString()} tokens
              </div>
            )}
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-[#1a1a1a] rounded-md transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200 flex items-center justify-between">
            <span>{error}</span>
            <button 
              onClick={() => setError('')}
              className="ml-4 p-1 hover:bg-red-800/30 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isLoading}
              />
              <div className="flex flex-col items-center gap-4 p-12 border-2 border-dashed border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] transition-colors">
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                    <div className="text-center">
                      <div className="text-lg font-medium mb-1">Processing file...</div>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload size={48} className="text-[#666]" />
                    <div className="text-center">
                      <div className="text-lg font-medium mb-1">Upload AI SDK Messages</div>
                      <div className="text-sm text-[#888]">
                        JSON array or object with "messages" or "data.messages" field
                      </div>
                    </div>
                  </>
                )}
              </div>
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 flex-wrap">
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md focus:outline-none focus:border-[#3a3a3a] flex-1 min-w-[200px]"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md focus:outline-none focus:border-[#3a3a3a]"
              >
                <option value="all">All Roles</option>
                <option value="system">System</option>
                <option value="user">User</option>
                <option value="assistant">Assistant</option>
                <option value="tool">Tool</option>
              </select>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md hover:bg-[#252525] transition-colors"
                >
                  -
                </button>
                <span className="text-sm text-[#888] w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                  className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md hover:bg-[#252525] transition-colors"
                >
                  +
                </button>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md hover:bg-[#252525] transition-colors">
                  New File
                </div>
              </label>
            </div>

            <TokenStats analysis={analysis} />
            <TokenHeatmap analysis={filteredAnalysis} zoom={zoom} />
            <MessageList messages={messages} analysis={filteredAnalysis} zoom={zoom} />
          </div>
        )}
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-[#252525] rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#888] mb-2">
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-4 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-md focus:outline-none focus:border-[#3a3a3a]"
                />
                <div className="text-xs text-[#666] mt-2">
                  Stored locally in your browser
                </div>
              </div>
              <button
                onClick={saveApiKey}
                className="w-full px-4 py-2 bg-[#2a2a2a] hover:bg-[#333] rounded-md transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
