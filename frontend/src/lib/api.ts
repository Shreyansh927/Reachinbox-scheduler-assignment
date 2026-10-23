import type {
  ScheduleInput,
  ScheduledEmail,
  SentEmail,
  User,
} from "../types/email";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message || data.error || "Request failed.");
  return data as T;
}

export const api = {
  me: () => request<{ user: User }>("/api/auth/me"),
  scheduled: () =>
    request<{ emails: ScheduledEmail[] }>("/api/emails/scheduled"),
  sent: () => request<{ emails: SentEmail[] }>("/api/emails/sent"),
  schedule: (input: ScheduleInput) =>
    request<{ created: number; duplicatesRemoved: number }>(
      "/api/emails/schedule",
      { method: "POST", body: JSON.stringify(input) },
    ),
  logout: () =>
    request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
};

export const googleLoginUrl = `${API_URL}/api/auth/google`;
