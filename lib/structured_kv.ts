const SYSTEM_KEY = "SYSTEM" as const;
const DATA_KEY = "DATA" as const;

export class StructuredKv {
  #kv: Deno.KV;
  constructor(kv) {
    this.#kv = kv;
  }
  list<T = unknown>(
    selector: KvListSelector,
    options?: KvListOptions,
  ): KvListIterator<T> {
    const localSelector = {
      ...selector,
      start: [DATA_KEY, ...(this.decorateKey(selector.start))],
      end: [DATA_KEY, ...(this.decorateKey(selector.end))],
    };
    return this.#kv.list(localSelector, options);
  }

  async structureList<T = unknown>(
    selector: string[],
  ): KvListIterator<T> {
    const localSelector = {
      prefix: [SYSTEM_KEY, ...selector],
      start: [SYSTEM_KEY, ...selector],
    };

    const structureIter = this.#kv.list(localSelector);
    const entries = [];

    for await (const entry of structureIter) {
      entries.push(entry);
    }

    const structuredKeys: any = {};
    entries.forEach((entry) => {
      const currentKey: string[] = [];
      let currentObj = structuredKeys;
      entry.key.forEach((k: string, i: number) => {
        currentKey.push(entry.key);
        if (!currentObj[k]) {
          currentObj[k] = {};
        }
        if ((entry.key.length - 1) === i) {
          currentObj[k]._v = entry.value;
        }
        currentObj = currentObj[k];
      });
    });

    return { ...structuredKeys["SYSTEM"] };
  }

  async set(key: KvKey, value: unknown): Promise<KvCommitResult> {
    const digestKey = key.slice(0, -1);
    const systemValue =
      ((await this.#kv.get<number>([SYSTEM_KEY, ...digestKey])).value + 1) |
      0;
    return this.#kv
      .atomic()
      .check({ key: [DATA_KEY, ...key], versionstamp: null })
      .set([SYSTEM_KEY, ...digestKey], systemValue)
      .set([DATA_KEY, ...this.decorateKey(key)], value)
      .commit();
  }

  async get<T = unknown>(
    key: KvKey,
    options?: { consistency?: KvConsistencyLevel },
  ): Promise<KvEntryMaybe<T>> {
    return this.#kv.get<number>([DATA_KEY, ...key]);
  }

  decorateKey(key: string[]): string[] {
    const decoratedKey = !!key && key.length > 0
      ? key.slice(0, key.length - 1)
      : [];
    decoratedKey.push(`v~${key[key.length - 1]}!v`);
    return decoratedKey;
  }
}
