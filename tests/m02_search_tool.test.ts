/**
 * m02 验收：工具系统 + web 搜索 —— 参数 schema / 结果格式化 / 空结果 / 缺参容错 / 端到端循环。
 * 跑：pnpm test
 * 用 FakeSearchProvider（确定性、零网络）+ FakeClient（脚本化 LLM）验证，不真调搜索/LLM。
 */
import { describe, it, expect } from "vitest";
import { runAgent } from "../src/agent";
import { makeSearchTool, FakeSearchProvider, type SearchResult } from "../src/search";
import type { LLMClient, LLMResponse, Message, ToolSpec } from "../src/llm";

const CANNED: Record<string, SearchResult[]> = {
  agent: [
    { title: "什么是 AI Agent", url: "https://ex.com/agent", snippet: "Agent 是能自主调用工具的程序" },
    { title: "ReAct 模式", url: "https://ex.com/react", snippet: "推理与行动交替驱动" },
  ],
};

class FakeClient implements LLMClient {
  calls: Message[][] = [];
  constructor(private scripted: LLMResponse[]) {}
  async complete(messages: Message[], _tools: ToolSpec[]): Promise<LLMResponse> {
    this.calls.push(messages.map((m) => ({ ...m })));
    return this.scripted.shift() ?? { text: "(脚本用尽)" };
  }
}

describe("m02 search tool", () => {
  it("工具元数据：名字 web_search，参数声明 query 必填", () => {
    const tool = makeSearchTool(new FakeSearchProvider(CANNED));
    expect(tool.name).toBe("web_search");
    expect(tool.parameters?.required).toContain("query");
  });

  it("正常搜索：结果格式化成带编号、含标题与链接的文本", async () => {
    const tool = makeSearchTool(new FakeSearchProvider(CANNED));
    const out = await tool.run({ query: "agent" });
    expect(out).toContain("什么是 AI Agent");
    expect(out).toContain("https://ex.com/agent");
    expect(out).toContain("[1]");
    expect(out).toContain("[2]");
  });

  it("空结果：不抛错，返回「没有找到」提示", async () => {
    const tool = makeSearchTool(new FakeSearchProvider(CANNED));
    const out = await tool.run({ query: "完全无关的词" });
    expect(out).toContain("没有找到");
  });

  it("缺 query 参数：不抛错，返回含 query 的明确提示", async () => {
    const tool = makeSearchTool(new FakeSearchProvider(CANNED));
    const out = await tool.run({});
    expect(out).toContain("query");
  });

  it("端到端：agent 调 web_search → 结果喂回 → LLM 总结", async () => {
    const client = new FakeClient([
      { toolCalls: [{ id: "s1", name: "web_search", args: { query: "agent" } }] },
      { text: "根据搜索，Agent 是能自主调用工具的程序。" },
    ]);
    const tool = makeSearchTool(new FakeSearchProvider(CANNED));
    const { answer, messages } = await runAgent(client, "什么是 agent", [tool]);
    expect(answer).toContain("Agent");
    // 工具消息带回了搜索结果，第二轮 LLM 才看得到
    expect(messages.some((m) => m.role === "tool" && m.content.includes("ReAct"))).toBe(true);
  });
});
