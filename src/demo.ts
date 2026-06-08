/**
 * m01 看效果：用脚本化 LLM（不真调）把 agent loop 的每一步打出来。
 * 跑：pnpm dev src/demo.ts （需先实现 runAgent）
 */
import { runAgent, clockTool } from "./agent";
import type { LLMClient, LLMResponse, Message, ToolSpec } from "./llm";

/** 脚本化 LLM：按预设序列返回，并在每次被调用时打印它看到的上下文。 */
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
  console.log("m01 demo · agent loop 怎么转（脚本化 LLM，不真调）");
  console.log("=".repeat(52));
  console.log("用户问：现在几点？\n");

  // 第 1 圈：LLM「决定」调 current_time；第 2 圈：拿到结果后给出文本答案。
  const client = new ScriptedClient([
    { toolCalls: [{ id: "c1", name: "current_time", args: {} }] },
    { text: "已根据查到的时间回答用户。" },
  ]);

  const { answer, messages } = await runAgent(client, "现在几点？", [clockTool]);

  console.log("\n--- 最终 messages 历史 ---");
  messages.forEach((m, i) => console.log(`  ${i}. [${m.role}] ${m.content}`));
  console.log(`\n最终答案：${answer}`);
}

demo();
