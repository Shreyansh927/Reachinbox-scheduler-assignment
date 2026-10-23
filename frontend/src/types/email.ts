export type EmailStatus = "scheduled" | "processing" | "sent" | "failed";

export type ScheduledEmail = {
  id: string;
  recipient: string;
  subject: string;
  scheduled_at: string;
  status: EmailStatus;
};

export type SentEmail = {
  id: string;
  recipient: string;
  subject: string;
  sent_at: string | null;
  scheduled_at: string;
  status: "sent" | "failed";
  failure_reason?: string | null;
};

export type EmailRow = ScheduledEmail | SentEmail;

export type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
};

export type ScheduleInput = {
  subject: string;
  body: string;
  emails: string[];
  startTime: string;
  delayBetweenMs: number;
  hourlyLimit: number;
};
