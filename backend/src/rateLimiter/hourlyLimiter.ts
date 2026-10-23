import { connection } from "../queue/queue";

const takeSlotScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 7200) end
if count <= tonumber(ARGV[1]) then return 1 end
redis.call('DECR', KEYS[1])
return 0
`;

export async function takeHourlySlot(sender: string, limit: number) {
  const now = new Date();
  const hour = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
    ),
  ).toISOString();
  const key = `rate:${sender}:${hour}`;
  const result = await connection.eval(takeSlotScript, 1, key, String(limit));
  return Number(result) === 1;
}

export function nextHourStart() {
  const now = new Date();
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours() + 1,
  );
}
