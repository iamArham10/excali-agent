import { DurableObject } from 'cloudflare:workers';

export class CloudflareBareAgent extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const query = url.searchParams.get('query') ?? '';

		// load history
		const history = (await this.ctx.storage.get<{ role: 'user' | 'assistant'; content: string }[]>('history')) ?? [];
		history.push({
			role: 'user',
			content: query,
		});
		const result = await this.env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
			messages: history,
		});

		history.push({
			role: 'assistant',
			content: result.response,
		});

		await this.ctx.storage.put('history', history);

		return Response.json(result.response);
	}
}
