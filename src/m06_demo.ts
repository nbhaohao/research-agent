/**
 * m06 看效果：同一个用户问两次相关的问题，看 agent 怎么「记住」上一轮。
 * 跑：pnpm dev src/m06_demo.ts （需先实现 InMemoryStore.search + runWithMemory）
 *
 * 默认用 InMemoryStore（零依赖、能直接跑）。想试真实长期记忆：
 *   pnpm add mem0ai && 在 .env 配 OPENAI_API_KEY（或兼容端点），
 *   再把下面的 new InMemoryStore() 换成 new Mem0Store()——上层一行不用动（同一个 MemoryStore 接口）。
 */
import { InMemoryStore, runWithMemory } from "./memory";
import type { LLMClient, LLMResponse, Message, ToolSpec } from "./llm";

class ScriptedClient implements LLMClient {
  constructor(private steps: LLMResponse[]) {}
  async complete(messages: Message[], _tools: ToolSpec[]): Promise<LLMResponse> {
    const first = messages[0];
    console.log(`  [LLM] 首条消息(${first.role})：\n    ${first.content.replace(/\n/g, "\n    ")}`);
    return this.steps.shift() ?? { text: "(脚本用尽)" };
  }
}

async function demo() {
  console.log("=".repeat(56));
  console.log("m06 demo · 跨轮次记忆：第二轮带着第一轮的结论开跑");
  console.log("=".repeat(56));

  const store = new InMemoryStore();
  const userId = "u1";

  console.log("\n--- 第 1 轮：问等待期（store 此刻还空，无记忆可召回）---");
  const c1 = new ScriptedClient([{ text: "医疗险等待期通常九十天。" }]);
  const r1 = await runWithMemory(store, c1, "医疗保险的等待期多久？", userId, []);
  console.log(`  最终答案：${r1.answer}`);

  console.log("\n--- 第 2 轮：追问免赔额（应召回第 1 轮的问答并注入 primer）---");
  const c2 = new ScriptedClient([{ text: "在等待期之外，免赔额另算。" }]);
  const r2 = await runWithMemory(store, c2, "那等待期内的免赔额怎么算？", userId, []);
  console.log(`  最终答案：${r2.answer}`);

  console.log("\n--- 记忆隔离：换个用户 u2 问，召回不到 u1 的记忆 ---");
  const recalledForU2 = await store.search("等待期", "u2");
  console.log(`  u2 召回到 ${recalledForU2.length} 条（应为 0，井水不犯河水）`);

  console.log("\n短期上下文（单轮 messages）用完即弃；会话记忆（store）跨轮次还在。");
  console.log("把 InMemoryStore 换成 Mem0Store，记忆还能跨「会话/进程」并语义召回。");
}

demo();
