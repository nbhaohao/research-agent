/**
 * m01 · 最小 agent loop。
 *
 * agent 的本质是一个循环：问 LLM → LLM 要么给答案（结束）、要么要调工具；
 * 调完工具把结果喂回去，再问 LLM……直到拿到最终答案。这一章只搭这个循环骨架，
 * 工具系统（注册表 / web 搜索）留到 m02。
 */
import type { LLMClient, Message, ToolSpec } from "./llm";

/** m01 自带的一个最简工具，用来证明「循环能转、工具结果能喂回」。 */
export const clockTool: ToolSpec = {
  name: "current_time",
  description: "返回当前时间（ISO 字符串），不需要参数",
  run: () => new Date().toISOString(),
};

/** 防止 LLM 一直要求调工具导致死循环的硬上限。 */
export const MAX_STEPS = 10;

export interface AgentResult {
  answer: string;
  messages: Message[];
}

/**
 * 跑一轮 agent：从一句用户输入开始，循环驱动 LLM 直到拿到文本答案。
 *
 * 契约（见 learn-web Ch m01 第③节）：
 *  1. messages 初始为 [{ role:"user", content: userMessage }]。
 *  2. 每圈调 client.complete(messages, tools)：
 *     - 有 toolCalls：把「assistant 要调工具」记一条 assistant 消息，再逐个执行工具、
 *       把结果作为 role:"tool" 消息（带 toolCallId）append 回 messages，然后继续下一圈。
 *       未知工具名 → tool 消息内容写明「未知工具」，不要抛错崩掉循环。
 *     - 有 text（无 toolCalls）：append 一条 assistant 消息，返回 { answer, messages }。
 *  3. 超过 MAX_STEPS 仍没拿到文本答案 → 返回 answer 含「最大步数」的兜底。
 */
export async function runAgent(
  client: LLMClient,
  userMessage: string,
  tools: ToolSpec[] = [],
): Promise<AgentResult> {
  throw new Error("m01 未实现：runAgent");
}
