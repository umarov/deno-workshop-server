import { RouteParameters, Router, v } from "@oak/acorn";
const kv = await Deno.openKv();

const router = new Router({ logger: { console: { level: "INFO" } } });

router.get("/", () => ({ hello: "world" }));
router.post(
  "/register",
  async ({ request }) => {
    try {
      const body = await request.json();

      if (body) {
        console.log(request);
        await kv.set(["url", body.owner], body.url);
        return { message: "url stored" };
      } else {
        return { message: "nothing was sent" };
      }
    } catch (err) {
      console.log(err);

      return {
        err,
      };
    }
  },
  {
    schema: {
      body: v.object({
        owner: v.string(),
        url: v.string(),
      }),
    },
  },
);

router.get("/urls", async (context) => {
  try {
    const urlKeys = kv.list({ prefix: ["url"] });
    const urls = [];
    for await (const entry of urlKeys) {
      urls.push(entry.value);
    }
    return { urls };
  } catch (err) {
    console.error(err);
    context.throw(500, err.message);
  }
});

router.get("/calls/:id/agents", async ({ params }) => {
  const agents = await getAgents(params);

  return { agents };
});

router.get("/test/calls/:id/agents", () => {
  return { agent: "Test Agent", from: "Server" };
});

router.get("/stream/calls/:id/agents", ({ params }) => {
  let timer: number;
  const body = new ReadableStream({
    start(controller) {
      timer = setInterval(async () => {
        try {
          const agents = await getAgents(params);
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify(agents) + "\n"),
          );
        } catch (err) {
          console.error(err);
        }
      }, 1000);
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(body, {
    headers: {
      "content-type": "text/plain",
      "x-content-type-options": "nosniff",
    },
  });
});

router.get("/stream", () => {
  let timer: number;
  const body = new ReadableStream({
    start(controller) {
      timer = setInterval(() => {
        const message = `It is ${new Date().toISOString()}\n`;
        console.log(message);
        try {
          controller.enqueue(new TextEncoder().encode(message));
        } catch (err) {
          console.error(err);
        }
      }, 500);
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(body, {
    headers: {
      "content-type": "text/plain",
      "x-content-type-options": "nosniff",
    },
  });
});

router.listen({ port: 3000 });

async function getAgents(params: RouteParameters<Path>) {
  const { id } = params;
  const urlKeys = kv.list({ prefix: ["url"] });
  const urls: string[] = [];
  for await (const entry of urlKeys) {
    urls.push(entry.value as string);
  }

  const responses = await Promise.all(
    urls.map((url) =>
      fetch(`${url}/calls/${id}/agents`, {
        headers: { "Content-Type": "application/json" },
      })
    ),
  );

  const agents = await Promise.all(
    responses.map((response) => {
      if (response.ok) {
        return response.json();
      } else {
        return null;
      }
    }),
  );
  return agents.filter((agent) => agent);
}
