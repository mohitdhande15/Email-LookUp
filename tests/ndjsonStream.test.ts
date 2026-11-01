import { describe, it, expect } from "vitest";
import { consumeNdjsonStream } from "@/lib/ndjsonStream";

describe("consumeNdjsonStream", () => {
  it("parses single lines correctly", async () => {
    const encoder = new TextEncoder();
    const data = JSON.stringify({ source: "gravatar", status: "found" }) + "\n";

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(data));
        controller.close();
      },
    });

    const received: unknown[] = [];
    await consumeNdjsonStream(stream, (item) => received.push(item));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ source: "gravatar", status: "found" });
  });

  it("handles chunk fragmentation across line boundaries", async () => {
    const encoder = new TextEncoder();
    const chunk1 = '{"source":"github","st';
    const chunk2 = 'atus":"found"}\n{"source":"bre';
    const chunk3 = 'ach","status":"not_found"}\n';

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(chunk1));
        controller.enqueue(encoder.encode(chunk2));
        controller.enqueue(encoder.encode(chunk3));
        controller.close();
      },
    });

    const received: unknown[] = [];
    await consumeNdjsonStream(stream, (item) => received.push(item));

    expect(received).toHaveLength(2);
    expect(received[0]).toEqual({ source: "github", status: "found" });
    expect(received[1]).toEqual({ source: "breach", status: "not_found" });
  });

  it("parses trailing line without newline at end of stream", async () => {
    const encoder = new TextEncoder();
    const data = '{"done":true}';

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(data));
        controller.close();
      },
    });

    const received: unknown[] = [];
    await consumeNdjsonStream(stream, (item) => received.push(item));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ done: true });
  });
});
