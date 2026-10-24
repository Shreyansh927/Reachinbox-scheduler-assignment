import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "../db/client";
import { emailQueue } from "../queue/queue";

export const scheduleRoutes = Router();

function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user)
    return res
      .status(401)
      .json({ error: "UNAUTHORIZED", message: "Please sign in with Google." });
  next();
}

const scheduleSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  emails: z.array(z.string().trim().toLowerCase().email()).min(1).max(5000),
  startTime: z.coerce.date(),
  delayBetweenMs: z.coerce.number().int().min(0).max(3600000),
  hourlyLimit: z.coerce.number().int().min(1).max(10000),
});

scheduleRoutes.post("/schedule", requireUser, async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message || "Invalid request.",
    });
  const { subject, body, emails, startTime, delayBetweenMs, hourlyLimit } =
    parsed.data;
  if (startTime.getTime() < Date.now())
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Start time cannot be in the past.",
    });

  const uniqueEmails = [...new Set(emails)];
  const user = req.user as { id: string; email: string };
  const sender =
    process.env.ETHEREAL_FROM || process.env.ETHEREAL_USER || user.email;
  const client = await db.connect();
  const created: { id: string; scheduled_at: Date }[] = [];

  try {
    await client.query("BEGIN");
    for (let index = 0; index < uniqueEmails.length; index += 1) {
      const id = randomUUID();
      const scheduledAt = new Date(
        startTime.getTime() + index * delayBetweenMs,
      );
      const result = await client.query(
        "INSERT INTO emails (id, user_id, recipient, subject, body, sender, scheduled_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, scheduled_at",
        [id, user.id, uniqueEmails[index], subject, body, sender, scheduledAt],
      );
      created.push(result.rows[0]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  try {
    await emailQueue.addBulk(
      created.map((email) => ({
        name: "send-email",
        data: { emailId: email.id, hourlyLimit },
        opts: {
          jobId: email.id,
          delay: Math.max(
            0,
            new Date(email.scheduled_at).getTime() - Date.now(),
          ),
        },
      })),
    );
  } catch (error) {
    return res.status(503).json({
      error: "QUEUE_UNAVAILABLE",
      message:
        "Emails were saved, but queueing failed. Please contact support before retrying.",
    });
  }

  return res.status(201).json({
    created: created.length,
    duplicatesRemoved: emails.length - uniqueEmails.length,
  });
});

scheduleRoutes.get("/scheduled", requireUser, async (req, res) => {
  const user = req.user as { id: string };
  const result = await db.query(
    "SELECT id, recipient, subject, scheduled_at, status FROM emails WHERE user_id = $1 AND status IN ('scheduled','processing') ORDER BY scheduled_at ASC LIMIT 1000",
    [user.id],
  );
  res.json({ emails: result.rows });
});

scheduleRoutes.get("/sent", requireUser, async (req, res) => {
  const user = req.user as { id: string };
  const result = await db.query(
    "SELECT id, recipient, subject, sent_at, scheduled_at, status, failure_reason FROM emails WHERE user_id = $1 AND status IN ('sent','failed') ORDER BY COALESCE(sent_at, scheduled_at) DESC LIMIT 1000",
    [user.id],
  );
  res.json({ emails: result.rows });
});
