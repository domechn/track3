import type { ProviderFunctionDef } from "./types";
import type { Skill, SkillArgs, ToolResult } from "./skills/types";
import { trace, traceError } from "./skills/functions/trace";

// SkillRegistry owns the lookup of every registered AI skill. Skills
// register themselves at module load time via the side-effect import in
// `./skills/index`.
const registry = new Map<string, Skill>();

export function registerSkill(skill: Skill): void {
  registry.set(skill.name, skill);
  trace("registerSkill", skill.name, skill.description.slice(0, 60));
}

export function getSkill(name: string): Skill | undefined {
  return registry.get(name);
}

export function listSkills(): Skill[] {
  return Array.from(registry.values());
}

export function clearSkillRegistry(): void {
  registry.clear();
}

// toOpenAITools converts the registered skills to the function-calling
// schema expected by the OpenAI chat completions endpoint.
export function toOpenAITools(): ProviderFunctionDef[] {
  return listSkills().map((s) => ({
    name: s.name,
    description: s.description,
    parameters: s.parameters,
  }));
}

// runSkill dispatches a tool call to the matching skill. Returns
// { ok: true, result } on success, { ok: false, error } when the skill
// is missing or throws. The caller is responsible for converting the
// result into events for the chat stream.
export async function runSkill(
  name: string,
  args: SkillArgs,
  ctx: Parameters<Skill["run"]>[1],
): Promise<
  | { ok: true; result: ToolResult }
  | { ok: false; error: string }
> {
  const skill = getSkill(name);
  if (!skill) {
    return { ok: false, error: `Unknown skill: ${name}` };
  }
  try {
    trace("runSkill", name, "args:", JSON.stringify(args).slice(0, 200));
    const result = await skill.run(args ?? {}, ctx);
    trace("runSkill", name, "-> ok, text:", result.text?.slice(0, 80));
    return { ok: true, result };
  } catch (err) {
    traceError("runSkill " + name + " threw", err);
    return { ok: false, error: (err as Error).message ?? String(err) };
  }
}
