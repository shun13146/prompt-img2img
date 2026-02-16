import type {
  Selections,
  TagCategory,
  TagDatabase,
  RuleAction,
  FaceVisibilityOptions,
} from "./types.js";

/**
 * Collect all active rules from the current selections.
 * Rules are embedded in tag options (single-select categories).
 */
export function collectActiveRules(
  selections: Selections,
  tagDb: TagDatabase,
  faceVisibilityOptions?: FaceVisibilityOptions
): string[] {
  const rules: string[] = [];

  for (const category of tagDb.categories) {
    if (category.type !== "single" || !category.options) continue;

    const selectedId = selections[category.id] as string | null;
    if (!selectedId) continue;

    const option = category.options.find((o) => o.id === selectedId);
    if (!option) continue;

    // Add standard rules
    if (option.rules) {
      rules.push(...option.rules);
    }

    // Add optional rules based on checkboxes (face_visibility special case)
    if (faceVisibilityOptions && category.id === "face_visibility") {
      if (option.optional_rules && faceVisibilityOptions.remove_hair) {
        rules.push(...option.optional_rules);
      }
    }
  }

  return [...new Set(rules)]; // deduplicate
}

/**
 * Determine which categories should be disabled (grayed out) based on active rules.
 */
export function getDisabledCategories(activeRules: string[]): Set<string> {
  // No categories are disabled — eye categories always stay visible
  return new Set<string>();
}

/**
 * Get additional tags that should be injected into block3 based on the selected option.
 * For example, "closed" eye_state adds "closed eyes".
 */
export function getAdditionalTags(
  selections: Selections,
  tagDb: TagDatabase,
  faceVisibilityOptions?: FaceVisibilityOptions
): string[] {
  const tags: string[] = [];

  for (const category of tagDb.categories) {
    if (category.type !== "single" || !category.options) continue;

    const selectedId = selections[category.id] as string | null;
    if (!selectedId) continue;

    const option = category.options.find((o) => o.id === selectedId);
    if (!option || !option.prompt) continue;

    // The option's own prompt goes into block3
    tags.push(option.prompt);

    // Add optional_tags based on face_visibility checkboxes
    if (
      faceVisibilityOptions &&
      category.id === "face_visibility" &&
      option.optional_tags
    ) {
      if (faceVisibilityOptions.face_out_of_frame) {
        const tag = option.optional_tags.find((t) =>
          t.includes("face out of frame")
        );
        if (tag) tags.push(tag);
      }
      if (faceVisibilityOptions.head_out_of_frame) {
        const tag = option.optional_tags.find((t) =>
          t.includes("head out of frame")
        );
        if (tag) tags.push(tag);
      }
    }
  }

  return tags;
}
