import "dotenv/config";

import { buildApp } from "./app.js";
import { readEnv } from "./config/env.js";

const env = readEnv(process.env);
const app = await buildApp({ env });

await app.listen({ host: env.HOST, port: env.PORT });
app.log.info({ host: env.HOST, port: env.PORT }, "API listening");

