import { MessageTokenInfo } from '@/lib/token-counter';
import { useMemo } from 'react';

interface TokenHeatmapProps {
  analysis: MessageTokenInfo[];
  zoom: number;
}

export function TokenHeatmap({ analysis, zoom }: TokenHeatmapProps) {
  const maxTokens = Math.max(...analysis.map(m => m.tokens.total), 1);
  
  const roleColors: Record<string, string> = {
    system: '#8b5cf6',
    user: '#3b82f6',
    assistant: '#10b981',
    tool: '#f59e0b'
  };

  const heatmapData = useMemo(() => {
    return analysis.map((msg) => {
      const intensity = msg.tokens.total / maxTokens;
      return {
        ...msg,
        intensity,
        height: Math.max(20, intensity * 120 * zoom)
      };
    });
  }, [analysis, maxTokens, zoom]);

  if (analysis.length === 0) return null;

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
      <div className="text-sm font-medium mb-4">Token Distribution Heatmap</div>
      
      <div className="flex items-end gap-1 overflow-x-auto pb-2">
        {heatmapData.map((item, idx) => {
          const baseColor = roleColors[item.role] || '#888';
          
          return (
            <div
              key={idx}
              className="relative group flex-shrink-0"
              style={{ 
                width: `${Math.max(8, 100 / heatmapData.length)}px`,
                minWidth: '8px'
              }}
            >
              <div
                className="rounded-sm transition-all hover:opacity-80 cursor-pointer"
                style={{
                  height: `${item.height}px`,
                  backgroundColor: baseColor,
                  opacity: 0.3 + item.intensity * 0.7
                }}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-xs whitespace-nowrap shadow-lg">
                  <div className="font-medium mb-1">Message {item.messageIndex}</div>
                  <div className="text-[#888]">{item.role}</div>
                  <div className="font-semibold mt-1">{item.tokens.total} tokens</div>
                  {item.tokens.images > 0 && (
                    <div className="text-[#888] text-[10px]">
                      {item.tokens.images} media
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-4 text-xs text-[#666]">
        <div>Message 0</div>
        <div>Message {analysis.length - 1}</div>
      </div>

      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {Object.entries(roleColors).map(([role, color]) => (
          <div key={role} className="flex items-center gap-2 text-xs">
            <div 
              className="w-3 h-3 rounded"
              style={{ backgroundColor: color }}
            />
            <span className="text-[#888]">{role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
