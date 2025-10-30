import { Message } from '@/lib/types/ai-messages';
import { MessageTokenInfo } from '@/lib/token-counter';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface MessageListProps {
  messages: Message[];
  analysis: MessageTokenInfo[];
  zoom: number;
}

export function MessageList({ messages, analysis, zoom }: MessageListProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());

  const toggleMessage = (index: number) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedMessages(newExpanded);
  };

  const roleColors: Record<string, string> = {
    system: '#8b5cf6',
    user: '#3b82f6',
    assistant: '#10b981',
    tool: '#f59e0b'
  };

  const renderContent = (content: any): React.ReactNode => {
    if (typeof content === 'string') {
      return <div className="text-sm text-[#ccc] whitespace-pre-wrap break-words">{content}</div>;
    }

    if (Array.isArray(content)) {
      return (
        <div className="space-y-3">
          {content.map((part, idx) => {
            if ('text' in part) {
              return (
                <div key={idx} className="text-sm text-[#ccc] whitespace-pre-wrap break-words">
                  {part.text}
                </div>
              );
            }
            if ('reasoning' in part) {
              return (
                <div key={idx} className="bg-[#1a1a2a] border border-[#2a2a4a] rounded p-3">
                  <div className="text-xs text-[#888] mb-2">Reasoning</div>
                  <div className="text-sm text-[#ccc] whitespace-pre-wrap">{part.reasoning}</div>
                </div>
              );
            }
            if ('image' in part) {
              const imgSrc = typeof part.image === 'string' 
                ? part.image.startsWith('data:') || part.image.startsWith('http')
                  ? part.image
                  : `data:${part.mediaType || 'image/png'};base64,${part.image}`
                : part.image.toString();
              
              return (
                <div key={idx} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-2">
                  <div className="text-xs text-[#888] mb-2">Image</div>
                  <img 
                    src={imgSrc} 
                    alt="Content" 
                    className="max-w-full h-auto rounded"
                    style={{ maxHeight: `${400 * zoom}px` }}
                  />
                </div>
              );
            }
            if ('toolName' in part && 'args' in part) {
              return (
                <div key={idx} className="bg-[#1a1a1a] border border-[#3a2a1a] rounded p-3">
                  <div className="text-xs text-[#f59e0b] mb-2">Tool Call: {part.toolName}</div>
                  <pre className="text-xs text-[#ccc] overflow-x-auto">
                    {JSON.stringify(part.args, null, 2)}
                  </pre>
                </div>
              );
            }
            if ('toolName' in part && 'result' in part) {
              return (
                <div key={idx} className="bg-[#1a1a1a] border border-[#1a3a2a] rounded p-3">
                  <div className="text-xs text-[#10b981] mb-2">Tool Result: {part.toolName}</div>
                  <pre className="text-xs text-[#ccc] overflow-x-auto">
                    {JSON.stringify(part.result, null, 2)}
                  </pre>
                </div>
              );
            }
            if ('data' in part && 'mediaType' in part) {
              return (
                <div key={idx} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-3">
                  <div className="text-xs text-[#888] mb-2">File: {part.mediaType}</div>
                  <div className="text-xs text-[#666]">Binary data</div>
                </div>
              );
            }
            return null;
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
        const color = roleColors[item.role] || '#888';

        return (
          <div
            key={item.messageIndex}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleMessage(item.messageIndex)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors text-left"
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
                <div className="flex flex-wrap gap-2 text-xs">
                  {item.parts.map((part, idx) => (
                    <div
                      key={idx}
                      className="px-2 py-1 bg-[#252525] rounded text-[#888]"
                    >
                      {part.type}: {part.tokens} tokens
                    </div>
                  ))}
                </div>
                
                <div className="border-t border-[#2a2a2a] pt-4">
                  {renderContent(message.content)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
