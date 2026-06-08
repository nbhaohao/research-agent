/**
 * m07 看效果：给一个主题，跑完整研究流水线，打印一份「带引用 + 标注待复核」的研究报告。
 * 跑：pnpm dev src/m07_demo.ts （需先实现 research()）
 *
 * 这里全用 Fake 依赖（确定性、零网络）。真实运行只需把
 *   FakeSearchProvider → DuckDuckGoProvider、FakeFetcher → HttpFetcher、FakeClient → 真实 LLM 适配器，
 * research() 一行不用动（同一组接口）——这正是全课「依赖接口、不绑实现」的回报。
 */
import { research, type ResearchDeps } from "./research";
import { FakeSearchProvider } from "./search";
import { FakeFetcher } from "./fetch";
import type { LLMClient, LLMResponse, Message, ToolSpec } from "./llm";

const MEDICAL = "https://ins.example/medical";
const NOTICE = "https://ins.example/notice";

class ScriptedClient implements LLMClient {
  constructor(private steps: LLMResponse[]) {}
  async complete(_messages: Message[], _tools: ToolSpec[]): Promise<LLMResponse> {
    return this.steps.shift() ?? { text: "(脚本用尽)" };
  }
}

async function demo() {
  console.log("=".repeat(58));
  console.log("m07 demo · 完整研究流水线：搜索→抓取→编号→总结→校验");
  console.log("=".repeat(58));

  const deps: ResearchDeps = {
    // 故意让 LLM 写一句有出处、一句凭空捏造、一句引用不存在的 [99]，看校验怎么标
    client: new ScriptedClient([
      {
        text: "医疗保险的等待期通常为九十天 [1]。本产品还免费赠送境外旅行意外险 [1]。据 [99] 显示理赔率极高。",
      },
    ]),
    search: new FakeSearchProvider({
      医疗保险: [
        { title: "医疗险条款", url: MEDICAL, snippet: "等待期与除外责任" },
        { title: "投保须知", url: NOTICE, snippet: "投保年龄" },
      ],
    }),
    fetcher: new FakeFetcher({
      [MEDICAL]: "<p>医疗保险的等待期通常为九十天。</p><p>核辐射导致的疾病属于除外责任。</p>",
      [NOTICE]: "<p>投保年龄上限为六十五周岁。</p>",
    }),
  };

  const report = await research("医疗保险等待期", deps);

  console.log(`\n# 研究报告：${report.topic}\n`);
  console.log(report.answer);

  console.log(`\n## 参考来源`);
  for (const r of report.references) {
    console.log(`  [${r.id}] ${r.url}  ——  ${r.text}`);
  }

  console.log(`\n## ⚠️ 待人工复核`);
  console.log(`  找不到出处的句子（可能幻觉内容）：`);
  report.unsupported.forEach((s) => console.log(`    - ${s}`));
  console.log(`  引用了不存在的编号（幻觉引用）：${JSON.stringify(report.invalidCitations)}`);

  console.log(
    `\n流水线式编排：步骤由代码写死、LLM 只管「读证据→写总结」，所以可测、可控、每句可溯源。`,
  );
}

demo();
