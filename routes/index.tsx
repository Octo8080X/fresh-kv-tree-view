import { Handlers, type PageProps } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import {
  StructuredKv,
  type StructuredKvNode,
  unDecorateDataKey,
} from "structured_kv";
import Header from "../components/Header.tsx";
import { row_kv } from "../lib/row_kv.ts";

const kv = new StructuredKv(row_kv);

export const handler: Handlers = {
  async GET(req: Request, ctx) {
    const url = new URL(req.url);
    const urlSearchParams = url.searchParams;
    const reqKeys: string[] = [];
    if (urlSearchParams.has("keys")) {
      reqKeys.push(...urlSearchParams.get("keys")!.split(","));
    }

    const structuredKeys = await kv.structure([]);

    let isViewEntries = false;

    if (Object.keys(structuredKeys).length == 0 || structuredKeys["_v"]) {
      isViewEntries = true;
    } else {
      let tmpStructuredKeys = structuredKeys;
      for (let i = 0; i < reqKeys.length; i++) {
        if (!tmpStructuredKeys[reqKeys[i]]?.["_v"]) {
          tmpStructuredKeys = tmpStructuredKeys[reqKeys[i]];
        } else {
          isViewEntries = true;
          break;
        }
      }
    }

    const entries = [];
    if (isViewEntries) {
      const iter = kv.list({ start: [...reqKeys, ""], end: [...reqKeys, "~"] });
      for await (const entry of iter) {
        entries.push(entry);
      }
    }

    const resp = await ctx.render({ list: structuredKeys, entries });

    return resp;
  },
  async POST(req: Request, ctx) {
    const form = await req.formData();
    const keys = form.get("keys")?.split(",");
    const value = form.get("value");

    if (keys.join("")?.length == 0) {
      console.error("keys is empty");
      return new Response(null, {
        status: 303,
        headers: {
          "Location": "/",
        },
      });
    }

    if (keys.join("")?.search(/[~!]/) != -1) {
      console.error("keys is invalid");
      return new Response(null, {
        status: 303,
        headers: {
          "Location": "/",
        },
      });
    }

    await kv.set(keys, value);

    return new Response(null, {
      status: 303,
      headers: {
        "Location": "/",
      },
    });
  },
};

function StructuredList(
  { list, parentsKeys }: {
    list: StructuredKvNode;
    parentsKeys?: string[];
  },
) {
  const { _v, ...childrenList }: StructuredKvNode = list;

  return (
    <ul class="pl-5 max-w-md space-y-1 text-gray-500 list-disc list-inside dark:text-gray-400">
      {Object.keys(childrenList).map((key: string) => (
        <li>
          <a
            href={`?keys=${[...parentsKeys, key].join(",")}`}
            class="font-medium text-blue-600 dark:text-blue-500 hover:underline"
          >
            {childrenList[key]._v
              ? `${key} 件数: ${childrenList[key]._v} +`
              : `${key}`}
          </a>
          {typeof list[key] === "object"
            ? StructuredList({
              list: childrenList[key],
              parentsKeys: [...parentsKeys, key],
            })
            : ""}
        </li>
      ))}
    </ul>
  );
}

export default function Home(
  props: PageProps<{ list: StructuredKvNode; entries: [] }>,
) {
  return (
    <>
      <Head>
        <title>KV Tree View</title>
      </Head>
      <div class="max-w-screen bg-gray-300 h-screen">
        <div class="mx-auto max-w-screen-md bg-gray-100 h-screen">
          <Header />
          <div class="ml-2 bg-blue-100 p-2 mb-2">
            <div>
              <p class="font-bold">入力フォーム</p>
            </div>
            <form method="POST" action="/">
              <div>
                <p class="w-64">
                  <label htmlFor="keys">
                    キー(',' で分割, '~','!' は使えません)
                  </label>
                </p>
                <input
                  type="text"
                  name="keys"
                  class="ml-2 py-1 border border-gray-400 border-2 rounded mb-1"
                />
              </div>
              <div>
                <p class="w-48">
                  <label htmlFor="keys">値</label>
                </p>
                <input
                  type="text"
                  name="value"
                  class="ml-2 py-1 border border-gray-400 border-2 rounded mb-1"
                />
              </div>
              <div>
                <button
                  type="submit"
                  class="ml-2 py-1 px-2 button border border-gray-400 border-2 rounded bg-blue-400 text-white font-bold mb-1"
                >
                  送信
                </button>
              </div>
            </form>
          </div>
          <div class="ml-2 bg-blue-100 p-2 mb-2">
            <div>
              <p class="font-bold">ツリー ビュー</p>
            </div>
            <div class="bg-white p-2">
              <a
                href="/"
                class="font-medium text-blue-600 dark:text-blue-500 hover:underline"
              >
                ROOT {props.data.list?._v ? `${props.data.list._v}+` : ""}
              </a>
              <StructuredList list={props.data.list} parentsKeys={[]} />
            </div>
          </div>

          <div class="ml-2 bg-blue-100 p-2">
            <div>
              <p class="font-bold">該当レコード</p>
            </div>
            <table class="table-auto border-collapse border border-slate-100 bg-white mx-auto w-full">
              <thead>
                <tr>
                  <th>キー</th>
                  <th>値</th>
                </tr>
              </thead>
              <tbody>
                {props.data.entries.length > 0
                  ? (
                    props.data.entries.map((entry) => {
                      return (
                        <tr class="my-1">
                          <td class="mx-1 border border-slate-300">
                            {entry.key.slice(1, entry.key.length).join(",")
                              .replace(/(v\~)|(!v$)/g, "")}
                            <form
                              method="POST"
                              action="/delete"
                              id={unDecorateDataKey(entry.key).join("-")}
                              class="inline-block"
                            >
                              <input
                                type="hidden"
                                name="keys"
                                value={unDecorateDataKey(entry.key).join(",")}
                              />
                              <a
                                onClick={`document.getElementById('${
                                  unDecorateDataKey(entry.key).join("-")
                                }').submit()`}
                                class="ml-4 text-xs text-blue-300 hover:text-blue-600 underline"
                              >
                                削除
                              </a>
                            </form>
                          </td>
                          <td class="mx-1 border border-slate-300">
                            {entry.value}
                          </td>
                        </tr>
                      );
                    })
                  )
                  : ""}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
