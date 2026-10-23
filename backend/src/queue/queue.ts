import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6380", {
  maxRetriesPerRequest: null
});

export const emailQueue = new Queue("email-queue", {
  connection,
  defaultJobOptions: {
    attempts: Number(process.env.EMAIL_RETRY_ATTEMPTS || 3),
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 1000,
    removeOnFail: 3000
  }
});
