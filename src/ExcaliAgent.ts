import { AIChatAgent } from '@cloudflare/ai-chat';
import { streamText, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, toUIMessageStream } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';
import { tools } from './tools';

export class ExcaliAgent extends AIChatAgent<Env> {
	async onChatMessage() {
		console.log('received message');
		const workersai = createWorkersAI({ binding: this.env.AI });

		const result = streamText({
			model: workersai('@cf/ibm-granite/granite-4.0-h-micro'),
			instructions: 'You are a weather agent that provides weather information to the user. you can check the weather',
			messages: await convertToModelMessages(this.messages),
			tools,
		});

		return createUIMessageStreamResponse({
			stream: toUIMessageStream({ stream: result.stream }),
		});
	}
}
