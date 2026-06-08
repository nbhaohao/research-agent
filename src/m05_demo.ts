/**
 * m05 看效果：让一个「会抛错的工具 + 重复调用 + 幻觉引用」的场景跑起来，看 agent 怎么兜住。
 * 跑：pnpm dev src/m05_demo.ts （需先实现 safeRun/validateCitations 并把它们织进 runAgent）
 */
import { runAgent } from "./agent";
import { validateCitations } from "./robust";
import { cite, type Passage } from "./cite";
import type { LLMClient, LLMResponse, Message, ToolSpec } from "./llm";

const flakyTool: ToolSpec = {
  name: "flaky_search",
  description: "演示用：一调就抛错的工具",
  run: () => {
    throw new Error("503 Service Unavailable");
  },
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
  console.log("m05 demo · 工具抛错 + 重复调用 都兜住，循环不崩");
  console.log("=".repeat(52));

  const client = new ScriptedClient([
    { toolCalls: [{ id: "1", name: "flaky_search", args: { q: "x" } }] }, // 抛错
    { toolCalls: [{ id: "2", name: "flaky_search", args: { q: "x" } }] }, // 同参重复
    { text: "工具暂时不可用，我先基于已有信息作答。" },
  ]);
  const { answer, messages } = await runAgent(client, "查点东西", [flakyTool]);
  console.log("\n--- messages 历史 ---");
  messages.forEach((m, i) => console.log(`  ${i}. [${m.role}] ${m.content}`));
  console.log(`\n最终答案：${answer}（循环没崩）`);

  // 幻觉引用：正文引用了 [99]，但只有 [1][2]
  console.log("\n--- 幻觉引用检查 ---");
  const passages: Passage[] = [
    { text: "等待期九十天。", url: "https://ex.com/a" },
    { text: "核辐射除外。", url: "https://ex.com/b" },
  ];
  const { references } = cite(passages);
  const draft = "等待期为九十天 [1]，另据 [99] 还赠送境外险。";
  const bad = validateCitations(draft, references);
  console.log(`草稿：${draft}`);
  console.log(`只有来源 [1][2]，但正文引用了不存在的：${JSON.stringify(bad)} ← 该拦下来复核`);
}

demo();
