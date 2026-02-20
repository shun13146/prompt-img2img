import { useState, useMemo, memo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TagChip } from "./TagChip";
import { WeightSlider } from "./WeightSlider";
import { TagSearch } from "./TagSearch";
import { PropsInput } from "@/components/prompt/PropsInput";
import { usePromptStore } from "@/stores/promptStore";
import { useTagStore } from "@/stores/tagStore";
import type { TagCategory, TagSelection, TagEntry } from "@sd-prompt/shared";

interface TagPickerProps {
  disabledCategories: Set<string>;
  suppressedCategories: Set<string>;
}

type TabMode = "favorites" | "all" | "search";

export function TagPicker({ disabledCategories, suppressedCategories }: TagPickerProps) {
  const tagDb = useTagStore((s) => s.tagDb);
  const toggleFavorite = useTagStore((s) => s.toggleFavorite);
  const selections = usePromptStore((s) => s.selections);
  const setSingleSelect = usePromptStore((s) => s.setSingleSelect);
  const addTag = usePromptStore((s) => s.addTag);
  const removeTag = usePromptStore((s) => s.removeTag);
  const setTagWeight = usePromptStore((s) => s.setTagWeight);
  const poseFreeText = usePromptStore((s) => s.poseFreeText);
  const setPoseFreeText = usePromptStore((s) => s.setPoseFreeText);
  const [tab, setTab] = useState<TabMode>("favorites");
  const [expandedSecondary, setExpandedSecondary] = useState<Set<string>>(new Set());

  const primaryCategories = useMemo(() => tagDb.categories.filter((c) => c.zone === "primary"), [tagDb]);
  const eyeDetailCategory = useMemo(() => tagDb.categories.find((c) => c.id === "eye_detail"), [tagDb]);
  const secondaryCategories = useMemo(() => tagDb.categories.filter(
    (c) => c.zone === "secondary" && !c.id.startsWith("pose_") && c.id !== "eye_detail"
  ), [tagDb]);
  const poseCategories = useMemo(() => tagDb.categories.filter((c) => c.id.startsWith("pose_")), [tagDb]);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedSecondary);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSecondary(next);
  };

  const handleSelectTag = (categoryId: string, tag: TagEntry) => {
    const cat = tagDb.categories.find((c) => c.id === categoryId);
    if (!cat || cat.type !== "multi") return;
    const sel: TagSelection = {
      tag_id: tag.id,
      prompt: tag.prompt,
      weight: 1.0,
    };
    addTag(categoryId, sel);
  };

  // Collect favorite pose tags from all pose categories (flat)
  const favoritePoseTags = useMemo(() => {
    const result: { tag: TagEntry; categoryId: string }[] = [];
    for (const cat of poseCategories) {
      if (!cat.subcategories) continue;
      for (const sub of cat.subcategories) {
        for (const tag of sub.tags) {
          if (tag.favorite) result.push({ tag, categoryId: cat.id });
        }
      }
    }
    return result;
  }, [poseCategories]);

  // Collect ALL pose tags from all pose categories (flat, for "all" tab)
  const allPoseTags = useMemo(() => {
    const result: { tag: TagEntry; categoryId: string }[] = [];
    for (const cat of poseCategories) {
      if (!cat.subcategories) continue;
      for (const sub of cat.subcategories) {
        for (const tag of sub.tags) {
          result.push({ tag, categoryId: cat.id });
        }
      }
    }
    return result;
  }, [poseCategories]);

  // Get selected pose tag IDs across all pose categories
  const selectedPoseTagIds = useMemo(() => {
    const ids = new Set<string>();
    for (const cat of poseCategories) {
      const tags = selections[cat.id];
      if (Array.isArray(tags)) {
        for (const t of tags as TagSelection[]) {
          ids.add(t.tag_id);
        }
      }
    }
    return ids;
  }, [selections, poseCategories]);

  // Get all selected pose TagSelections with their category
  const selectedPoseTags = useMemo(() => {
    const result: { sel: TagSelection; categoryId: string }[] = [];
    for (const cat of poseCategories) {
      const tags = selections[cat.id];
      if (Array.isArray(tags)) {
        for (const t of tags as TagSelection[]) {
          result.push({ sel: t, categoryId: cat.id });
        }
      }
    }
    return result;
  }, [selections, poseCategories]);

  const handlePoseClick = (tag: TagEntry, categoryId: string) => {
    if (selectedPoseTagIds.has(tag.id)) {
      removeTag(categoryId, tag.id);
    } else {
      addTag(categoryId, { tag_id: tag.id, prompt: tag.prompt, weight: 1.0 });
    }
  };

  // Determine which pose tags to show based on tab
  const visiblePoseTags = tab === "favorites"
    ? favoritePoseTags.filter(({ tag }) => tag.favorite || selectedPoseTagIds.has(tag.id))
    : allPoseTags;

  return (
    <div className="space-y-3">
      {/* Tab Switcher */}
      <div className="flex gap-1 border-b pb-2">
        {(
          [
            ["favorites", "\u2605 よく使う"],
            ["all", "すべて"],
            ["search", "検索"],
          ] as [TabMode, string][]
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setTab(mode)}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors cursor-pointer",
              tab === mode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <TagSearch
          categories={tagDb.categories.filter((c) => c.type === "multi")}
          onSelectTag={handleSelectTag}
        />
      )}

      {/* Primary categories (always visible), with eye_detail after eye_state, PropsInput before background */}
      {primaryCategories.map((cat) => (
        <div key={cat.id}>
          {cat.id === "background" && <PropsInput />}
          <CategoryPanel
            category={cat}
            categoryId={cat.id}
            disabled={disabledCategories.has(cat.id)}
            suppressed={suppressedCategories.has(cat.id)}
            selectedValue={selections[cat.id]}
            showOnlyFavorites={tab === "favorites"}
            setSingleSelect={setSingleSelect}
            addTag={addTag}
            removeTag={removeTag}
            setTagWeight={setTagWeight}
            toggleFavorite={toggleFavorite}
          />
          {/* eye_detail (目元) directly after eye_state (目の状態) */}
          {cat.id === "eye_state" && eyeDetailCategory && (
            <CategoryPanel
              category={eyeDetailCategory}
              categoryId="eye_detail"
              disabled={disabledCategories.has("eye_detail")}
              suppressed={suppressedCategories.has("eye_detail")}
              selectedValue={selections["eye_detail"]}
              showOnlyFavorites={tab === "favorites"}
              setSingleSelect={setSingleSelect}
              addTag={addTag}
              removeTag={removeTag}
              setTagWeight={setTagWeight}
              toggleFavorite={toggleFavorite}
              compact
            />
          )}
        </div>
      ))}

      {/* Poses section */}
      {tab !== "search" && (
        <div className="border-t pt-2 mt-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            ポーズ {tab === "favorites" ? "(よく使う)" : "(すべて)"}
          </label>

          {tab === "favorites" ? (
            /* Favorites: flat display */
            <div className="flex flex-wrap gap-1 mb-1">
              {visiblePoseTags.map(({ tag, categoryId }) => (
                <TagChip
                  key={tag.id}
                  label={tag.label}
                  selected={selectedPoseTagIds.has(tag.id)}
                  disabled={false}
                  favorite={tag.favorite}
                  weight={
                    selectedPoseTags.find((s) => s.sel.tag_id === tag.id)?.sel.weight
                  }
                  onClick={() => handlePoseClick(tag, categoryId)}
                  onRemove={
                    selectedPoseTagIds.has(tag.id)
                      ? () => removeTag(categoryId, tag.id)
                      : undefined
                  }
                  onToggleFavorite={() => toggleFavorite(categoryId, tag.id, !tag.favorite)}
                />
              ))}
              {visiblePoseTags.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  お気に入りポーズなし（「すべて」タブで表示）
                </span>
              )}
            </div>
          ) : (
            /* All: grouped by pose category */
            <div className="space-y-2">
              {poseCategories.map((cat) => {
                if (!cat.subcategories) return null;
                const catTags = cat.subcategories.flatMap((s) => s.tags);
                if (catTags.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <div className="text-[10px] text-muted-foreground font-medium mb-0.5">
                      {cat.label}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {catTags.map((tag) => (
                        <TagChip
                          key={tag.id}
                          label={tag.label}
                          selected={selectedPoseTagIds.has(tag.id)}
                          disabled={false}
                          favorite={tag.favorite}
                          weight={
                            selectedPoseTags.find((s) => s.sel.tag_id === tag.id)?.sel.weight
                          }
                          onClick={() => handlePoseClick(tag, cat.id)}
                          onRemove={
                            selectedPoseTagIds.has(tag.id)
                              ? () => removeTag(cat.id, tag.id)
                              : undefined
                          }
                          onToggleFavorite={() => toggleFavorite(cat.id, tag.id, !tag.favorite)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pose free text input */}
          <div className="mt-2">
            <input
              type="text"
              value={poseFreeText}
              onChange={(e) => setPoseFreeText(e.target.value)}
              placeholder="ポーズ自由入力（例: dynamic pose）"
              className="w-full px-2 py-1 text-xs border rounded-md bg-background"
            />
          </div>

          {/* Weight sliders for selected pose tags */}
          {selectedPoseTags.length > 0 && (
            <div className="border-t pt-1 mt-1">
              {selectedPoseTags.map(({ sel, categoryId }) => {
                const tagEntry = poseCategories
                  .flatMap((c) => c.subcategories || [])
                  .flatMap((s) => s.tags)
                  .find((t) => t.id === sel.tag_id);
                return (
                  <WeightSlider
                    key={sel.tag_id}
                    tagLabel={tagEntry?.label || sel.prompt}
                    weight={sel.weight}
                    onChange={(w) => setTagWeight(categoryId, sel.tag_id, w)}
                    onRemove={() => removeTag(categoryId, sel.tag_id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Secondary categories (collapsible, excluding poses) */}
      {secondaryCategories.length > 0 && (
        <div className="border-t pt-2 mt-2">
          <p className="text-xs text-muted-foreground mb-2">その他</p>
          {secondaryCategories.map((cat) => {
            const isExpanded = expandedSecondary.has(cat.id);
            const selectedTags = Array.isArray(selections[cat.id])
              ? (selections[cat.id] as TagSelection[])
              : [];
            const hasSelections = selectedTags.length > 0;

            return (
              <div key={cat.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleExpand(cat.id)}
                  className={cn(
                    "flex items-center gap-1 w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-accent transition-colors cursor-pointer",
                    disabledCategories.has(cat.id) && "opacity-40"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span className="font-medium">{cat.label}</span>
                  {hasSelections && (
                    <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 text-[10px]">
                      {selectedTags.length}
                    </span>
                  )}
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-1">
                    <CategoryPanel
                      category={cat}
                      categoryId={cat.id}
                      disabled={disabledCategories.has(cat.id)}
                      suppressed={suppressedCategories.has(cat.id)}
                      selectedValue={selections[cat.id]}
                      showOnlyFavorites={tab === "favorites"}
                      setSingleSelect={setSingleSelect}
                      addTag={addTag}
                      removeTag={removeTag}
                      setTagWeight={setTagWeight}
                      toggleFavorite={toggleFavorite}
                      compact
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// CategoryPanel: renders one category
// ============================================

interface CategoryPanelProps {
  category: TagCategory;
  categoryId: string;
  disabled: boolean;
  suppressed: boolean;
  selectedValue: string | null | TagSelection[];
  showOnlyFavorites: boolean;
  setSingleSelect: (categoryId: string, optionId: string | null) => void;
  addTag: (categoryId: string, tag: TagSelection) => void;
  removeTag: (categoryId: string, tagId: string) => void;
  setTagWeight: (categoryId: string, tagId: string, weight: number) => void;
  toggleFavorite: (categoryId: string, tagId: string, favorite: boolean) => void;
  compact?: boolean;
}

const CategoryPanel = memo(function CategoryPanel({
  category,
  categoryId,
  disabled,
  suppressed,
  selectedValue,
  showOnlyFavorites,
  setSingleSelect,
  addTag,
  removeTag,
  setTagWeight,
  toggleFavorite,
  compact,
}: CategoryPanelProps) {
  if (category.type === "single") {
    return (
      <SingleSelectPanel
        category={category}
        disabled={disabled}
        suppressed={suppressed}
        selectedId={selectedValue as string | null}
        onSelect={(optId) => setSingleSelect(categoryId, optId)}
      />
    );
  }

  // Multi-select
  const selectedTags: TagSelection[] = Array.isArray(selectedValue)
    ? selectedValue
    : [];

  return (
    <MultiSelectPanel
      category={category}
      disabled={disabled}
      suppressed={suppressed}
      selectedTags={selectedTags}
      showOnlyFavorites={showOnlyFavorites}
      onAddTag={(sel) => addTag(categoryId, sel)}
      onRemoveTag={(tagId) => removeTag(categoryId, tagId)}
      onSetWeight={(tagId, w) => setTagWeight(categoryId, tagId, w)}
      onToggleFavorite={(tagId, fav) => toggleFavorite(categoryId, tagId, fav)}
      compact={compact}
    />
  );
});

// ============================================
// SingleSelectPanel
// ============================================

function SingleSelectPanel({
  category,
  disabled,
  suppressed,
  selectedId,
  onSelect,
}: {
  category: TagCategory;
  disabled: boolean;
  suppressed: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (!category.options) return null;

  return (
    <div className={cn(
      disabled && "opacity-40 pointer-events-none",
      suppressed && !disabled && "bg-amber-500/10 rounded-md p-1.5 border border-amber-500/30"
    )}>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        {category.label}
        {suppressed && !disabled && <span className="ml-1 text-amber-600 text-[10px]">(非適用)</span>}
      </label>
      <div className="flex flex-wrap gap-1">
        {category.options.map((opt) => (
          <TagChip
            key={opt.id}
            label={opt.label}
            selected={selectedId === opt.id}
            disabled={disabled}
            onClick={() => onSelect(selectedId === opt.id ? null : opt.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// MultiSelectPanel
// ============================================

function MultiSelectPanel({
  category,
  disabled,
  suppressed,
  selectedTags,
  showOnlyFavorites,
  onAddTag,
  onRemoveTag,
  onSetWeight,
  onToggleFavorite,
  compact,
}: {
  category: TagCategory;
  disabled: boolean;
  suppressed: boolean;
  selectedTags: TagSelection[];
  showOnlyFavorites: boolean;
  onAddTag: (tag: TagSelection) => void;
  onRemoveTag: (tagId: string) => void;
  onSetWeight: (tagId: string, weight: number) => void;
  onToggleFavorite: (tagId: string, favorite: boolean) => void;
  compact?: boolean;
}) {
  if (!category.subcategories) return null;

  const selectedIds = new Set(selectedTags.map((t) => t.tag_id));

  const handleClick = (tag: TagEntry) => {
    if (selectedIds.has(tag.id)) {
      onRemoveTag(tag.id);
    } else {
      onAddTag({ tag_id: tag.id, prompt: tag.prompt, weight: 1.0 });
    }
  };

  // Collect all tags based on filter
  const allTags: { tag: TagEntry; subName: string }[] = [];
  for (const sub of category.subcategories) {
    for (const tag of sub.tags) {
      if (showOnlyFavorites && !tag.favorite && !selectedIds.has(tag.id)) continue;
      allTags.push({ tag, subName: sub.name });
    }
  }

  // Group tags by subcategory for "all" display
  const groupedBySub = !showOnlyFavorites && category.subcategories.length > 1;

  return (
    <div className={cn(
      disabled && "opacity-40 pointer-events-none",
      suppressed && !disabled && "bg-amber-500/10 rounded-md p-1.5 border border-amber-500/30"
    )}>
      {!compact && (
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          {category.label}
          {suppressed && !disabled && <span className="ml-1 text-amber-600 text-[10px]">(非適用)</span>}
        </label>
      )}

      {/* Tag grid - grouped by subcategory in "all" mode */}
      {groupedBySub ? (
        <div className="space-y-1.5 mb-1">
          {category.subcategories.map((sub) => {
            const subTags = sub.tags;
            if (subTags.length === 0) return null;
            return (
              <div key={sub.name}>
                <div className="text-[10px] text-muted-foreground font-medium mb-0.5">
                  {sub.name}
                </div>
                <div className="flex flex-wrap gap-1">
                  {subTags.map((tag) => (
                    <TagChip
                      key={tag.id}
                      label={tag.label}
                      selected={selectedIds.has(tag.id)}
                      disabled={disabled}
                      favorite={tag.favorite}
                      weight={selectedTags.find((s) => s.tag_id === tag.id)?.weight}
                      onClick={() => handleClick(tag)}
                      onRemove={selectedIds.has(tag.id) ? () => onRemoveTag(tag.id) : undefined}
                      onToggleFavorite={() => onToggleFavorite(tag.id, !tag.favorite)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1 mb-1">
          {allTags.map(({ tag }) => (
            <TagChip
              key={tag.id}
              label={tag.label}
              selected={selectedIds.has(tag.id)}
              disabled={disabled}
              favorite={tag.favorite}
              weight={selectedTags.find((s) => s.tag_id === tag.id)?.weight}
              onClick={() => handleClick(tag)}
              onRemove={selectedIds.has(tag.id) ? () => onRemoveTag(tag.id) : undefined}
              onToggleFavorite={() => onToggleFavorite(tag.id, !tag.favorite)}
            />
          ))}
          {allTags.length === 0 && (
            <span className="text-xs text-muted-foreground">
              お気に入りタグなし（「すべて」タブで表示）
            </span>
          )}
        </div>
      )}

      {/* Weight sliders for selected tags (hide if suppressed) */}
      {selectedTags.length > 0 && !suppressed && (
        <div className="border-t pt-1 mt-1">
          {selectedTags.map((sel) => {
            const tagEntry = category.subcategories!
              .flatMap((s) => s.tags)
              .find((t) => t.id === sel.tag_id);
            return (
              <WeightSlider
                key={sel.tag_id}
                tagLabel={tagEntry?.label || sel.prompt}
                weight={sel.weight}
                onChange={(w) => onSetWeight(sel.tag_id, w)}
                onRemove={() => onRemoveTag(sel.tag_id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
