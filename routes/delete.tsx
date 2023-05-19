import { Handlers } from "$fresh/server.ts";
import { StructuredKv } from "structured_kv";
import { row_kv } from "../lib/row_kv.ts";

const kv = new StructuredKv(row_kv);
export const handler: Handlers = {
  async POST(req: Request, ctx) {
    const form = await req.formData();
    const keys = form.get("keys")?.split(",");

    if (keys.join("")?.search(/[~!]/) != -1) {
      console.error("keys is invalid");
      return new Response(null, {
        status: 303,
        headers: {
          "Location": "/",
        },
      });
    }

    await kv.delete(keys);

    return new Response(null, {
      status: 303,
      headers: {
        "Location": "/",
      },
    });
  },
};
