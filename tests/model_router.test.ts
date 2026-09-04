import { discoverModels, rankModels, selectModel, getFallbackChain, type FeatherlessModelMetadata } from "../ai/modelRouter";

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
  }
}

async function run() {
  console.log("── Testing Featherless Model Router ──");

  // 1. Model Discovery
  const models = await discoverModels();
  assert(models.length > 0, `Discovered models from catalog (count: ${models.length})`);
  assert(models.every((m) => typeof m.id === "string" && m.id.length > 0), "All models have valid IDs");

  // 2. Ranking for Code Generation
  const sampleModels: FeatherlessModelMetadata[] = [
    { id: "Qwen/Qwen2.5-Coder-32B-Instruct", context_length: 32768, features: { tool_use: true }, available_on_current_plan: true },
    { id: "General/Fast-7B", context_length: 8192, available_on_current_plan: true },
    { id: "Vision/Qwen-VL-7B", context_length: 32768, features: { image_input: true }, available_on_current_plan: true },
  ];
  const rankedCode = rankModels(sampleModels, "CODE_GENERATION");
  assert(rankedCode[0].id === "Qwen/Qwen2.5-Coder-32B-Instruct", "Coder model ranked #1 for CODE_GENERATION");

  // 3. Ranking for Vision
  const rankedVision = rankModels(sampleModels, "VISION");
  assert(rankedVision[0].id === "Vision/Qwen-VL-7B", "Vision model ranked #1 for VISION task");

  // 4. Model Selection for Problem Solving
  const selProblem = await selectModel("TEXT_PROBLEM_SOLVING");
  assert(typeof selProblem.primary === "string" && selProblem.primary.length > 0, "Selected primary model for TEXT_PROBLEM_SOLVING");
  assert(typeof selProblem.secondary === "string" && selProblem.secondary.length > 0, "Selected secondary model for fallback");
  assert(selProblem.primary !== selProblem.secondary, "Primary and secondary models are distinct");

  // 5. Vision Selection
  const selVision = await selectModel("VISION", { requireVision: true });
  assert(selVision.supportsVision === true, "Model selection confirms vision capability for VISION task");

  // 6. Fallback Chain
  const chain = await getFallbackChain("DSA_REASONING");
  assert(chain.length >= 2, `Fallback chain contains at least 2 candidate models (found ${chain.length})`);

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  Model Router Suite: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════════════\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
