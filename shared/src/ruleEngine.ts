import type {
  Selections,
  TagCategory,
  TagDatabase,
  TagSelection,
  RuleAction,
  FaceVisibilityOptions,
} from "./types.js";

/**
 * Collect all active rules from the current selections.
 * Rules come from:
 * 1. Single-select category options (e.g., face_visibility)
 * 2. Multi-select tag entries with rules (e.g., eye_state tags with remove_eyes)
 */
export function collectActiveRules(
  selections: Selections,
  tagDb: TagDatabase,
  faceVisibilityOptions?: FaceVisibilityOptions
): string[] {
  const rules: string[] = [];

  for (const category of tagDb.categories) {
    if (category.type === "single" && category.options) {
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
    } else if (category.type === "multi" && category.subcategories) {
      // Collect rules from selected multi-select tags that have rules
      const selected = selections[category.id];
      if (!Array.isArray(selected)) continue;

      for (const sel of selected as TagSelection[]) {
        // Find the tag entry to check for rules
        for (const sub of category.subcategories) {
          const tagEntry = sub.tags.find((t) => t.id === sel.tag_id);
          if (tagEntry?.rules) {
            rules.push(...tagEntry.rules);
          }
        }
      }
    }
  }

  return [...new Set(rules)]; // deduplicate
}

/**
 * Determine which categories should be disabled (grayed out) based on active rules.
 */
export function getDisabledCategories(activeRules: string[]): Set<string> {
  const disabled = new Set<string>();

  if (activeRules.includes("remove_eyes")) {
    disabled.add("eye_detail");
    disabled.add("gaze");
  }

  return disabled;
}

/**
 * Determine which categories are suppressed (not applied to prompt but still selectable).
 * Used when face is hidden — expression, mouth, eye_detail, gaze, eye_state, face_parts
 * are still clickable but shown with warning color.
 */
export function getSuppressedCategories(
  selections: Selections,
  activeRules: string[]
): Set<string> {
  const suppressed = new Set<string>();

  // Face hidden → face-related categories are suppressed
  if (selections.face_visibility === "hidden") {
    suppressed.add("expression");
    suppressed.add("mouth");
    suppressed.add("eye_detail");
    suppressed.add("gaze");
    suppressed.add("eye_state");
    suppressed.add("face_parts");
  }

  // Eyes closed → eye detail and gaze are suppressed
  if (activeRules.includes("remove_eyes")) {
    suppressed.add("eye_detail");
    suppressed.add("gaze");
  }

  return suppressed;
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
