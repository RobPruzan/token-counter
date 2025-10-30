export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  image: string | URL;
  mediaType?: string;
}

export interface FilePart {
  type: 'file';
  data: string;
  mediaType: string;
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
}

export interface ReasoningPart {
  type: 'reasoning';
  reasoning: string;
}

export type UserContent = string | Array<TextPart | ImagePart | FilePart>;
export type AssistantContent = string | Array<TextPart | FilePart | ReasoningPart | ToolCallPart | ToolResultPart>;

export interface UserMessage {
  role: 'user';
  content: UserContent;
}

export interface AssistantMessage {
  role: 'assistant';
  content: AssistantContent;
}

export interface SystemMessage {
  role: 'system';
  content: string;
}

export interface ToolMessage {
  role: 'tool';
  content: Array<ToolResultPart>;
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

export interface MessagesFile {
  messages?: Message[];
}
