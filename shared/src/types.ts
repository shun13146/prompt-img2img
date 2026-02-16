// ============================================
// Character Types (characters.json)
// ============================================

export interface Character {
  id: string;
  name: string;
  group: string; // e.g. "神様のかくしごと/メイン"
  outfits: CharacterOutfit[];
  settings: GenerationSettings;
  memo: string;
}

export interface CharacterOutfit {
  id: string;
  name: string;
  block1: {
    quality: string;
  };
  block2: {
    hair: string;
    lora: string;
    eyes: string;
    features: string;
    clothing: string;
  };
}

export interface GenerationSettings {
  steps: number;
  sampler: string;
  cfg_scale: number;
  width: number;
  height: number;
  denoising_strength: number;
  n_iter: number; // number of images to generate (batch count)
  adetailer?: {
    model: string;
    prompt: string;
    negative_prompt: string;
  };
}

// ============================================
// Tag Types (tags.json)
// ============================================

/** Single-select option (eye_state, gaze, angle, etc.) */
export interface TagOption {
  id: string;
  label: string;
  prompt: string;
  rules?: string[];
  optional_tags?: string[];
  optional_rules?: string[];
}

/** Multi-select tag entry */
export interface TagEntry {
  id: string;
  label: string;
  prompt: string;
  favorite: boolean;
}

export interface TagSubcategory {
  name: string;
  tags: TagEntry[];
}

/** A tag category - either single-select (options) or multi-select (subcategories) */
export interface TagCategory {
  id: string;
  label: string;
  type: "single" | "multi";
  zone: "primary" | "secondary";
  options?: TagOption[];
  subcategories?: TagSubcategory[];
}

export interface TagDatabase {
  categories: TagCategory[];
}

// ============================================
// Selections / Prompt Types
// ============================================

export interface TagSelection {
  tag_id: string;
  prompt: string;
  weight: number;
}

export interface Selections {
  // Single-select categories
  eye_state: string | null;
  gaze: string | null;
  angle: string | null;
  face_visibility: string | null;
  background: string | null;
  time_of_day: string | null;
  // Multi-select categories
  expression: TagSelection[];
  mouth: TagSelection[];
  eye_detail: TagSelection[];
  face_parts: TagSelection[];
  status: TagSelection[];
  // Pose categories
  pose_head: TagSelection[];
  pose_hand_head: TagSelection[];
  pose_hand_body: TagSelection[];
  pose_hand_torso: TagSelection[];
  pose_hand_prop: TagSelection[];
  pose_fingers: TagSelection[];
  pose_legs: TagSelection[];
  pose_static_upper: TagSelection[];
  pose_standing: TagSelection[];
  pose_sitting: TagSelection[];
  pose_lying: TagSelection[];
  pose_dynamic: TagSelection[];
  // Additional categories
  focus: TagSelection[];
  lighting: TagSelection[];
  r18_expression: TagSelection[];
  r18_position: TagSelection[];
  // Custom tags added via free search
  custom_tags: TagSelection[];
  [key: string]: string | null | TagSelection[];
}

export interface PromptResult {
  block1: string;
  block2: string;
  block3: string;
  full: string;
}

// ============================================
// Face visibility optional toggles
// ============================================

export interface FaceVisibilityOptions {
  face_out_of_frame: boolean;
  head_out_of_frame: boolean;
  remove_hair: boolean;
}

// ============================================
// Queue Types (queue.json)
// ============================================

export type QueueItemStatus = "pending" | "running" | "done" | "failed";

export interface QueueItem {
  id: string;
  source_image_path: string;
  character_id: string;
  outfit_id: string;
  selections: Selections;
  free_text: string;
  final_prompt: string;
  settings: GenerationSettings;
  status: QueueItemStatus;
  result_images: string[];      // paths to generated images
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export type QueueRunnerStatus = "idle" | "running" | "paused";

export interface QueueStatusInfo {
  runner: QueueRunnerStatus;
  current_task_id: string | null;
  pending_count: number;
  done_count: number;
  failed_count: number;
}

/** SSE event types sent from server to client */
export type QueueEvent =
  | { type: "status"; data: QueueStatusInfo }
  | { type: "task_start"; data: { id: string } }
  | { type: "task_done"; data: { id: string; result_images: string[] } }
  | { type: "task_failed"; data: { id: string; error: string } }
  | { type: "progress"; data: { id: string; step: number; total: number; preview?: string } };

// ============================================
// Settings Types (settings.json)
// ============================================

export interface AppSettings {
  forge_api_url: string;
  negative_prompt: string;
  checkpoint_model: string;
  output_folder: string;
  default_settings: GenerationSettings;
  mode_a_carry_over: boolean;
}

// ============================================
// Rule constants
// ============================================

export const RULE_ACTIONS = {
  REMOVE_EYES: "remove_eyes",
  REMOVE_HAIR: "remove_hair",
  DISABLE_EYE_DETAIL: "disable_eye_detail",
  DISABLE_GAZE: "disable_gaze",
  DISABLE_EYE_STATE: "disable_eye_state",
} as const;

export type RuleAction = (typeof RULE_ACTIONS)[keyof typeof RULE_ACTIONS];
