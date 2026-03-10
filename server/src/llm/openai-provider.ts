import type { ChatMessage, LLMOptions, LLMProvider } from './llm-provider.js';

/**
 * Stub OpenAI provider.
 *
 * This is a placeholder for future OpenAI API integration.
 * Install the `openai` package and implement the methods when needed.
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';

  async chat(messages: readonly ChatMessage[], options?: LLMOptions): Promise<string> {
    throw new Error(
      'OpenAI provider is not yet implemented. ' +
      'Install the openai package and provide OPENAI_API_KEY to use this provider.',
    );
  }

  async *chatStream(messages: readonly ChatMessage[], options?: LLMOptions): AsyncIterable<string> {
    throw new Error(
      'OpenAI provider is not yet implemented. ' +
      'Install the openai package and provide OPENAI_API_KEY to use this provider.',
    );
  }
}
