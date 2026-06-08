/**
 * m06 · mem0 记忆分层（短期 / 会话 / 长期）。
 *
 * 到 m05 为止，每次 runAgent 都是「一次性」的：messages 数组在循环里生灭，
 * run 完即弃——这是**短期上下文**。agent 记不住你上一个问题、记不住你的偏好。
 * 这一章给它两层更久的记忆：
 *   - 短期上下文：单次 runAgent 的 messages（已有，m01 就在用，用完即弃）；
 *   - 会话记忆：跨「轮次」、同一会话内还活着（InMemoryStore，进程内）；
 *   - 长期记忆：跨「会话」、进程重启也还在，且能语义召回（Mem0Store，落到 mem0 的 SQLite+向量库）。
 *
 * 记忆后端抽象成 MemoryStore 接口——测试注入 InMemoryStore（确定性、零依赖），
 * 真实运行换 Mem0Store。跟 m01 的 LLMClient、m02 的 SearchProvider 是同一招：依赖接口、不绑实现。
 */
import { tokenize } from "./rag";
import { runAgent, type AgentResult } from "./agent";
import type { LLMClient, ToolSpec } from "./llm";

/** 一条记忆。userId 用于隔离不同用户/会话的记忆，互不串味。 */
export interface MemoryItem {
  id: string;
  text: string;
  userId: string;
}

/** 记忆后端抽象。换 InMemoryStore / Mem0Store / 任意向量库只是换实现，上层不动。 */
export interface MemoryStore {
  /** 写入一条记忆（归属某个 userId）。 */
  add(text: string, userId: string): Promise<void>;
  /** 召回与 query 最相关的若干条记忆（限定 userId、最多 limit 条）。 */
  search(query: string, userId: string, limit?: number): Promise<MemoryItem[]>;
}

/**
 * 测试 / demo / 会话记忆用：进程内记忆，按「词重叠」召回（复用 m03 的 tokenize）。
 * 确定性、零网络——这才能让「记忆 + agent」被稳定验证。进程一退就没了，所以是「会话级」。
 */
export class InMemoryStore implements MemoryStore {
  private items: MemoryItem[] = [];

  /** 追加一条记忆。（已给好） */
  async add(text: string, userId: string): Promise<void> {
    this.items.push({ id: `mem-${this.items.length + 1}`, text, userId });
  }

  /**
   * 召回：从本 userId 的记忆里挑出与 query 最相关的 top-limit 条。
   * 契约（见 learn-web Ch m06 第③节）——和 m03 的 retrieve 是同一个套路，只是对象换成「记忆」：
   *  - 只看 userId 匹配的记忆（隔离，别召回别人的）。
   *  - 用 tokenize 给 query 和每条记忆分词，相关度 = 去重 token 的重叠个数。
   *  - 丢掉相关度为 0 的，按相关度从高到低，最多返回 limit 条。
   */
  async search(
    query: string,
    userId: string,
    limit = 3,
  ): Promise<MemoryItem[]> {
    const userItems = this.items.filter((m) => m.userId === userId);
    if (userItems.length === 0) return [];

    const qTokens = new Set(tokenize(query));
    const scored: { item: MemoryItem; score: number }[] = [];

    for (const item of userItems) {
      const itemTokens = new Set(tokenize(item.text));
      let score = 0;
      for (const t of qTokens) {
        if (itemTokens.has(t)) score++;
      }
      if (score > 0) scored.push({ item, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.item);
  }
}

/**
 * 真实长期记忆后端：mem0 oss。仅 demo / 真实运行用；测试一律用 InMemoryStore。
 *
 * mem0 会用 LLM 从对话里**抽取事实**、向量化存进本地 SQLite——所以它跨会话、能语义召回，
 * 而不只是字面词重叠。代价：需要 `pnpm add mem0ai`，并在 .env 配 OPENAI_API_KEY（或兼容端点）。
 * 用动态 import：没装 mem0ai 时本文件照样能被加载（测试不受影响），只有真的 new 它才去找包。
 */
export class Mem0Store implements MemoryStore {
  private memory: unknown;

  private async client(): Promise<{
    add: (msgs: unknown, cfg: unknown) => Promise<unknown>;
    search: (q: string, cfg: unknown) => Promise<unknown>;
  }> {
    if (!this.memory) {
      // @ts-ignore mem0ai 为可选依赖：先 `pnpm add mem0ai` 才存在（测试不会走到这里）
      const { Memory } = await import("mem0ai/oss");
      this.memory = new Memory();
    }
    return this.memory as never;
  }

  async add(text: string, userId: string): Promise<void> {
    const m = await this.client();
    await m.add([{ role: "user", content: text }], { userId });
  }

  async search(
    query: string,
    userId: string,
    limit = 3,
  ): Promise<MemoryItem[]> {
    const m = await this.client();
    const res = (await m.search(query, { userId, limit })) as {
      results?: Array<{ id?: string; memory?: string; text?: string }>;
    };
    const rows = res?.results ?? [];
    return rows.map((r, i) => ({
      id: String(r.id ?? i),
      text: String(r.memory ?? r.text ?? ""),
      userId,
    }));
  }
}

/**
 * 给 runAgent 套上记忆的闭环：召回 → 注入 → 跑循环 → 固化。
 * 契约（见 learn-web Ch m06 第③节）：
 *  1. 召回：store.search(userMessage, userId) 找出与本次问题相关的记忆。
 *  2. 注入：把召回的记忆拼成一段 primer，**前置**到 userMessage（让短期循环带着记忆开跑）。
 *     没召回到就不加 primer。
 *  3. 跑循环：runAgent(client, primer + userMessage, tools)（runAgent 本身不用改）。
 *  4. 固化：把这轮「问→答」store.add 回去，未来同用户再问相关问题时才召回得到。
 *  返回 runAgent 的结果。
 */
export async function runWithMemory(
  store: MemoryStore,
  client: LLMClient,
  userMessage: string,
  userId: string,
  tools: ToolSpec[] = [],
): Promise<AgentResult> {
  // 1. 召回
  const recalled = await store.search(userMessage, userId);
  // 2. 注入 primer
  let primer = "";
  if (recalled.length > 0) {
    primer =
      "已知关于该用户的记忆：\n" +
      recalled.map((m) => `- ${m.text}`).join("\n") +
      "\n\n";
  }
  // 3. 跑循环
  const result = await runAgent(client, primer + userMessage, tools);
  // 4. 固化
  await store.add(`问：${userMessage}\n答：${result.answer}`, userId);
  return result;
}
