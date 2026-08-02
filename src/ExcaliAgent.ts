import { Agent, WSMessage, type Connection } from 'agents';
import { generateText, streamText } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';

type Message = {
	role: 'user' | 'assistant';
	content: string;
};

export class ExcaliAgent extends Agent<Env> {
	async onConnect(connection: Connection) {
		connection.send('WebSocket connection established');
	}

	async onMessage(connection: Connection, message: WSMessage) {
		console.log('got:', message.toString());

		const history = (await this.ctx.storage.get<Message[]>('history')) ?? [];
		history.push({ role: 'user', content: message.toString() });

		const provider = createWorkersAI({ binding: this.env.AI });
		const model = provider('@cf/meta/llama-3.2-3b-instruct');
		const result = streamText({ model, messages: history });

		let aiResponse = '';
		for await (const chunk of result.textStream) {
			connection.send(chunk);
			aiResponse += chunk;
		}

		history.push({ role: 'assistant', content: aiResponse });
		await this.ctx.storage.put('history', history);
	}

	async onClose(connection: Connection, code: number, reason: string) {
		console.log('closed:', code, reason);
	}

	async onError(connection: unknown, error?: unknown): Promise<void> {
		console.log('error', error ?? 'no info');
	}
}
