import { Message, AssistantContent, UserContent } from './types/ai-messages';

export interface TokenCount {
  text: number;
  images: number;
  total: number;
}

export interface MessageTokenInfo {
  messageIndex: number;
  role: string;
  tokens: TokenCount;
  parts: PartTokenInfo[];
}

export interface PartTokenInfo {
  type: string;
  tokens: number;
  preview?: string;
  imageUrl?: string;
}

// Call the API to count tokens for a set of messages
export async function countTokensAPI(messages: Message[], apiKey: string): Promise<number> {
  try {
    console.log('Calling /api/count-tokens with', messages.length, 'messages');
    const response = await fetch('/api/count-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, apiKey }),
    });

    console.log('API response status:', response.status);

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error(`API route not found (404). The server might need to restart.`);
      }
      
      let errorMessage;
      try {
        const error = await response.json();
        errorMessage = error.error || `API error: ${response.status}`;
      } catch {
        const text = await response.text();
        errorMessage = `API error: ${response.status} - ${text.slice(0, 100)}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('API response data:', data);
    return data.input_tokens || 0;
  } catch (error) {
    console.error('Error counting tokens:', error);
    throw error;
  }
}

// Parse content structure for display purposes only (no token estimation)
function analyzeContent(content: string | UserContent | AssistantContent | unknown): PartTokenInfo[] {
  // Handle undefined, null, or empty content
  if (content === undefined || content === null) {
    return [{
      type: 'text',
      tokens: 0,
      preview: '[empty]'
    }];
  }
  
  if (typeof content === 'string') {
    const safeContent = content || '';
    return [{
      type: 'text',
      tokens: 0,
      preview: safeContent.slice(0, 100)
    }];
  }
  
  if (Array.isArray(content)) {
    if (content.length === 0) {
      return [{
        type: 'text',
        tokens: 0,
        preview: '[empty]'
      }];
    }
    
    return content.map((part: any) => {
      // Handle text parts
      if ('text' in part) {
        const safeText = part.text || '';
        return {
          type: 'text',
          tokens: 0,
          preview: safeText.slice(0, 100)
        };
      }
      
      // Handle reasoning parts
      if ('reasoning' in part) {
        const safeReasoning = part.reasoning || '';
        return {
          type: 'reasoning',
          tokens: 0,
          preview: safeReasoning.slice(0, 100)
        };
      }
      
      // Handle image parts
      if ('image' in part) {
        return {
          type: 'image',
          tokens: 0,
          preview: typeof part.image === 'string' ? part.image.slice(0, 50) : 'URL'
        };
      }
      
      // Handle file parts
      if ('type' in part && part.type === 'file' && 'mediaType' in part) {
        return {
          type: 'file',
          tokens: 0,
          preview: `${part.filename || 'file'} (${part.mediaType})`,
          imageUrl: part.url
        };
      }
      
      // Handle tool calls
      if ('type' in part && typeof part.type === 'string' && part.type.startsWith('tool-')) {
        const toolName = part.type.replace('tool-', '').split(/(?=[A-Z])/).join(' ');
        let preview = toolName;
        let imageUrl = undefined;
        
        if ('input' in part) {
          const inputText = JSON.stringify(part.input);
          preview = `${toolName}: ${inputText.slice(0, 50)}`;
        }
        
        if ('output' in part) {
          if (typeof part.output === 'string') {
            preview += ` → ${part.output.slice(0, 50)}`;
          } else if (typeof part.output === 'object' && part.output !== null) {
            if (part.output.type === 'image' && part.output.data) {
              imageUrl = `data:image/jpeg;base64,${part.output.data}`;
              preview = `${toolName} → screenshot (${(part.output.data.length / 1024).toFixed(1)}KB)`;
            } else {
              const outputText = JSON.stringify(part.output);
              preview += ` → ${outputText.slice(0, 50)}`;
            }
          }
        }
        
        return {
          type: 'tool-call',
          tokens: 0,
          preview: preview,
          imageUrl: imageUrl
        };
      }
      
      return {
        type: 'unknown',
        tokens: 0,
        preview: JSON.stringify(part).slice(0, 100)
      };
    });
  }
  
  return [{
    type: 'unknown',
    tokens: 0,
    preview: JSON.stringify(content).slice(0, 100)
  }];
}

export function analyzeMessage(message: Message, index: number): MessageTokenInfo {
  const parts = analyzeContent(message.content);

  return {
    messageIndex: index,
    role: message.role,
    tokens: {
      text: 0,
      images: 0,
      total: 0
    },
    parts
  };
}

export function analyzeMessages(messages: Message[]): MessageTokenInfo[] {
  return messages.map((message, index) => analyzeMessage(message, index));
}

export function getTotalTokens(analysis: MessageTokenInfo[]): TokenCount {
  return analysis.reduce((total, msg) => ({
    text: total.text + msg.tokens.text,
    images: total.images + msg.tokens.images,
    total: total.total + msg.tokens.total
  }), { text: 0, images: 0, total: 0 });
}

// Use API to get accurate token counts - this is the ONLY way to get real counts
export async function analyzeMessagesWithAPI(messages: Message[], apiKey: string): Promise<MessageTokenInfo[]> {
  try {
    // Get total token count from API
    const totalTokens = await countTokensAPI(messages, apiKey);
    console.log('Total tokens from Anthropic API:', totalTokens);

    // Parse structure for breakdown (tokens set to 0, will be distributed)
    const localAnalysis = analyzeMessages(messages);
    
    // Count total parts across all messages to distribute tokens
    const totalParts = localAnalysis.reduce((sum, msg) => sum + msg.parts.length, 0);
    
    if (totalParts === 0) {
      return localAnalysis;
    }
    
    // Distribute the API token count proportionally across parts
    // This is still an approximation but at least the total will be accurate
    const tokensPerPart = totalTokens / totalParts;
    
    return localAnalysis.map(msg => {
      const partTokens = msg.parts.map(part => Math.round(tokensPerPart));
      const msgTotal = partTokens.reduce((sum, t) => sum + t, 0);
      
      return {
        ...msg,
        tokens: {
          text: msgTotal,
          images: 0,
          total: msgTotal
        },
        parts: msg.parts.map((part, idx) => ({
          ...part,
          tokens: partTokens[idx]
        }))
      };
    });
  } catch (error) {
    console.error('API analysis failed:', error);
    throw error;
  }
}
