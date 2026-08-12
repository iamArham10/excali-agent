import { tool } from "ai";
import z from "zod";
import { set } from "zod/v3";

// create a tool
export const tools = {
    getCityWeather: tool({
        description: "Get the weather for a given location",
        inputSchema: z.object({
            location: z.string().describe("name of the city"),
        }),
        execute: async ({ location }) => {
            const weather = await new Promise<string>((resolve) => {
                setTimeout(() => {
                    resolve("32 Celsius");
                }, 3000);
            });

            return weather;
        },
    }),
    getUserMood: tool({
        description: "get the user mood",
        inputSchema: z.object({}),
    }),
    getUserInfo: tool({
        description: "get information about the user",
        inputSchema: z.object({})

    })
};
