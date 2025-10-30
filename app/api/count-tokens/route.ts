import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { messages, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Transform messages to Anthropic's expected format
    const transformedMessages = messages
      .filter((msg: Record<string, unknown>) => msg.role !== 'system')
      .map((msg: Record<string, unknown>, msgIndex: number) => {
        let content = msg.content;
        
        // Handle undefined/null/empty content
        if (!content || (Array.isArray(content) && content.length === 0)) {
          content = '[empty]';
        }
        
        // If content is already a string, keep it as-is
        if (typeof content === 'string') {
          return { role: msg.role, content };
        }
        
        // Transform content array to Anthropic format
        if (Array.isArray(content)) {
          const transformedContent = content.map((part: Record<string, unknown>) => {
            // Text part - already in correct format
            if (part.type === 'text' && 'text' in part) {
              return { type: 'text', text: part.text || '' };
            }
            
            // Legacy format: has 'text' property without type
            if ('text' in part && !part.type) {
              return { type: 'text', text: part.text || '' };
            }
            
            // Image part
            if ('image' in part) {
              const imageData = typeof part.image === 'string' ? part.image : String(part.image);
              if (imageData.startsWith('data:')) {
                const [mediaType, base64Data] = imageData.split(',');
                const type = mediaType.split(':')[1]?.split(';')[0] || 'image/jpeg';
                return {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: type,
                    data: base64Data,
                  },
                };
              }
              return {
                type: 'image',
                source: { type: 'url', url: imageData },
              };
            }
            
            // Document/File part
            if ('data' in part && 'mediaType' in part) {
              return {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: part.mediaType,
                  data: part.data,
                },
              };
            }
            
            // Tool result with output field (e.g., screenshot tool)
            if ('output' in part && part.output && typeof part.output === 'object') {
              const output = part.output as any;
              
              // Screenshot output: {type: "image", data: base64, filePath: ...}
              if (output.type === 'image' && 'data' in output && typeof output.data === 'string') {
                return {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: output.data,
                  },
                };
              }
              
              // Other output formats - convert to text
              return { type: 'text', text: typeof output === 'string' ? output : JSON.stringify(output) };
            }
            
            // Screenshot tool output: {type: "image", data: base64, filePath: ...}
            if ('data' in part && part.type === 'image' && typeof part.data === 'string') {
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: part.data,
                },
              };
            }
            
            // Tool call/result/reasoning - convert to text
            if ('toolName' in part || 'reasoning' in part) {
              const text = String(part.reasoning || 
                          ('args' in part ? `[Tool: ${String(part.toolName)}]` : `[Result: ${String(part.toolName)}]`));
              return { type: 'text', text };
            }
            
            // Unknown - convert to text
            return { type: 'text', text: JSON.stringify(part) };
          });
          
          return { role: msg.role, content: transformedContent };
        }
        
        // Fallback for other types
        return { role: msg.role, content: String(content) };
      });
    
    // Shim: Extract images from assistant messages and inject as user messages
    // Anthropic doesn't allow image blocks in assistant messages
    const anthropicMessages: Record<string, unknown>[] = [];
    for (const msg of transformedMessages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const images = msg.content.filter((part: Record<string, unknown>) => part.type === 'image');
        const nonImages = msg.content.filter((part: Record<string, unknown>) => part.type !== 'image');
        
        // Add assistant message without images
        if (nonImages.length > 0) {
          anthropicMessages.push({ role: 'assistant', content: nonImages });
        } else {
          anthropicMessages.push({ role: 'assistant', content: '[tool output]' });
        }
        
        // If there were images, inject a fake user message with them
        if (images.length > 0) {
          anthropicMessages.push({ 
            role: 'user', 
            content: images 
          });
        }
      } else {
        anthropicMessages.push(msg);
      }
    }

    // Extract system message if present
    const systemMessage = messages.find((m: Record<string, unknown>) => m.role === 'system');
    const systemContent = systemMessage?.content;

    const requestBody: Record<string, unknown> = {
      model: 'claude-sonnet-4-5-20250929',
      messages: anthropicMessages,
    };

    // Only add system if it exists and has content
    if (systemContent && typeof systemContent === 'string' && systemContent.trim()) {
      requestBody.system = systemContent;
    }

    // Call Anthropic API to count tokens
    const response = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return NextResponse.json(
        { error: `Anthropic API error: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Token counting error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
