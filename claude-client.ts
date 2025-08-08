import Anthropic from "@anthropic-ai/sdk";

export class ClaudeClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
    });
  }

  /**
   * Make a non-streaming request to Claude API
   */
  async createMessage(request: Anthropic.MessageCreateParams): Promise<Anthropic.Message> {
    return await this.client.messages.create(request);
  }

  /**
   * Make a streaming request to Claude API
   */
  async *createMessageStream(request: Anthropic.MessageCreateParams): AsyncGenerator<Anthropic.MessageStreamEvent> {
    const streamRequest = { ...request, stream: true };
    
    const stream = await this.client.messages.create(streamRequest);
    
    for await (const event of stream) {
      yield event;
    }
  }
}