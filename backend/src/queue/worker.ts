import "dotenv/config";
import { Worker, DelayedError } from "bullmq";
import nodemailer from "nodemailer";
import { db } from "../db/client";
import { connection } from "./queue";
import { nextHourStart, takeHourlySlot } from "../rateLimiter/hourlyLimiter";
console.log("SMTP configuration:", {
  host: process.env.ETHEREAL_HOST,
  port: process.env.ETHEREAL_PORT,
  userLoaded: Boolean(process.env.ETHEREAL_USER),
  passwordLoaded: Boolean(process.env.ETHEREAL_PASS),
});

const transport = nodemailer.createTransport({
  host: process.env.ETHEREAL_HOST || "ethereal.risebuildings.com",
  port: Number(process.env.ETHEREAL_PORT || 5587),
  secure: false,
  auth: {
    user: process.env.ETHEREAL_USER,
    pass: process.env.ETHEREAL_PASS,
  },
});

transport
  .verify()
  .then(() => console.log("SMTP connection verified."))
  .catch((error) => console.error("SMTP verification failed:", error));

const worker = new Worker(
  "email-queue",
  async (job, token) => {
    const { emailId, hourlyLimit } = job.data as {
      emailId: string;
      hourlyLimit: number;
    };
    const current = await db.query("SELECT * FROM emails WHERE id = $1", [
      emailId,
    ]);
    const email = current.rows[0];
    if (!email || email.status === "sent" || email.status === "failed") return;

    const allowed = await takeHourlySlot(
      email.sender,
      Number(hourlyLimit || process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || 50),
    );
    if (!allowed) {
      await job.moveToDelayed(nextHourStart(), token);
      throw new DelayedError();
    }

    const claim = await db.query(
      "UPDATE emails SET status = 'processing' WHERE id = $1 AND (status = 'scheduled' OR ($2::boolean AND status = 'processing')) RETURNING id",
      [emailId, job.attemptsMade > 0],
    );
    if (!claim.rowCount) return;

    try {
      const result = await transport.sendMail({
        from: email.sender,
        to: email.recipient,
        subject: email.subject,
        text: email.body,
      });
      await db.query(
        "UPDATE emails SET status = 'sent', sent_at = NOW(), failure_reason = NULL WHERE id = $1",
        [emailId],
      );
      console.log(
        `Email ${emailId} sent. Preview: ${nodemailer.getTestMessageUrl(result) || "available in Ethereal"}`,
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Email send failed";
      const attemptsMade = job.attemptsMade + 1;
      if (attemptsMade >= Number(process.env.EMAIL_RETRY_ATTEMPTS || 3)) {
        await db.query(
          "UPDATE emails SET status = 'failed', failure_reason = $2 WHERE id = $1",
          [emailId, reason],
        );
      } else {
        await db.query("UPDATE emails SET status = 'scheduled' WHERE id = $1", [
          emailId,
        ]);
      }
      throw error;
    }
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
    limiter: {
      max: 1,
      duration: Number(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || 2000),
    },
  },
);

worker.on("failed", (job, error) =>
  console.error(`Job ${job?.id} failed: ${error.message}`),
);
worker.on("error", (error) => console.error("Worker error:", error.message));

async function stop() {
  await worker.close();
  await connection.quit();
  await db.end();
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
