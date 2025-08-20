import { createClient } from "redis";

const initRedis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

initRedis.on("error", (err) => console.error("Redis Client Error", err));
await initRedis.connect();

export default initRedis;