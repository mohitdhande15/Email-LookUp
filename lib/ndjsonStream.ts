/**
 * Asynchronous NDJSON (Newline Delimited JSON) Stream Consumer.
 * Properly buffers and streams JSON objects line-by-line across arbitrary chunk boundaries.
 */

export async function consumeNdjsonStream<T = unknown>(
  stream: ReadableStream<Uint8Array>,
  onItem: (item: T) => void
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Keep the last incomplete fragment in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as T;
          onItem(parsed);
        } catch (err) {
          console.warn("[NDJSON Stream] Failed to parse line:", trimmed, err);
        }
      }
    }

    // Flush remaining buffer
    const remainder = buffer.trim();
    if (remainder) {
      try {
        const parsed = JSON.parse(remainder) as T;
        onItem(parsed);
      } catch (err) {
        console.warn("[NDJSON Stream] Failed to parse remainder:", remainder, err);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
