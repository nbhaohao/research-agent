/**
 * m01 验收：最小 agent loop —— 文本结束 / 工具循环 / 结果喂回 / 容错 / 防死循环。
 * 跑：pnpm test
 * 用脚本化 FakeClient 注入 LLM 行为，零依赖、不真调 LLM。
 */
import { describe, it, expect } from "vitest";
import { runAgent, clockTool } from "../src/agent";
import type { LLMClient, LLMResponse, Message, ToolSpec } from "../src/llm";

/** 按预设序列逐次返回响应，并记录每次被调用时看到的 messages。 */
class FakeClient implements LLMClient {
  calls: Message[][] = [];
  constructor(private scripted: LLMResponse[]) {}
  async complete(messages: Message[], _tools: ToolSpec[]): Promise<LLMResponse> {
    this.calls.push(messages.map((m) => ({ ...m })));
    return this.scripted.shift() ?? { text: "(脚本用尽)" };
  }
}

describe("m01 agent loop", () => {
  it("无工具：LLM 直接给文本就结束", async () => {
    const client = new FakeClient([{ text: "你好" }]);
    const { answer, messages } = await runAgent(client, "hi");
    expect(answer).toBe("你好");
    expect(messages[0]).toMatchObject({ role: "user", content: "hi" });
    expect(messages.at(-1)).toMatchObject({ role: "assistant", content: "你好" });
    expect(client.calls.length).toBe(1);
  });

  it("一次工具调用：调工具 → 喂回 → 再拿文本", async () => {
    const client = new FakeClient([
      { toolCalls: [{ id: "c1", name: "current_time", args: {} }] },
      { text: "时间已查到" },
    ]);
    const { answer, messages } = await runAgent(client, "几点了", [clockTool]);
    expect(answer).toBe("时间已查到");
    expect(client.calls.length).toBe(2); // 循环转了两圈
    expect(messages.some((m) => m.role === "tool")).toBe(true); // 工具结果进了历史
  });

  it("工具结果会喂回给下一轮 LLM", async () => {
    const client = new FakeClient([
      { toolCalls: [{ id: "c1", name: "current_time", args: {} }] },
      { text: "done" },
    ]);
    await runAgent(client, "几点了", [clockTool]);
    const secondCall = client.calls[1]; // 第二次 complete 时看到的 messages
    expect(secondCall.some((m) => m.role === "tool")).toBe(true);
  });

  it("未知工具：返回错误信息，循环不崩", async () => {
    const client = new FakeClient([
      { toolCalls: [{ id: "c1", name: "不存在的工具", args: {} }] },
      { text: "好的" },
    ]);
    const { answer, messages } = await runAgent(client, "x", [clockTool]);
    expect(answer).toBe("好的");
    expect(
      messages.some((m) => m.role === "tool" && m.content.includes("未知工具")),
    ).toBe(true);
  });

  it("防死循环：LLM 一直要调工具也会在最大步数停下", async () => {
    const always: LLMResponse = {
      toolCalls: [{ id: "c", name: "current_time", args: {} }],
    };
    const client = new FakeClient(Array(50).fill(always));
    const { answer } = await runAgent(client, "x", [clockTool]);
    expect(answer).toContain("最大步数");
  });
});
