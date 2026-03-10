export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface LLMProvider {
  readonly name: string;

  /**
   * Send a chat completion request and return the full response.
   */
  chat(messages: readonly ChatMessage[], options?: LLMOptions): Promise<string>;

  /**
   * Send a chat completion request and stream the response tokens.
   */
  chatStream(messages: readonly ChatMessage[], options?: LLMOptions): AsyncIterable<string>;
}
