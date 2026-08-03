import { Agent } from 'agents';

type Message = {
	role: 'user' | 'assistant';
	content: string;
};

export class CloudflareAgentWithSdk extends Agent<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const query = url.searchParams.get('query') ?? '';

		// load history
		const history = (await this.ctx.storage.get<Message[]>('history')) ?? [];

		// add user message to history
		history.push({ role: 'user', content: query });

		// ask ai
		const response = (await this.env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages: history })).response ?? 'no response';

		// add assistant response to history
		history.push({ role: 'assistant', content: response });

		// save history
		await this.ctx.storage.put('history', history);

		return Response.json({
			reply: response,
		});
	}
}
