import type {
  CharacterOutfit,
  Selections,
  TagSelection,
  TagDatabase,
  PromptResult,
  FaceVisibilityOptions,
} from "./types.js";
import {
  collectActiveRules,
  getAdditionalTags,
} from "./ruleEngine.js";

/**
 * Format a tag with weight. If weight is 1.0, output plain tag.
 * Otherwise output (tag:weight) format.
 */
export function formatWeightedTag(tag: TagSelection): string {
  if (tag.weight === 1.0) return tag.prompt;
  return `(${tag.prompt}:${tag.weight.toFixed(2)})`;
}

/**
 * Collect all multi-select tags from pose categories.
 */
function collectPoseTags(selections: Selections): TagSelection[] {
  const poseKeys = [
    "pose_head",
    "pose_hand_head",
    "pose_hand_body",
    "pose_hand_torso",
    "pose_hand_prop",
    "pose_fingers",
    "pose_legs",
    "pose_static_upper",
    "pose_standing",
    "pose_sitting",
    "pose_lying",
    "pose_dynamic",
  ];

  const tags: TagSelection[] = [];
  for (const key of poseKeys) {
    const val = selections[key];
    if (Array.isArray(val)) {
      tags.push(...val);
    }
  }
  return tags;
}

/**
 * Build the final prompt from outfit, selections, rules, and free text.
 * Returns a PromptResult with block1, block2, block3, and full prompt.
 *
 * This is a PURE FUNCTION - no side effects, fully testable.
 */
export function buildPrompt(
  outfit: CharacterOutfit,
  selections: Selections,
  tagDb: TagDatabase,
  freeText: string,
  faceVisibilityOptions?: FaceVisibilityOptions,
  propsText?: string,
  accessoriesText?: string
): PromptResult {
  const activeRules = collectActiveRules(selections, tagDb, faceVisibilityOptions);

  // ===== Block 1: Quality tags (fixed per outfit) =====
  const block1 = outfit.block1.quality;

  // ===== Block 2: Character tags (hair → lora → eyes → features → clothing) =====
  const block2Parts: string[] = [];

  // hair (removable by rule)
  if (!activeRules.includes("remove_hair") && outfit.block2.hair) {
    block2Parts.push(outfit.block2.hair);
  }

  // lora (always included)
  if (outfit.block2.lora) {
    block2Parts.push(outfit.block2.lora);
  }

  // eyes (removable by rule)
  if (!activeRules.includes("remove_eyes") && outfit.block2.eyes) {
    block2Parts.push(outfit.block2.eyes);
  }

  // features (always included)
  if (outfit.block2.features) {
    block2Parts.push(outfit.block2.features);
  }

  // clothing (always included)
  if (outfit.block2.clothing) {
    block2Parts.push(outfit.block2.clothing);
  }

  const block2 = block2Parts.filter(Boolean).join(", ");

  // ===== Block 3: Dynamic tags (from selections) =====
  const block3Parts: string[] = [];

  // When face is hidden, skip all face-related tags
  const faceHidden = selections.face_visibility === "hidden";
  // When eyes are closed (remove_eyes rule active), skip eye_detail
  const eyesClosed = activeRules.includes("remove_eyes");

  // Expression tags (multi, weighted) — skip if face hidden
  if (!faceHidden) {
    block3Parts.push(...selections.expression.map(formatWeightedTag));
  }

  // Order matches user's template:
  // 表情 → 視線 → 目の状態 → 目の形 → 口の形 → 顔パーツ → 状態 → ポーズ → 注目点 → 背景 → 角度

  // Gaze (from single-select) — 視線 — skip if face hidden or eyes closed
  if (!faceHidden && !eyesClosed) {
    const gazeTag = getOptionPrompt(selections, tagDb, "gaze");
    if (gazeTag) block3Parts.push(gazeTag);
  }

  // Eye state (from single-select) — 目の状態 — skip if face hidden
  if (!faceHidden) {
    const eyeStateTag = getOptionPrompt(selections, tagDb, "eye_state");
    if (eyeStateTag) block3Parts.push(eyeStateTag);
  }

  // Eye detail tags (multi, weighted) — 目の形 — skip if face hidden or eyes closed
  if (!faceHidden && !eyesClosed) {
    block3Parts.push(...selections.eye_detail.map(formatWeightedTag));
  }

  // Mouth tags (multi, weighted) — 口の形 — skip if face hidden
  if (!faceHidden) {
    block3Parts.push(...selections.mouth.map(formatWeightedTag));
  }

  // Face parts (multi, weighted) — 顔パーツ — skip if face hidden
  if (!faceHidden) {
    block3Parts.push(...selections.face_parts.map(formatWeightedTag));
  }

  // Status tags (multi, weighted) — 状態
  block3Parts.push(...selections.status.map(formatWeightedTag));

  // Pose tags (all pose categories, weighted) — ポーズ
  block3Parts.push(...collectPoseTags(selections).map(formatWeightedTag));

  // Focus tags (multi, weighted) — 注目点
  block3Parts.push(...selections.focus.map(formatWeightedTag));

  // Background (from single-select) — 背景
  const bgTag = getOptionPrompt(selections, tagDb, "background");
  if (bgTag) block3Parts.push(bgTag);

  // Props/items (持ち物) — 背景の後
  if (propsText && propsText.trim()) {
    block3Parts.push(`holding ${propsText.trim()}`);
  }

  // Accessories (小物) — 持ち物の後
  if (accessoriesText && accessoriesText.trim()) {
    block3Parts.push(accessoriesText.trim());
  }

  // Angle (from single-select) — 角度
  const angleTag = getOptionPrompt(selections, tagDb, "angle");
  if (angleTag) block3Parts.push(angleTag);

  // Face visibility additional tags (facing away, eyeless, face out of frame, etc.)
  const faceVisTag = getOptionPrompt(selections, tagDb, "face_visibility");
  if (faceVisTag) block3Parts.push(faceVisTag);

  // Optional face visibility tags
  if (faceVisibilityOptions) {
    const fvOption = tagDb.categories
      .find((c) => c.id === "face_visibility")
      ?.options?.find((o) => o.id === (selections.face_visibility as string));
    if (fvOption?.optional_tags) {
      if (faceVisibilityOptions.face_out_of_frame) {
        const tag = fvOption.optional_tags.find((t) => t.includes("face out of frame"));
        if (tag) block3Parts.push(tag);
      }
      if (faceVisibilityOptions.head_out_of_frame) {
        const tag = fvOption.optional_tags.find((t) => t.includes("head out of frame"));
        if (tag) block3Parts.push(tag);
      }
    }
  }

  // Lighting tags (multi, weighted)
  block3Parts.push(...selections.lighting.map(formatWeightedTag));

  // Time of day (from single-select)
  const timeTag = getOptionPrompt(selections, tagDb, "time_of_day");
  if (timeTag) block3Parts.push(timeTag);

  // R18 expression tags (multi, weighted)
  block3Parts.push(...selections.r18_expression.map(formatWeightedTag));

  // R18 position tags (multi, weighted)
  block3Parts.push(...selections.r18_position.map(formatWeightedTag));

  // Custom tags (weighted)
  block3Parts.push(...selections.custom_tags.map(formatWeightedTag));

  // Free text input (appended at the end)
  if (freeText.trim()) {
    block3Parts.push(freeText.trim());
  }

  const block3 = block3Parts.filter(Boolean).join(", ");

  // ===== Combine with BREAK =====
  const full = `${block1}\nBREAK\n${block2}\nBREAK\n${block3}`;

  return { block1, block2, block3, full };
}

/**
 * Get the prompt string for a single-select category's currently selected option.
 */
function getOptionPrompt(
  selections: Selections,
  tagDb: TagDatabase,
  categoryId: string
): string | null {
  const selectedId = selections[categoryId] as string | null;
  if (!selectedId) return null;

  const category = tagDb.categories.find((c) => c.id === categoryId);
  if (!category?.options) return null;

  const option = category.options.find((o) => o.id === selectedId);
  return option?.prompt || null;
}

/**
 * Create an empty Selections object.
 */
export function createEmptySelections(): Selections {
  return {
    // Single-select
    eye_state: null,
    gaze: null,
    angle: null,
    face_visibility: null,
    background: null,
    time_of_day: null,
    // Multi-select
    expression: [],
    mouth: [],
    eye_detail: [],
    face_parts: [],
    status: [],
    pose_head: [],
    pose_hand_head: [],
    pose_hand_body: [],
    pose_hand_torso: [],
    pose_hand_prop: [],
    pose_fingers: [],
    pose_legs: [],
    pose_static_upper: [],
    pose_standing: [],
    pose_sitting: [],
    pose_lying: [],
    pose_dynamic: [],
    focus: [],
    lighting: [],
    r18_expression: [],
    r18_position: [],
    custom_tags: [],
  };
}
