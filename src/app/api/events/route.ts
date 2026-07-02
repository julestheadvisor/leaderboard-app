import { getLeaderboard, subscribeToLeaderboard } from "@/lib/leaderboard-store";

export const dynamic = "force-dynamic";

function encodeEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (data: unknown) => {
        if (!closed) {
          controller.enqueue(encoder.encode(encodeEvent(data)));
        }
      };

      send(await getLeaderboard());

      const unsubscribe = subscribeToLeaderboard(send);
      const heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }, 25_000);

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    },
  });
}
