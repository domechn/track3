import type { ProviderFunctionDef } from "./types";
import type { Skill, SkillArgs, ToolResult } from "./skills/types";
import { trace } from "./skills/functions/trace";
import { redactSecrets } from "../security/redact";

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
    return { ok: false, error: `Unknown skill: ${redactSecrets(name)}` };
  }
  const validationError = validateArgs(args, skill.parameters);
  if (validationError) return { ok: false, error: `Invalid arguments for ${redactSecrets(name)}: ${redactSecrets(validationError)}` };
  const properties = (skill.parameters.properties ?? {}) as Record<string, unknown>;
  const normalizedArgs = Object.fromEntries(
    Object.entries(args)
      .filter(([key, value]) => key in properties && value != null)
      .map(([key, value]) => [
        key,
        (properties[key] as { type?: string }).type === "number" && typeof value === "string"
          ? Number(value)
          : value,
      ]),
  );
  try {
    trace("runSkill");
    const result = await skill.run(normalizedArgs, ctx);
    trace("runSkill complete");
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: redactSecrets((err as Error).message ?? String(err)) };
  }
}

function validateArgs(args: unknown, schema: Record<string, unknown>): string | undefined {
  if (!args || typeof args !== "object" || Array.isArray(args)) return "expected an object";
  if ("__raw" in args) return "invalid JSON";
  const json = JSON.stringify(args);
  if (json.length > 16_384) return "arguments are too large";
  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  for (const key of (schema.required ?? []) as string[]) {
    if (!(key in args) || (args as Record<string, unknown>)[key] == null) return `${key} is required`;
  }
  for (const [key, value] of Object.entries(args)) {
    const rule = properties[key];
    if (!rule || value == null) continue;
    const type = rule.type;
    if (type === "string" && typeof value !== "string") return `${key} must be a string`;
    if (type === "number" && (
      !(typeof value === "number" && Number.isFinite(value)) &&
      !(typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
    )) return `${key} must be a number`;
    if (type === "array" && (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== (rule.items as { type?: string })?.type))) {
      return `${key} must be a valid array`;
    }
    if (Array.isArray(rule.enum) && !rule.enum.includes(value)) return `${key} has an unsupported value`;
  }
  return undefined;
}
