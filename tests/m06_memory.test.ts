/**
 * m06 验收：mem0 记忆分层 —— InMemoryStore 召回（词重叠 + userId 隔离）/
 *           runWithMemory 记忆闭环（召回→注入 primer→跑循环→固化）。
 * 跑：pnpm test
 */
import { describe, it, expect } from "vitest";
import { InMemoryStore, runWithMemory } from "../src/memory";
import type { LLMClient, LLMResponse, Message, ToolSpec } from "../src/llm";

class FakeClient implements LLMClient {
  calls: Message[][] = [];
  constructor(private scripted: LLMResponse[]) {}
  async complete(messages: Message[], _tools: ToolSpec[]): Promise<LLMResponse> {
    this.calls.push(messages.map((m) => ({ ...m })));
    return this.scripted.shift() ?? { text: "(脚本用尽)" };
  }
}

describe("m06 InMemoryStore 召回", () => {
  it("按 userId 隔离：只召回本人的记忆", async () => {
    const store = new InMemoryStore();
    await store.add("张三关注医疗保险", "u1");
    await store.add("李四关注汽车保险", "u2");

    const r = await store.search("保险", "u1");
    expect(r.every((m) => m.userId === "u1")).toBe(true);
    expect(r.some((m) => m.text.includes("张三"))).toBe(true);
    expect(r.some((m) => m.text.includes("李四"))).toBe(false);
  });

  it("按词重叠召回相关的、丢零分、尊重 limit", async () => {
    const store = new InMemoryStore();
    await store.add("医疗保险等待期九十天", "u1");
    await store.add("汽车保险免赔额", "u1");
    await store.add("今天天气晴朗", "u1");

    const r = await store.search("医疗保险等待期", "u1", 2);
    expect(r.length).toBeLessThanOrEqual(2);
    expect(r[0].text).toContain("医疗"); // 最相关的排第一
    expect(r.some((m) => m.text.includes("天气"))).toBe(false); // 零分被丢
  });
});

describe("m06 runWithMemory 记忆闭环", () => {
  it("一轮问答后，这轮被固化进记忆，之后可召回", async () => {
    const store = new InMemoryStore();
    const client = new FakeClient([{ text: "等待期九十天" }]);

    await runWithMemory(store, client, "医疗保险等待期", "u1", []);

    const recalled = await store.search("等待期", "u1");
    expect(recalled.length).toBeGreaterThan(0);
    expect(recalled[0].text).toContain("九十天");
  });

  it("再次提问时，相关记忆被召回并注入首条消息（primer）", async () => {
    const store = new InMemoryStore();
    await store.add("用户偏好简体中文、关注医疗保险", "u1");
    const client = new FakeClient([{ text: "好的" }]);

    await runWithMemory(store, client, "医疗保险的等待期多久？", "u1", []);

    const firstMsg = client.calls[0][0];
    expect(firstMsg.content).toContain("医疗保险"); // 记忆被注入
    expect(firstMsg.content).toContain("等待期"); // 原问题还在
  });
});
