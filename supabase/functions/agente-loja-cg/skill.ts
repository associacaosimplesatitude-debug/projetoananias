// Skill v1 — carrega o conteúdo markdown do arquivo skill-v1.md
const skillUrl = new URL("./skill-v1.md", import.meta.url);
export const SYSTEM_PROMPT = await Deno.readTextFile(skillUrl);
export const SKILL_VERSION = "v1";
