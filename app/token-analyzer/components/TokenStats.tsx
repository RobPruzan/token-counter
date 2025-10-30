import { MessageTokenInfo, getTotalTokens } from '@/lib/token-counter';

interface TokenStatsProps {
  analysis: MessageTokenInfo[];
}

export function TokenStats({ analysis }: TokenStatsProps) {
  const totals = getTotalTokens(analysis);
  
  const byRole = analysis.reduce((acc, msg) => {
    if (!acc[msg.role]) {
      acc[msg.role] = { text: 0, images: 0, total: 0 };
    }
    acc[msg.role].text += msg.tokens.text;
    acc[msg.role].images += msg.tokens.images;
    acc[msg.role].total += msg.tokens.total;
    return acc;
  }, {} as Record<string, { text: number; images: number; total: number }>);

  const roleColors: Record<string, string> = {
    system: '#8b5cf6',
    user: '#3b82f6',
    assistant: '#10b981',
    tool: '#f59e0b'
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
        <div className="text-sm text-[#888] mb-1">Total Tokens</div>
        <div className="text-2xl font-semibold">{totals.total.toLocaleString()}</div>
        <div className="text-xs text-[#666] mt-2">
          {totals.text.toLocaleString()} text + {totals.images.toLocaleString()} media
        </div>
      </div>

      {Object.entries(byRole).map(([role, tokens]) => (
        <div key={role} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <div className="text-sm text-[#888] mb-1 flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: roleColors[role] || '#888' }}
            />
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </div>
          <div className="text-2xl font-semibold">{tokens.total.toLocaleString()}</div>
          <div className="text-xs text-[#666] mt-2">
            {((tokens.total / totals.total) * 100).toFixed(1)}% of total
          </div>
        </div>
      ))}
    </div>
  );
}
