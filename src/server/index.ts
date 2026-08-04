import { routeAgentRequest } from "agents";
import { ExcaliAgent } from "./excali-agent";

export { ExcaliAgent };

export default {
    async fetch(request: Request, env: Env) {
        return (
            (await routeAgentRequest(request, env)) ??
            new Response("Not found", { status: 404 })
        );
    },
};
