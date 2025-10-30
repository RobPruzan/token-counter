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

// Analyze content and estimate tokens per part
function analyzeContent(content: string | UserContent | AssistantContent | unknown): PartTokenInfo[] {
  console.log('=== Analyzing content ===');
  console.log('Content type:', typeof content);
  console.log('Is array:', Array.isArray(content));
  
  // Handle undefined, null, or empty content
  if (content === undefined || content === null) {
    console.log('⚠ Content is undefined/null - returning empty text');
    return [{
      type: 'text',
      tokens: 0,
      preview: '[empty]'
    }];
  }
  
  console.log('Content:', JSON.stringify(content).slice(0, 200));
  
  if (typeof content === 'string') {
    console.log('✓ String content - Estimating tokens');
    const safeContent = content || '';
    return [{
      type: 'text',
      tokens: Math.ceil(safeContent.length / 4), // Rough estimate: 1 token per 4 chars
      preview: safeContent.slice(0, 100)
    }];
  }
  
  if (Array.isArray(content)) {
    console.log('✓ Array content with', content.length, 'parts');
    
    if (content.length === 0) {
      console.log('⚠ Empty array - returning empty text');
      return [{
        type: 'text',
        tokens: 0,
        preview: '[empty]'
      }];
    }
    
    return content.map((part, idx) => {
      console.log(`  Part ${idx}:`, Object.keys(part));
      if ('text' in part) {
        const safeText = part.text || '';
        const tokens = Math.ceil(safeText.length / 4);
        console.log(`  ✓ Text part - Est. Tokens: ${tokens}`);
        return {
          type: 'text',
          tokens: tokens,
          preview: safeText.slice(0, 100)
        };
      }
      if ('reasoning' in part) {
        const safeReasoning = part.reasoning || '';
        const tokens = Math.ceil(safeReasoning.length / 4);
        console.log(`  ✓ Reasoning part - Est. Tokens: ${tokens}`);
        return {
          type: 'reasoning',
          tokens: tokens,
          preview: safeReasoning.slice(0, 100)
        };
      }
      if ('image' in part) {
        console.log(`  ✓ Image part - Fixed tokens: 1000`);
        return {
          type: 'image',
          tokens: 1000,
          preview: typeof part.image === 'string' ? part.image.slice(0, 50) : 'URL'
        };
      }
      if ('toolName' in part && 'args' in part) {
        const text = JSON.stringify(part.args);
        const tokens = Math.ceil(text.length / 4);
        console.log(`  ✓ Tool call - Est. Tokens: ${tokens}`);
        return {
          type: 'tool-call',
          tokens: tokens,
          preview: `${part.toolName}(${text.slice(0, 50)})`
        };
      }
      if ('toolName' in part && 'result' in part) {
        const text = JSON.stringify(part.result);
        const tokens = Math.ceil(text.length / 4);
        console.log(`  ✓ Tool result - Est. Tokens: ${tokens}`);
        return {
          type: 'tool-result',
          tokens: tokens,
          preview: `Result: ${text.slice(0, 50)}`
        };
      }
      if ('data' in part && 'mediaType' in part) {
        console.log(`  ✓ File part - Fixed tokens: 1000`);
        return {
          type: 'file',
          tokens: 1000,
          preview: part.mediaType
        };
      }
      console.log(`  ✗ Unknown part type - Keys:`, Object.keys(part));
      return {
        type: 'unknown',
        tokens: 0,
        preview: JSON.stringify(part).slice(0, 100)
      };
    });
  }
  
  console.log('✗ Unknown content type');
  console.log('Content is object:', typeof content === 'object');
  if (typeof content === 'object' && content !== null) {
    console.log('Object keys:', Object.keys(content as any));
  }
  
  return [{
    type: 'unknown',
    tokens: 0,
    preview: JSON.stringify(content).slice(0, 100)
  }];
}

export function analyzeMessage(message: Message, index: number): MessageTokenInfo {
  const parts = analyzeContent(message.content);
  const textTokens = parts.filter(p => p.type !== 'image' && p.type !== 'file').reduce((sum, p) => sum + p.tokens, 0);
  const imageTokens = parts.filter(p => p.type === 'image' || p.type === 'file').reduce((sum, p) => sum + p.tokens, 0);

  return {
    messageIndex: index,
    role: message.role,
    tokens: {
      text: textTokens,
      images: imageTokens,
      total: textTokens + imageTokens
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

// Use API to get accurate token counts
export async function analyzeMessagesWithAPI(messages: Message[], apiKey: string): Promise<MessageTokenInfo[]> {
  try {
    // Get total token count from API
    const totalTokens = await countTokensAPI(messages, apiKey);
    console.log('Total tokens from API:', totalTokens);

    // Do the local analysis for breakdown
    const localAnalysis = analyzeMessages(messages);
    const localTotal = getTotalTokens(localAnalysis);

    // If API gave us a different total, scale all the estimates proportionally
    if (localTotal.total > 0 && totalTokens !== localTotal.total) {
      const scaleFactor = totalTokens / localTotal.total;
      console.log('Scaling factor:', scaleFactor);
      
      return localAnalysis.map(msg => ({
        ...msg,
        tokens: {
          text: Math.round(msg.tokens.text * scaleFactor),
          images: msg.tokens.images, // Keep images at fixed 1000
          total: Math.round((msg.tokens.text * scaleFactor) + msg.tokens.images)
        },
        parts: msg.parts.map(part => ({
          ...part,
          tokens: part.type === 'image' || part.type === 'file' 
            ? part.tokens 
            : Math.round(part.tokens * scaleFactor)
        }))
      }));
    }

    return localAnalysis;
  } catch (error) {
    console.error('API analysis failed, falling back to estimates:', error);
    // Fall back to local estimates if API fails
    return analyzeMessages(messages);
  }
}
