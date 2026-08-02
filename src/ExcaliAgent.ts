import { Agent } from 'agents';
import { generateText, streamText } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';

type Message = {
	role: 'user' | 'assistant';
	content: string;
};

export class ExcaliAgent extends Agent<Env> {
	async fetch(request: Request): Promise<Response> {
		// check for WebSocket upgrade
		const upgrade = request.headers.get('Upgrade');
		if (upgrade !== 'websocket') {
			return new Response('Expected WebSocket upgrade', { status: 426 });
		}

		// create a websocket pair
		const [client, server] = Object.values(new WebSocketPair());
		server.accept();

		// listen for messages from the client
		server.addEventListener('message', async (event) => {
			const userMessage = event.data.toString();

			// load history
			const history = (await this.ctx.storage.get<Message[]>('history')) ?? [];

			// add user message to history
			history.push({ role: 'user', content: userMessage });
			const provider = createWorkersAI({
				binding: this.env.AI,
			});

			const model = provider('@cf/meta/llama-3.2-3b-instruct');
			const result = streamText({ model: model, messages: history });

			let answer = '';
			for await (const chunk of result.textStream) {
				answer += chunk;
				server.send(chunk);
			}

			history.push({
				role: 'assistant',
				content: answer,
			});

			await this.ctx.storage.put('history', history);
		});

		// close the server
		server.addEventListener('close', () => {
			client.close();
		});

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}
}
