export { PolicyEngine } from "./engine";
export type { PolicyCheckResult } from "./engine";

export { evaluateCondition } from "./conditions";
export type {
  ConditionResult,
  ConditionEvaluator,
  ScoreBelowValue,
  FindingExistsValue,
  PermissionUsedValue,
  DependencyBannedValue,
  CustomConditionValue,
} from "./conditions";

export {
  strictPreset,
  standardPreset,
  permissivePreset,
  enterprisePreset,
  presets,
  getPreset,
  listPresets,
} from "./presets";

export { loadPolicyFile, parsePolicyJson } from "./loader";
