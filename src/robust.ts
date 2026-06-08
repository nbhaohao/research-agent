/**
 * m05 · 健壮性与容错。
 *
 * m01-m04 的循环都默认「工具会成功、LLM 会守规矩」。真实世界不是这样：
 * fetch 会 404、search 会超时抛错、LLM 会反复调同一个工具、还会引用一个根本不存在的 [99]。
 * 这一章把循环硬化，兜住这些失败——agent 该「带着残缺继续」，而不是崩溃或胡说。
 *
 * 两个原语在这里实现（留桩），再由你把它们 + 重复调用去重织进 runAgent。
 */
import type { ToolSpec } from "./llm";
import type { Reference } from "./cite";

/**
 * 安全执行一个工具：把 run 抛出的异常捕获、转成给 LLM 读的错误文本，绝不让循环崩。
 * 契约（见 learn-web Ch m05 第③节）：
 *  - 正常：原样返回 tool.run 的结果。
 *  - 抛错：返回类似「工具 X 执行失败：<错误信息>」的字符串（失败也是给 LLM 的信息）。
 */
export async function safeRun(
  tool: ToolSpec,
  args: Record<string, unknown>,
): Promise<string> {
  throw new Error("m05 未实现：safeRun");
}

/**
 * 找出 answer 里引用了、但 references 中并不存在的编号（幻觉引用，如正文写了 [99] 但只有 [1][2]）。
 * 契约（见 learn-web Ch m05 第③节）：
 *  - 用正则扫出所有 [数字] 引用编号。
 *  - 返回其中不在 references.id 集合里的编号，去重、按出现顺序。全部合法则返回 []。
 */
export function validateCitations(answer: string, references: Reference[]): number[] {
  throw new Error("m05 未实现：validateCitations");
}
