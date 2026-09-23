/**
 * Splits a reasoning model's output into its thinking and its answer.
 *
 * Models like Qwen3 and DeepSeek-R1 wrap their chain of thought in
 * `<think>…</think>`. Some chat templates open the block in the prompt, so the
 * output carries only the closing tag; while streaming, the closing tag has not
 * arrived yet.
 */
export interface ReasonedText {
  /** The thinking, trimmed; null when the model did not think (or thought nothing). */
  readonly reasoning: string | null;
  /** What the model says to the user. */
  readonly answer: string;
  /** True while the thinking block is still being written. */
  readonly thinking: boolean;
}

const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

export function splitReasoning(content: string): ReasonedText {
  const openAt = content.indexOf(OPEN_TAG);
  const closeAt = content.indexOf(CLOSE_TAG);
  const opensAtStart = openAt !== -1 && content.slice(0, openAt).trim() === "";

  // No block: no tags at all, or an opening tag quoted mid-answer.
  if (closeAt === -1 && !opensAtStart) {
    return { reasoning: null, answer: content, thinking: false };
  }

  const reasoningStart = opensAtStart && (closeAt === -1 || openAt < closeAt) ? openAt + OPEN_TAG.length : 0;
  if (closeAt === -1) {
    return { reasoning: nonEmpty(content.slice(reasoningStart)), answer: "", thinking: true };
  }
  return {
    reasoning: nonEmpty(content.slice(reasoningStart, closeAt)),
    answer: content.slice(closeAt + CLOSE_TAG.length).replace(/^\s+/, ""),
    thinking: false,
  };
}

/** The answer alone, for sending history back to the model or copying. */
export function stripReasoning(content: string): string {
  return splitReasoning(content).answer;
}

function nonEmpty(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}
