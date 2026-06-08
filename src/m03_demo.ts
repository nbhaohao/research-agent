/**
 * m03 看效果：搜索 → 抓取相关段落 → 总结，三步跑在一个 agent loop 里（脚本化 LLM，不真调）。
 * 跑：pnpm dev src/m03_demo.ts
 * 重点看：fetch_page 把一整页 HTML 变成「只剩相关的几段」，无关段（天气/购物）被检索丢掉。
 */
import { runAgent } from "./agent";
import { makeSearchTool, FakeSearchProvider, type SearchResult } from "./search";
import { makeFetchTool, FakeFetcher } from "./fetch";
import type { LLMClient, LLMResponse, Message, ToolSpec } from "./llm";

const URL = "https://ex.com/rag-guide";

const CANNED_SEARCH: Record<string, SearchResult[]> = {
  RAG: [{ title: "RAG 完整指南", url: URL, snippet: "检索增强生成的原理与实践" }],
};

// 一整页：相关段 + 一大段无关闲聊，抓取工具应只挑出相关的。
const CANNED_PAGES: Record<string, string> = {
  [URL]:
    "<html><body>" +
    "<nav>首页 关于 联系方式</nav>" +
    "<p>RAG 即检索增强生成，先从知识库检索相关文档，再让 LLM 基于检索结果生成答案。</p>" +
    "<p>它能缓解大模型的幻觉问题，让回答有据可查。</p>" +
    "<p>对了今天天气特别好阳光明媚微风不燥很适合出门散步喝咖啡逛逛街顺便买点喜欢的零食和饮料犒劳一下辛苦工作的自己然后晚上再约上三五好友一起吃顿火锅聊聊最近追的剧度过一个轻松惬意的周末夜晚。</p>" +
    "</body></html>",
};

class ScriptedClient implements LLMClient {
  constructor(private steps: LLMResponse[]) {}
  async complete(messages: Message[], _tools: ToolSpec[]): Promise<LLMResponse> {
    const last = messages.at(-1);
    console.log(`  [LLM] 收到 ${messages.length} 条消息（最后一条 role=${last?.role}）`);
    return this.steps.shift() ?? { text: "(脚本用尽)" };
  }
}

async function demo() {
  console.log("=".repeat(52));
  console.log("m03 demo · 搜索 → 抓取相关段落 → 总结");
  console.log("=".repeat(52));
  console.log("用户问：RAG 是什么？\n");

  const client = new ScriptedClient([
    { toolCalls: [{ id: "s1", name: "web_search", args: { query: "RAG" } }] },
    { toolCalls: [{ id: "f1", name: "fetch_page", args: { url: URL, query: "RAG 是什么" } }] },
    { text: "RAG（检索增强生成）：先检索相关文档，再让 LLM 基于检索结果作答，从而减少幻觉、有据可查。" },
  ]);
  const tools = [
    makeSearchTool(new FakeSearchProvider(CANNED_SEARCH)),
    makeFetchTool(new FakeFetcher(CANNED_PAGES)),
  ];

  const { answer, messages } = await runAgent(client, "RAG 是什么？", tools);

  console.log("\n--- 最终 messages 历史 ---");
  messages.forEach((m, i) => console.log(`  ${i}. [${m.role}] ${m.content}`));
  console.log(`\n最终答案：${answer}`);
  console.log("\n注意：fetch_page 返回里没有那段「天气/火锅」闲聊——被 retrieve 按相关度过滤掉了。");
}

demo();
