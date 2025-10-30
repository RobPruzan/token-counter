import { MessageTokenInfo, PartTokenInfo } from '@/lib/token-counter';
import { useMemo, useState } from 'react';

interface PartHeatmapProps {
  analysis: MessageTokenInfo[];
  zoom: number;
}

interface CellData {
  part: PartTokenInfo;
  messageIndex: number;
  role: string;
  intensity: number;
}

export function PartHeatmap({ analysis, zoom }: PartHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<CellData | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { cells, maxTokens } = useMemo(() => {
    const allCells: CellData[] = [];
    let max = 1;

    analysis.forEach(msg => {
      msg.parts.forEach(part => {
        allCells.push({
          part,
          messageIndex: msg.messageIndex,
          role: msg.role,
          intensity: 0
        });
        if (part.tokens > max) max = part.tokens;
      });
    });

    // Calculate intensity
    allCells.forEach(cell => {
      cell.intensity = cell.part.tokens / max;
    });

    return { cells: allCells, maxTokens: max };
  }, [analysis]);

  const getColor = (intensity: number, role: string) => {
    const roleColors: Record<string, string> = {
      system: '139, 92, 246', // purple
      user: '59, 130, 246',    // blue
      assistant: '16, 185, 129', // green
      tool: '245, 158, 11'     // orange
    };

    const rgb = roleColors[role] || '136, 136, 136';
    return `rgba(${rgb}, ${0.2 + intensity * 0.8})`;
  };

  const cellSize = Math.max(12, 24 * zoom);
  const columns = Math.max(10, Math.floor(800 / cellSize));

  if (cells.length === 0) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
        <div className="text-sm font-medium mb-4">Part-Level Token Heatmap</div>
        <div className="text-[#666] text-sm">No parts to display</div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
      <div className="text-sm font-medium mb-4">Part-Level Token Heatmap</div>
      <div className="text-xs text-[#666] mb-4">
        Each cell = 1 part • Total: {cells.length} parts • Max: {maxTokens.toLocaleString()} tokens
      </div>

      <div 
        className="relative"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
          gap: '2px',
          maxHeight: '600px',
          overflow: 'auto'
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        {cells.map((cell, idx) => (
          <div
            key={idx}
            className="rounded-sm cursor-pointer transition-transform hover:scale-110 hover:z-10"
            style={{
              width: `${cellSize}px`,
              height: `${cellSize}px`,
              backgroundColor: getColor(cell.intensity, cell.role),
              border: hoveredCell === cell ? '1px solid #fff' : 'none'
            }}
            onMouseEnter={() => setHoveredCell(cell)}
            onMouseLeave={() => setHoveredCell(null)}
          />
        ))}
      </div>

      {hoveredCell && (
        <div 
          className="fixed bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs shadow-xl z-50 pointer-events-none"
          style={{
            left: `${mousePos.x + 20}px`,
            top: `${mousePos.y + 20}px`
          }}
        >
          <div className="font-medium mb-1">Message {hoveredCell.messageIndex}</div>
          <div className="text-[#888] mb-1">{hoveredCell.role}</div>
          <div className="text-[#aaa] mb-1 capitalize">{hoveredCell.part.type}</div>
          <div className="font-semibold text-[#4ade80]">{hoveredCell.part.tokens.toLocaleString()} tokens</div>
          {hoveredCell.part.preview && (
            <div className="text-[#666] mt-1 max-w-xs truncate">
              {hoveredCell.part.preview}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 mt-4 flex-wrap text-xs">
        <div className="text-[#666]">Role colors:</div>
        {Object.entries({
          system: '139, 92, 246',
          user: '59, 130, 246',
          assistant: '16, 185, 129',
          tool: '245, 158, 11'
        }).map(([role, rgb]) => (
          <div key={role} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded"
              style={{ backgroundColor: `rgb(${rgb})` }}
            />
            <span className="text-[#888]">{role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
