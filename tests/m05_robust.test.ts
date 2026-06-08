/**
 * m05 验收：健壮性与容错 —— safeRun 兜工具异常 / validateCitations 抓幻觉引用 /
 *           runAgent 硬化（工具抛错不崩、重复调用只执行一次）。
 * 跑：pnpm test
 */
import { describe, it, expect } from "vitest";
import { safeRun, validateCitations } from "../src/robust";
import { runAgent } from "../src/agent";
import type { ToolSpec, LLMClient, LLMResponse, Message } from "../src/llm";
import type { Reference } from "../src/cite";

class FakeClient implements LLMClient {
  calls: Message[][] = [];
  constructor(private scripted: LLMResponse[]) {}
  async complete(messages: Message[], _tools: ToolSpec[]): Promise<LLMResponse> {
    this.calls.push(messages.map((m) => ({ ...m })));
    return this.scripted.shift() ?? { text: "(脚本用尽)" };
  }
}

const boomTool: ToolSpec = {
  name: "boom",
  description: "总是抛错的工具",
  run: () => {
    throw new Error("网络超时");
  },
};

describe("m05 safeRun", () => {
  it("工具抛错 → 返回错误文本，不向外抛", async () => {
    const out = await safeRun(boomTool, {});
    expect(out).toContain("失败");
    expect(out).toContain("网络超时");
  });

  it("正常工具 → 原样返回结果", async () => {
    const ok: ToolSpec = { name: "ok", description: "", run: () => "结果" };
    expect(await safeRun(ok, {})).toBe("结果");
  });
});

describe("m05 validateCitations", () => {
  const refs: Reference[] = [
    { id: 1, url: "https://ex.com/a", text: "..." },
    { id: 2, url: "https://ex.com/b", text: "..." },
  ];

  it("引用全部存在 → []", () => {
    expect(validateCitations("依据 [1] 与 [2] 可知。", refs)).toEqual([]);
  });

  it("引用了不存在的编号 → 列出（去重）", () => {
    expect(validateCitations("见 [1]，又见 [99]，再见 [99]。", refs)).toEqual([99]);
  });
});

describe("m05 runAgent 硬化", () => {
  it("工具抛错：循环不崩，仍返回答案，错误进了 messages", async () => {
    const client = new FakeClient([
      { toolCalls: [{ id: "c1", name: "boom", args: {} }] },
      { text: "已知工具失败，据此回答。" },
    ]);
    const { answer, messages } = await runAgent(client, "x", [boomTool]);
    expect(answer).toBe("已知工具失败，据此回答。");
    expect(messages.some((m) => m.role === "tool" && m.content.includes("失败"))).toBe(true);
  });

  it("重复调用：同名同参只真正执行一次", async () => {
    let runCount = 0;
    const counter: ToolSpec = {
      name: "counter",
      description: "",
      run: () => {
        runCount++;
        return "ok";
      },
    };
    const client = new FakeClient([
      { toolCalls: [{ id: "a", name: "counter", args: { x: 1 } }] },
      { toolCalls: [{ id: "b", name: "counter", args: { x: 1 } }] }, // 同名同参重复
      { text: "done" },
    ]);
    const { messages } = await runAgent(client, "x", [counter]);
    expect(runCount).toBe(1); // 第二次被去重，没再真正执行
    expect(messages.some((m) => m.role === "tool" && m.content.includes("重复"))).toBe(true);
  });
});
