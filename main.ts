import { Router, v } from "@oak/acorn";
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

router.get("/urls", async () => {
  try {
    const urlKeys = kv.list({ prefix: ["url"] });
    const urls = [];
    for await (const entry of urlKeys) {
      urls.push(entry.value);
    }
    return { urls };
  } catch (err) {
    console.error(err);
    return { message: err.message };
  }
});
router.listen({ port: 3000 });
