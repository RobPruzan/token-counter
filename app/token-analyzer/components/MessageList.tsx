import { Message } from '@/lib/types/ai-messages';
import { MessageTokenInfo } from '@/lib/token-counter';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ImageStats {
  width: number;
  height: number;
  fileType: string;
  sizeKB: number;
}

const ImagePreview = ({ base64Data }: { base64Data: string }) => {
  const [stats, setStats] = useState<ImageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const img = new Image();
    const dataUrl = `data:image/jpeg;base64,${base64Data}`;
    
    img.onload = () => {
      // Detect file type from base64 header
      let fileType = 'JPEG';
      if (base64Data.startsWith('/9j/')) {
        fileType = 'JPEG';
      } else if (base64Data.startsWith('iVBOR')) {
        fileType = 'PNG';
      } else if (base64Data.startsWith('R0lGOD')) {
        fileType = 'GIF';
      } else if (base64Data.startsWith('UklGR')) {
        fileType = 'WebP';
      }
      
      setStats({
        width: img.width,
        height: img.height,
        fileType,
        sizeKB: parseFloat((base64Data.length * 0.75 / 1024).toFixed(1))
      });
      setLoading(false);
    };
    
    img.onerror = () => {
      setLoading(false);
    };
    
    img.src = dataUrl;
  }, [base64Data]);

  if (loading) {
    return <div className="text-xs text-[#666]">Loading image...</div>;
  }

  if (!stats) {
    return <div className="text-xs text-[#666]">Failed to load image</div>;
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-[#666]">Resolution:</span>
          <span className="text-[#aaa] ml-1">{stats.width} × {stats.height}</span>
        </div>
        <div>
          <span className="text-[#666]">Type:</span>
          <span className="text-[#aaa] ml-1">{stats.fileType}</span>
        </div>
        <div>
          <span className="text-[#666]">Size:</span>
          <span className="text-[#aaa] ml-1">{stats.sizeKB} KB</span>
        </div>
        <div>
          <span className="text-[#666]">Pixels:</span>
          <span className="text-[#aaa] ml-1">{(stats.width * stats.height).toLocaleString()}</span>
        </div>
      </div>
      <img 
        src={`data:image/jpeg;base64,${base64Data}`}
        alt="Screenshot"
        className="max-w-full h-auto rounded border border-[#2a2a2a]"
        style={{ maxHeight: '400px' }}
      />
    </div>
  );
};

interface MessageListProps {
  messages: Message[];
  analysis: MessageTokenInfo[];
  zoom: number;
  selectedMessageId: number | null;
  apiKey: string;
  onUpdateAnalysis: (messageIndex: number, newAnalysis: MessageTokenInfo) => void;
}

export function MessageList({ messages, analysis, zoom, selectedMessageId, apiKey, onUpdateAnalysis }: MessageListProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());

  // Auto-expand selected message
  useEffect(() => {
    if (selectedMessageId !== null) {
      setExpandedMessages(prev => new Set(prev).add(selectedMessageId));
    }
  }, [selectedMessageId]);

  const toggleMessage = (index: number) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedMessages(newExpanded);
  };

  const togglePart = (messageIndex: number, partIndex: number) => {
    const key = `${messageIndex}-${partIndex}`;
    const newExpanded = new Set(expandedParts);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedParts(newExpanded);
  };

  const scrollToPart = (messageIndex: number, partIndex: number) => {
    const element = document.getElementById(`part-${messageIndex}-${partIndex}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight briefly
      element.classList.add('ring-2', 'ring-blue-500');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-500');
      }, 2000);
    }
  };

  const roleColors: Record<string, string> = {
    system: '#8b5cf6',
    user: '#3b82f6',
    assistant: '#10b981',
    tool: '#f59e0b'
  };

  const getPartLabel = (part: any) => {
    if ('text' in part) return '📝 Text';
    if ('reasoning' in part) return '💭 Reasoning';
    if ('image' in part) return '🖼️ Image';
    if ('type' in part) {
      if (part.type === 'file') return `📎 ${part.filename || 'File'}`;
      if (part.type === 'step-start') return '▶️ Step';
      if (part.type.startsWith('tool-')) {
        const toolName = part.type.replace('tool-', '').replace(/([A-Z])/g, ' $1').trim();
        return `🔧 ${toolName}`;
      }
      return `❓ ${part.type}`;
    }
    return '❓ Unknown';
  };

  const renderContent = (content: any, messageIndex: number): React.ReactNode => {
    if (typeof content === 'string') {
      return <div className="text-sm text-[#ccc] whitespace-pre-wrap break-words">{content}</div>;
    }

    if (Array.isArray(content)) {
      return (
        <div className="space-y-3">
          {content.map((part: any, idx) => {
            const partKey = `${messageIndex}-${idx}`;
            const isExpanded = expandedParts.has(partKey);
            
            // Handle text parts
            if ('text' in part) {
              return (
                <div key={idx} id={`part-${messageIndex}-${idx}`} className="border border-[#2a2a2a] rounded p-3 transition-all">
                  <button
                    onClick={() => togglePart(messageIndex, idx)}
                    className="w-full text-left flex items-center justify-between mb-2"
                  >
                    <span className="text-xs text-[#888]">📝 Text</span>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  {isExpanded && (
                    <div className="text-sm text-[#ccc] whitespace-pre-wrap break-words">
                      {part.text}
                    </div>
                  )}
                </div>
              );
            }
            
            // Handle reasoning parts
            if ('reasoning' in part) {
              return (
                <div key={idx} id={`part-${messageIndex}-${idx}`} className="bg-[#1a1a2a] border border-[#2a2a4a] rounded p-3 transition-all">
                  <button
                    onClick={() => togglePart(messageIndex, idx)}
                    className="w-full text-left flex items-center justify-between mb-2"
                  >
                    <span className="text-xs text-[#888]">💭 Reasoning</span>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  {isExpanded && (
                    <div className="text-sm text-[#ccc] whitespace-pre-wrap">{part.reasoning}</div>
                  )}
                </div>
              );
            }
            
            // Handle old-format images
            if ('image' in part) {
              const imgSrc = typeof part.image === 'string' 
                ? part.image.startsWith('data:') || part.image.startsWith('http')
                  ? part.image
                  : `data:${part.mediaType || 'image/png'};base64,${part.image}`
                : part.image.toString();
              
              return (
                <div key={idx} id={`part-${messageIndex}-${idx}`} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-2 transition-all">
                  <button
                    onClick={() => togglePart(messageIndex, idx)}
                    className="w-full text-left flex items-center justify-between mb-2"
                  >
                    <span className="text-xs text-[#888]">🖼️ Image (~1.4K tokens)</span>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  {isExpanded && (
                    <img 
                      src={imgSrc} 
                      alt="Content" 
                      className="max-w-full h-auto rounded"
                      style={{ maxHeight: `${400 * zoom}px` }}
                    />
                  )}
                </div>
              );
            }
            
            // Handle file parts (user uploads)
            if ('type' in part && part.type === 'file' && 'url' in part) {
              const isImage = part.mediaType?.startsWith('image/');
              return (
                <div key={idx} id={`part-${messageIndex}-${idx}`} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-2 transition-all">
                  <button
                    onClick={() => togglePart(messageIndex, idx)}
                    className="w-full text-left flex items-center justify-between mb-2"
                  >
                    <span className="text-xs text-[#888]">
                      📎 {part.filename || 'File'} ({part.mediaType})
                      {isImage && ' • ~1.4K tokens'}
                    </span>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  {isExpanded && (
                    isImage && part.url ? (
                      <img 
                        src={part.url} 
                        alt={part.filename || 'File'} 
                        className="max-w-full h-auto rounded"
                        style={{ maxHeight: `${400 * zoom}px` }}
                      />
                    ) : (
                      <div className="text-xs text-[#666]">Binary data</div>
                    )
                  )}
                </div>
              );
            }
            
            // Handle step-start parts
            if ('type' in part && part.type === 'step-start') {
              return (
                <div key={idx} id={`part-${messageIndex}-${idx}`} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-2 transition-all">
                  <div className="text-xs text-[#888]">▶️ Step</div>
                </div>
              );
            }
            
            // Handle tool calls (new format)
            if ('type' in part && typeof part.type === 'string' && part.type.startsWith('tool-')) {
              const toolName = part.type.replace('tool-', '').replace(/([A-Z])/g, ' $1').trim();
              const hasImageOutput = part.output && typeof part.output === 'object' && part.output.type === 'image';
              
              return (
                <div key={idx} id={`part-${messageIndex}-${idx}`} className="bg-[#1a1a1a] border border-[#3a2a1a] rounded p-3 transition-all">
                  <button
                    onClick={() => togglePart(messageIndex, idx)}
                    className="w-full text-left flex items-center justify-between mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#f59e0b]">🔧 {toolName}</span>
                      {part.state && <span className="text-xs text-[#666]">• {part.state}</span>}
                      {hasImageOutput && <span className="text-xs text-[#888]">• Screenshot</span>}
                    </div>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  
                  {isExpanded && (
                    <div className="space-y-3">
                      {part.input && (
                        <div>
                          <div className="text-xs text-[#666] mb-1">Input:</div>
                          <pre className="text-xs text-[#ccc] overflow-x-auto bg-[#0f0f0f] p-2 rounded">
                            {JSON.stringify(part.input, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {part.output && (
                        <div>
                          <div className="text-xs text-[#666] mb-1">Output:</div>
                          {hasImageOutput ? (
                            <div className="space-y-2">
                              <div className="text-xs text-[#888]">
                                Screenshot ({(part.output.data.length / 1024).toFixed(1)}KB • ~1.4K tokens)
                              </div>
                              <img 
                                src={`data:image/jpeg;base64,${part.output.data}`}
                                alt="Screenshot" 
                                className="max-w-full h-auto rounded"
                                style={{ maxHeight: `${400 * zoom}px` }}
                              />
                            </div>
                          ) : (
                            <pre className="text-xs text-[#ccc] overflow-x-auto bg-[#0f0f0f] p-2 rounded">
                              {typeof part.output === 'string' 
                                ? part.output 
                                : JSON.stringify(part.output, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            
            return (
              <div key={idx} id={`part-${messageIndex}-${idx}`} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-3 transition-all">
                <button
                  onClick={() => togglePart(messageIndex, idx)}
                  className="w-full text-left flex items-center justify-between mb-2"
                >
                  <span className="text-xs text-[#888]">❓ Unknown Part</span>
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                {isExpanded && (
                  <pre className="text-xs text-[#666] overflow-x-auto">
                    {JSON.stringify(part, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return <div className="text-sm text-[#666]">Unknown content type</div>;
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium mb-3">Messages</div>
      {analysis.map((item) => {
        const message = messages[item.messageIndex];
        const isExpanded = expandedMessages.has(item.messageIndex);
        const isSelected = selectedMessageId === item.messageIndex;
        const color = roleColors[item.role] || '#888';

        return (
          <div
            id={`message-${item.messageIndex}`}
            key={item.messageIndex}
            className={`bg-[#1a1a1a] border rounded-lg overflow-hidden transition-all ${
              isSelected 
                ? 'border-[#4a4a4a] ring-2 ring-[#3a3a3a]' 
                : 'border-[#2a2a2a]'
            }`}
          >
            <button
              onClick={() => toggleMessage(item.messageIndex)}
              className={`w-full px-4 py-3 flex items-center justify-between transition-colors text-left ${
                isSelected ? 'bg-[#252525]' : 'hover:bg-[#1f1f1f]'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">Message {item.messageIndex}</span>
                  <span className="text-[#888] ml-2">{item.role}</span>
                </div>
                <div className="text-sm text-[#888] flex items-center gap-4 flex-shrink-0">
                  {item.parts.length > 1 && (
                    <span className="text-xs">{item.parts.length} parts</span>
                  )}
                  <span className="font-medium">{item.tokens.total} tokens</span>
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs text-[#888] font-medium">Token Breakdown</div>
                  {[...item.parts].sort((a, b) => b.tokens - a.tokens).map((part, idx) => {
                    const percentage = (part.tokens / item.tokens.total) * 100;
                    const partKey = `${item.messageIndex}-${idx}`;
                    const isPartExpanded = expandedParts.has(partKey);
                    const isToolCall = part.type === 'tool-call';
                    
                    // Get tool name for tool calls
                    let displayName = part.type;
                    if (isToolCall) {
                      const messageContent = message.content;
                      if (Array.isArray(messageContent) && messageContent[idx]) {
                        const actualPart = messageContent[idx];
                        if (actualPart.type?.startsWith('tool-')) {
                          displayName = actualPart.type.replace('tool-', '').replace(/([A-Z])/g, ' $1').trim();
                        }
                      }
                    }
                    
                    return (
                      <div key={idx} className="space-y-1">
                        <button
                          onClick={() => {
                            if (isToolCall) {
                              togglePart(item.messageIndex, idx);
                            }
                          }}
                          className={`w-full flex items-center justify-between text-xs ${isToolCall ? 'hover:bg-[#252525] rounded px-2 py-1 cursor-pointer' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[#aaa]">{displayName}</span>
                            {isToolCall && (isPartExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                          </div>
                          <span className="text-[#888]">
                            {part.tokens.toLocaleString()} tokens ({percentage.toFixed(1)}%)
                          </span>
                        </button>
                        <div className="h-1.5 bg-[#0f0f0f] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: color,
                              opacity: 0.6
                            }}
                          />
                        </div>
                        
                        {/* Show tool call details when expanded */}
                        {isToolCall && isPartExpanded && (
                          <div className="mt-2 ml-4 p-3 bg-[#0f0f0f] rounded border border-[#2a2a2a]">
                            {(() => {
                              // Get the actual message content part
                              const messageContent = message.content;
                              if (Array.isArray(messageContent) && messageContent[idx]) {
                                const actualPart = messageContent[idx];
                                const toolName = actualPart.type?.replace('tool-', '').replace(/([A-Z])/g, ' $1').trim() || 'Unknown Tool';
                                
                                return (
                                  <div className="space-y-3">
                                    <div>
                                      <div className="text-xs text-[#666] mb-1">Tool Name:</div>
                                      <div className="text-xs text-[#ddd] font-medium">{toolName}</div>
                                    </div>
                                    
                                    {actualPart.input && (
                                      <div>
                                        <div className="text-xs text-[#666] mb-1">Input:</div>
                                        <pre className="text-xs text-[#999] whitespace-pre-wrap break-words font-mono p-2 bg-[#1a1a1a] rounded">
                                          {JSON.stringify(actualPart.input, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                    
                                    {actualPart.output && (
                                      <div>
                                        <div className="text-xs text-[#666] mb-1">Output:</div>
                                        {actualPart.output.type === 'image' && actualPart.output.data ? (
                                          <ImagePreview base64Data={actualPart.output.data} />
                                        ) : (
                                          <pre className="text-xs text-[#999] whitespace-pre-wrap break-words font-mono p-2 bg-[#1a1a1a] rounded max-h-[300px] overflow-y-auto">
                                            {typeof actualPart.output === 'string' 
                                              ? actualPart.output 
                                              : JSON.stringify(actualPart.output, null, 2)}
                                          </pre>
                                        )}
                                      </div>
                                    )}
                                    
                                    {actualPart.state && (
                                      <div>
                                        <div className="text-xs text-[#666] mb-1">State:</div>
                                        <div className="text-xs text-[#999]">{actualPart.state}</div>
                                      </div>
                                    )}
                                    
                                    {/* Raw Data Section */}
                                    <div>
                                      <div className="text-xs text-[#666] mb-1">Raw Tool Call Data (sent to Anthropic):</div>
                                      <pre className="text-xs text-[#999] whitespace-pre-wrap break-words font-mono p-2 bg-[#1a1a1a] rounded max-h-[400px] overflow-y-auto">
                                        {JSON.stringify(actualPart, (key, value) => {
                                          // Truncate base64 data for readability
                                          if (key === 'data' && typeof value === 'string' && value.length > 100) {
                                            return value.substring(0, 100) + `... [${value.length} chars total, ${(value.length * 0.75 / 1024).toFixed(1)}KB]`;
                                          }
                                          return value;
                                        }, 2)}
                                      </pre>
                                      <div className="text-xs text-[#666] mt-2">
                                        Structure size: {JSON.stringify(actualPart).length.toLocaleString()} characters
                                        {actualPart.output?.data && (
                                          <> • Base64 length: {actualPart.output.data.length.toLocaleString()} chars</>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Fallback to preview
                              return (
                                <div className="text-xs text-[#999] whitespace-pre-wrap break-words font-mono">
                                  {part.preview}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
