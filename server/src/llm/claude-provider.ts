import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { ChatMessage, LLMOptions, LLMProvider } from './llm-provider.js';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 1024;

export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude';
  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? config.ANTHROPIC_API_KEY,
    });
  }

  async chat(messages: readonly ChatMessage[], options?: LLMOptions): Promise<string> {
    const { systemMessage, userMessages } = splitSystemMessage(messages);

    const response = await this.client.messages.create({
      model: options?.model ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options?.temperature,
      system: systemMessage,
      messages: userMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => {
        if (block.type === 'text') return block.text;
        return '';
      })
      .join('');
  }

  async *chatStream(messages: readonly ChatMessage[], options?: LLMOptions): AsyncIterable<string> {
    const { systemMessage, userMessages } = splitSystemMessage(messages);

    const stream = this.client.messages.stream({
      model: options?.model ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options?.temperature,
      system: systemMessage,
      messages: userMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}

function splitSystemMessage(messages: readonly ChatMessage[]): {
  systemMessage: string | undefined;
  userMessages: readonly ChatMessage[];
} {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const userMessages = messages.filter((m) => m.role !== 'system');
  const systemMessage = systemMessages.length > 0
    ? systemMessages.map((m) => m.content).join('\n\n')
    : undefined;

  return { systemMessage, userMessages };
}
