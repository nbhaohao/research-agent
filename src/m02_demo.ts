/**
 * m02 看效果：把 web_search 工具挂进 agent loop，脚本化 LLM 驱动一次「搜索 → 总结」。
 * 跑：pnpm dev src/m02_demo.ts （默认 FakeSearchProvider，零网络、确定性）
 * 想试真实搜索：把 provider 换成 new DuckDuckGoProvider()（best-effort，结果随网络变化）。
 */
import { runAgent } from "./agent";
import {
  makeSearchTool,
  FakeSearchProvider,
  type SearchResult,
} from "./search";
import type { LLMClient, LLMResponse, Message, ToolSpec } from "./llm";

const CANNED: Record<string, SearchResult[]> = {
  RAG: [
    {
      title: "RAG 检索增强生成",
      url: "https://ex.com/rag",
      snippet: "先检索相关文档再让 LLM 生成",
    },
    {
      title: "向量检索入门",
      url: "https://ex.com/vec",
      snippet: "用 embedding 找语义相近的段落",
    },
  ],
};

class ScriptedClient implements LLMClient {
  constructor(private steps: LLMResponse[]) {}
  async complete(
    messages: Message[],
    _tools: ToolSpec[],
  ): Promise<LLMResponse> {
    const last = messages.at(-1);
    console.log(
      `  [LLM] 收到 ${messages.length} 条消息（最后一条 role=${last?.role}）`,
    );
    return this.steps.shift() ?? { text: "(脚本用尽)" };
  }
}

async function demo() {
  console.log("=".repeat(52));
  console.log("m02 demo · 把 web 搜索接成工具，agent 循环里调用");
  console.log("=".repeat(52));
  console.log("用户问：RAG 是什么？\n");

  const client = new ScriptedClient([
    { toolCalls: [{ id: "s1", name: "web_search", args: { query: "RAG" } }] },
    { text: "RAG 即检索增强生成：先检索相关文档，再让 LLM 基于它生成答案。" },
  ]);
  const tool = makeSearchTool(new FakeSearchProvider(CANNED));

  const { answer, messages } = await runAgent(client, "RAG 是什么？", [tool]);

  console.log("\n--- 最终 messages 历史 ---");
  messages.forEach((m, i) => console.log(`  ${i}. [${m.role}] ${m.content}`));
  console.log(`\n最终答案：${answer}`);
}

demo();
