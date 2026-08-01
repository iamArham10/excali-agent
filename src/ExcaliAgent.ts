import { Agent } from 'agents';
import { generateText } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';

type Message = {
	role: 'user' | 'assistant';
	content: string;
};

export class ExcaliAgent extends Agent<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const query = url.searchParams.get('query') ?? '';

		// load history
		const history = (await this.ctx.storage.get<Message[]>('history')) ?? [];

		// add user message to history
		history.push({ role: 'user', content: query });
		const provider = createWorkersAI({
			binding: this.env.AI,
		});

		// generate response
		const model = provider('@cf/meta/llama-3.2-3b-instruct');
		const result = (await generateText({ model: model, messages: history })).text ?? 'no response';

		// add assistant message to history
		history.push({ role: 'assistant', content: result });

		// save history
		await this.ctx.storage.put('history', history);

		return Response.json({
			reply: result,
		});
	}
}
