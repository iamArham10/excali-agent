export async function getWeather(city: string) {
	console.log('weather tool called');
	return `The weather in ${city} is 35 degrees celsius`;
}

import { tool } from 'ai';
import { z } from 'zod';

export const tools = {
	weather: tool({
		description: 'Get the weather in a given city',
		inputSchema: z.object({
			city: z.string().describe('city to get the weather off'),
		}),
		execute: async ({ city }) => {
			return {
				weather: await getWeather(city),
			};
		},
	}),
};
