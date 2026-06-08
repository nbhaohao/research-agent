/**
 * m01 · agent 与 LLM 之间的契约类型。
 *
 * agent loop 只依赖这个抽象 LLMClient，不直接绑定某个厂商 SDK——这样测试能注入
 * 一个脚本化的 FakeClient（零依赖、不真调 LLM），真实运行时再换成 DeepSeek 适配器。
 */

export type Role = "user" | "assistant" | "tool";

/** 一条对话消息。tool 消息用 toolCallId 关联是哪次工具调用的结果。 */
export interface Message {
  role: Role;
  content: string;
  toolCallId?: string;
}

/** LLM 决定要调用的一个工具。 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * LLM 一次响应的两种形态（互斥）：
 *  - 给出 text  → 最终回答，loop 结束；
 *  - 给出 toolCalls → 还要先调工具拿数据，loop 继续。
 */
export interface LLMResponse {
  text?: string;
  toolCalls?: ToolCall[];
}

/** 一个工具：名字 + 给 LLM 看的描述 + 真正执行的函数。 */
export interface ToolSpec {
  name: string;
  description: string;
  run(args: Record<string, unknown>): Promise<string> | string;
}

/** LLM 客户端抽象：喂入消息历史 + 可用工具，得到一次响应。 */
export interface LLMClient {
  complete(messages: Message[], tools: ToolSpec[]): Promise<LLMResponse>;
}
