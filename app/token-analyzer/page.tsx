'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Settings, X, ArrowLeft } from 'lucide-react';
import { Message } from '@/lib/types/ai-messages';
import { analyzeMessagesWithAPI, MessageTokenInfo, getTotalTokens } from '@/lib/token-counter';
import { TokenHeatmap } from './components/TokenHeatmap';
import { MessageList } from './components/MessageList';
import { TokenStats } from './components/TokenStats';

interface ChatGroup {
  chatId: string;
  messages: Message[];
  analysis: MessageTokenInfo[];
  createdAt: number;
  messageCount: number;
  totalTokens: number;
}

export default function TokenAnalyzer() {
  const [chats, setChats] = useState<ChatGroup[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [imageTokenCount, setImageTokenCount] = useState<number | null>(null);
  const [imageTokenLoading, setImageTokenLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageStats, setImageStats] = useState<{ width: number; height: number; sizeKB: number; base64Length: number } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('anthropic-api-key');
    if (stored) setApiKey(stored);
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('anthropic-api-key', apiKey);
    setShowSettings(false);
  };

  const scrollToMessage = (messageIndex: number) => {
    setSelectedMessageId(messageIndex);
    const element = document.getElementById(`message-${messageIndex}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleUpdateAnalysis = (messageIndex: number, newAnalysis: MessageTokenInfo) => {
    if (selectedChat) {
      // Update the analysis in the selected chat
      const updatedAnalysis = [...selectedChat.analysis];
      updatedAnalysis[messageIndex] = newAnalysis;
      
      // Recalculate total tokens
      const totalTokens = getTotalTokens(updatedAnalysis);
      
      // Update selected chat
      const updatedChat = {
        ...selectedChat,
        analysis: updatedAnalysis,
        totalTokens: totalTokens.total
      };
      
      setSelectedChat(updatedChat);
      
      // Also update in chats array
      const updatedChats = chats.map(chat => 
        chat.chatId === selectedChat.chatId ? updatedChat : chat
      );
      setChats(updatedChats);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !apiKey) return;

    setImageTokenLoading(true);
    setImageTokenCount(null);
    setImagePreview(null);
    setImageStats(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64Data = (event.target?.result as string).split(',')[1];
        const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        
        setImagePreview(event.target?.result as string);

        // Get image dimensions
        const img = new Image();
        img.onload = async () => {
          setImageStats({
            width: img.width,
            height: img.height,
            sizeKB: parseFloat((file.size / 1024).toFixed(1)),
            base64Length: base64Data.length
          });

          const requestBody = {
            messages: [{
              role: 'user',
              content: [{
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data
                }
              }]
            }],
            apiKey
          };

          console.log('Image upload request:', {
            ...requestBody,
            messages: [{
              ...requestBody.messages[0],
              content: [{
                ...requestBody.messages[0].content[0],
                source: {
                  ...requestBody.messages[0].content[0].source,
                  data: `[${base64Data.length} chars]`
                }
              }]
            }]
          });

          // Call Anthropic API to count tokens for this image
          const response = await fetch('/api/count-tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) throw new Error('API call failed');
          
          const data = await response.json();
          console.log('Token count response:', data);
          setImageTokenCount(data.input_tokens || 0);
          setImageTokenLoading(false);
        };
        img.src = event.target?.result as string;
      } catch (error) {
        console.error('Error counting image tokens:', error);
        setError('Failed to count image tokens');
        setImageTokenLoading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError('');
    setSelectedChat(null);

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
        messagesToAnalyze = messagesToAnalyze.map((msg: Record<string, unknown>) => {
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
        
        // Group messages by chatId
        const chatMap = new Map<string, { messages: Message[]; createdAt: number }>();
        messagesToAnalyze.forEach((msg: Record<string, unknown>) => {
          const metadata = msg.metadata as { chatId?: string; createdAt?: number } | undefined;
          const chatId = metadata?.chatId || 'default';
          if (!chatMap.has(chatId)) {
            chatMap.set(chatId, {
              messages: [],
              createdAt: metadata?.createdAt || 0
            });
          }
          const chatData = chatMap.get(chatId);
          if (chatData) {
            chatData.messages.push(msg as Message);
          }
        });

        // Analyze and create chat groups
        const chatGroups: ChatGroup[] = [];
        
        if (!apiKey) {
          setError('Anthropic API key required for accurate token counting. Please set your API key in settings.');
          setIsLoading(false);
          return;
        }
        
        for (const [chatId, data] of chatMap.entries()) {
          // Sort messages by createdAt
          const sortedMessages = data.messages.sort((a, b) => {
            const aMetadata = a.metadata as { createdAt?: number } | undefined;
            const bMetadata = b.metadata as { createdAt?: number } | undefined;
            return (aMetadata?.createdAt || 0) - (bMetadata?.createdAt || 0);
          });

          // Use API for accurate token counts
          const analyzed = await analyzeMessagesWithAPI(sortedMessages, apiKey);
          const totalTokens = getTotalTokens(analyzed);

          chatGroups.push({
            chatId,
            messages: sortedMessages,
            analysis: analyzed,
            createdAt: data.createdAt,
            messageCount: sortedMessages.length,
            totalTokens: totalTokens.total
          });
        }

        // Sort chats by createdAt (most recent first)
        chatGroups.sort((a, b) => b.createdAt - a.createdAt);
        
        setChats(chatGroups);
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

  const filteredAnalysis = selectedChat ? selectedChat.analysis.filter(msg => {
    const matchesRole = roleFilter === 'all' || msg.role === roleFilter;
    const matchesSearch = searchQuery === '' || 
      msg.parts.some(part => part.preview?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRole && matchesSearch;
  }) : [];
  
  // Calculate grand total across all chats
  const grandTotal = chats.reduce((sum, chat) => sum + chat.totalTokens, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-[#1a1a1a] bg-[#0f0f0f]">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedChat && (
              <button
                onClick={() => setSelectedChat(null)}
                className="p-2 hover:bg-[#1a1a1a] rounded-md transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h1 className="text-lg font-semibold">AI SDK Token Analyzer</h1>
            {selectedChat && (
              <div className="text-sm text-[#888]">
                {selectedChat.messageCount} messages • {selectedChat.totalTokens.toLocaleString()} tokens
              </div>
            )}
            {!selectedChat && chats.length > 0 && (
              <div className="text-sm text-[#888]">
                {chats.length} chats • {grandTotal.toLocaleString()} total tokens
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
        {!apiKey && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200">
            <div className="font-medium mb-1">⚠️ API Key Required</div>
            <div className="text-sm">
              Set your Anthropic API key in settings to get accurate token counts from Claude Sonnet 4.5. Without it, token counts cannot be calculated.
            </div>
          </div>
        )}
        
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

        {chats.length === 0 ? (
          <div className="space-y-6">
            {/* Image Token Counter */}
            {apiKey && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">Image Token Counter</h3>
                  <p className="text-sm text-[#888] mb-4">Upload an image to see how many tokens it uses</p>
                  
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={imageTokenLoading}
                    />
                    <div className="border-2 border-dashed border-[#2a2a2a] rounded-lg p-6 hover:border-[#3a3a3a] transition-colors text-center">
                      {imageTokenLoading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                          <span className="text-sm text-[#888]">Counting tokens...</span>
                        </div>
                      ) : (
                        <div className="text-sm text-[#888]">
                          Click to upload image
                        </div>
                      )}
                    </div>
                  </label>

                  {imagePreview && imageTokenCount !== null && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded">
                        <span className="text-sm text-[#888]">Token Count (from Anthropic API):</span>
                        <span className="text-lg font-semibold text-white">{imageTokenCount.toLocaleString()}</span>
                      </div>
                      
                      {imageStats && (
                        <div className="grid grid-cols-2 gap-2 p-3 bg-[#0f0f0f] rounded text-xs">
                          <div>
                            <span className="text-[#666]">Resolution:</span>
                            <span className="text-[#aaa] ml-1">{imageStats.width} × {imageStats.height}</span>
                          </div>
                          <div>
                            <span className="text-[#666]">File Size:</span>
                            <span className="text-[#aaa] ml-1">{imageStats.sizeKB} KB</span>
                          </div>
                          <div>
                            <span className="text-[#666]">Pixels:</span>
                            <span className="text-[#aaa] ml-1">{(imageStats.width * imageStats.height).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[#666]">Base64 Length:</span>
                            <span className="text-[#aaa] ml-1">{imageStats.base64Length.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      
                      <img 
                        src={imagePreview} 
                        alt="Uploaded" 
                        className="max-w-full h-auto rounded border border-[#2a2a2a]"
                        style={{ maxHeight: '300px' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Message Upload */}
            <div className="flex items-center justify-center">
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
                          JSON array or object with &quot;messages&quot; or &quot;data.messages&quot; field
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>
        ) : !selectedChat ? (
          // Chat list view
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Chats</h2>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md hover:bg-[#252525] transition-colors text-sm">
                  New File
                </div>
              </label>
            </div>
            <div className="grid gap-4">
              {chats.map((chat) => {
                const getTimeAgo = (timestamp: number) => {
                  const now = Date.now();
                  const diff = now - timestamp;
                  const minutes = Math.floor(diff / 60000);
                  const hours = Math.floor(diff / 3600000);
                  const days = Math.floor(diff / 86400000);
                  
                  if (minutes < 1) return 'just now';
                  if (minutes < 60) return `${minutes}m ago`;
                  if (hours < 24) return `${hours}h ago`;
                  if (days < 7) return `${days}d ago`;
                  return new Date(timestamp).toLocaleDateString();
                };

                const getFirstMessage = () => {
                  const firstUserMsg = chat.messages.find(m => m.role === 'user');
                  if (!firstUserMsg) return null;
                  
                  if (typeof firstUserMsg.content === 'string') {
                    return firstUserMsg.content.slice(0, 120);
                  }
                  
                  if (Array.isArray(firstUserMsg.content)) {
                    const textPart = firstUserMsg.content.find(p => p.type === 'text');
                    if (textPart && 'text' in textPart) {
                      return textPart.text.slice(0, 120);
                    }
                  }
                  
                  return null;
                };

                const firstMessage = getFirstMessage();

                return (
                  <button
                    key={chat.chatId}
                    onClick={() => setSelectedChat(chat)}
                    className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 hover:border-[#3a3a3a] hover:bg-[#1f1f1f] transition-all text-left"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3 mb-2">
                          <h3 className="font-medium text-white text-sm truncate">{chat.chatId}</h3>
                          <span className="text-xs text-[#999] whitespace-nowrap">
                            {getTimeAgo(chat.createdAt)}
                          </span>
                        </div>
                        {firstMessage && (
                          <p className="text-sm text-[#888] line-clamp-2 leading-relaxed">
                            {firstMessage}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-3xl font-bold text-white mb-0.5">
                          {chat.totalTokens >= 1000 
                            ? `${(chat.totalTokens / 1000).toFixed(1)}K` 
                            : chat.totalTokens}
                        </div>
                        <div className="text-xs text-[#666] uppercase tracking-wider">tokens</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#666]">
                      <span>{chat.messageCount} messages</span>
                      <span>•</span>
                      <span>{Math.round(chat.totalTokens / chat.messageCount)} avg</span>
                    </div>
                  </button>
                );
              })}
            </div>
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
            </div>

            <TokenStats analysis={selectedChat.analysis} />
            <TokenHeatmap 
              analysis={filteredAnalysis} 
              zoom={zoom} 
              onMessageClick={scrollToMessage}
            />
            <MessageList 
              messages={selectedChat.messages} 
              analysis={filteredAnalysis} 
              zoom={zoom}
              selectedMessageId={selectedMessageId}
              apiKey={apiKey}
              onUpdateAnalysis={handleUpdateAnalysis}
            />
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
