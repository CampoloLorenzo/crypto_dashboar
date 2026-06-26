// Invio notifiche push via ntfy. Degrada in silenzio se non configurato.

interface NtfyOptions {
  title?: string;
  priority?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
}

export async function sendNtfy(
  message: string,
  opts: NtfyOptions = {}
): Promise<boolean> {
  const topic = process.env.NTFY_TOPIC;
  const baseUrl = process.env.NTFY_URL || "https://ntfy.sh";
  if (!topic) return false;

  try {
    const headers: Record<string, string> = {};
    if (opts.title) headers["Title"] = opts.title;
    if (opts.priority) headers["Priority"] = String(opts.priority);
    if (opts.tags?.length) headers["Tags"] = opts.tags.join(",");

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/${topic}`, {
      method: "POST",
      headers,
      body: message,
    });
    return res.ok;
  } catch {
    return false;
  }
}
