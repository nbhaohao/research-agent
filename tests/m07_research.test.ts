/**
 * m07 验收：完整研究流水线 research() —— 搜索→抓取→检索→编号→总结→校验，
 *           产出带引用、且把「幻觉内容 / 幻觉引用」标出来的 ResearchReport。
 * 跑：pnpm test
 */
import { describe, it, expect, beforeEach } from "vitest";
import { research, type ResearchDeps } from "../src/research";
import { FakeSearchProvider } from "../src/search";
import { FakeFetcher } from "../src/fetch";
import type { LLMClient, LLMResponse, Message, ToolSpec } from "../src/llm";

const MEDICAL = "https://ins.example/medical";
const NOTICE = "https://ins.example/notice";

// LLM 的总结：1 句有出处([1])、1 句凭空捏造(无出处)、1 句引用了不存在的 [99]。
const SCRIPTED_ANSWER =
  "医疗保险的等待期通常为九十天 [1]。本产品还免费赠送境外旅行意外险 [1]。据 [99] 显示理赔率极高。";

class FakeClient implements LLMClient {
  calls: Message[][] = [];
  constructor(private scripted: LLMResponse[]) {}
  async complete(messages: Message[], _tools: ToolSpec[]): Promise<LLMResponse> {
    this.calls.push(messages.map((m) => ({ ...m })));
    return this.scripted.shift() ?? { text: "(脚本用尽)" };
  }
}

describe("m07 research 流水线", () => {
  let deps: ResearchDeps;
  let client: FakeClient;

  beforeEach(() => {
    client = new FakeClient([{ text: SCRIPTED_ANSWER }]);
    deps = {
      client,
      search: new FakeSearchProvider({
        医疗保险: [
          { title: "医疗险条款", url: MEDICAL, snippet: "等待期与除外责任" },
          { title: "投保须知", url: NOTICE, snippet: "投保年龄" },
        ],
      }),
      fetcher: new FakeFetcher({
        [MEDICAL]:
          "<p>医疗保险的等待期通常为九十天。</p><p>核辐射导致的疾病属于除外责任。</p>",
        [NOTICE]: "<p>投保年龄上限为六十五周岁。</p>",
      }),
    };
  });

  it("证据来自抓取：references 非空，每条带 url", async () => {
    const report = await research("医疗保险等待期", deps);
    expect(report.references.length).toBeGreaterThan(0);
    expect(report.references.every((r) => r.url.startsWith("https://"))).toBe(true);
    expect(report.references.some((r) => r.url === MEDICAL)).toBe(true);
  });

  it("编号注入了 prompt：喂给 LLM 的 prompt 含来源原文", async () => {
    await research("医疗保险等待期", deps);
    const prompt = client.calls[0][0].content;
    expect(prompt).toContain("等待期"); // cite 的 sourcesBlock 进了 prompt
    expect(prompt).toContain("[1]"); // 带编号
  });

  it("answer 是 LLM 的总结原文", async () => {
    const report = await research("医疗保险等待期", deps);
    expect(report.answer).toBe(SCRIPTED_ANSWER);
  });

  it("幻觉内容被标出：捏造的那句进 unsupported", async () => {
    const report = await research("医疗保险等待期", deps);
    expect(report.unsupported.some((s) => s.includes("境外旅行意外险"))).toBe(true);
    // 有出处的那句不该被误标
    expect(report.unsupported.some((s) => s.includes("九十天"))).toBe(false);
  });

  it("幻觉引用被抓出：invalidCitations 含 99", async () => {
    const report = await research("医疗保险等待期", deps);
    expect(report.invalidCitations).toContain(99);
  });
});
