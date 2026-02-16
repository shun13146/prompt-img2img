import { useState, useEffect, useRef } from "react";
import { Copy, Check, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterSelector } from "@/components/prompt/CharacterSelector";
import { TagPicker } from "@/components/tag-picker/TagPicker";
import { PromptPreview } from "@/components/prompt/PromptPreview";
import { FreeTextInput } from "@/components/prompt/FreeTextInput";
import { DenoisingSlider, BatchCountControl } from "@/components/prompt/DenoisingSlider";
import { usePromptAssembly } from "@/hooks/usePromptAssembly";
import { usePromptStore } from "@/stores/promptStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useClipboard } from "@/hooks/useClipboard";
import { FaceVisibilityPanel } from "@/components/prompt/FaceVisibilityPanel";
import { ImageNavigator } from "@/components/prompt/ImageNavigator";
import { api } from "@/lib/api";

export function BuilderPage() {
  const { prompt, disabledCategories } = usePromptAssembly();
  const {
    activeCharacterId,
    activeOutfitId,
    selections,
    freeText,
    faceVisibilityOptions,
    imagePaths,
    currentImageIndex,
    reset,
  } = usePromptStore();
  const characters = useCharacterStore((s) => s.characters);
  const settings = useSettingsStore((s) => s.settings);
  const { copied, copy } = useClipboard();
  const [queued, setQueued] = useState(false);
  const tagPanelRef = useRef<HTMLDivElement>(null);

  const [denoising, setDenoising] = useState(
    settings?.default_settings.denoising_strength ?? 0.55
  );
  const [nIter, setNIter] = useState(
    settings?.default_settings.n_iter ?? 8
  );

  const hasSourceImage = !!(imagePaths[currentImageIndex]);
  const nextImage = usePromptStore((s) => s.nextImage);
  const prevImage = usePromptStore((s) => s.prevImage);

  // Arrow key navigation for images
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" && currentImageIndex < imagePaths.length - 1) {
        e.preventDefault();
        nextImage(true);
      } else if (e.key === "ArrowLeft" && currentImageIndex > 0) {
        e.preventDefault();
        prevImage(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentImageIndex, imagePaths.length, nextImage, prevImage]);

  const handleCopy = () => {
    if (prompt) copy(prompt.full);
  };

  const handleAddToQueue = async () => {
    if (!prompt || !activeCharacterId || !activeOutfitId || !hasSourceImage) return;
    const char = characters.find((c) => c.id === activeCharacterId);
    if (!char) return;

    await api.addToQueue({
      source_image_path: imagePaths[currentImageIndex],
      character_id: activeCharacterId,
      outfit_id: activeOutfitId,
      selections,
      free_text: freeText,
      final_prompt: prompt.full,
      settings: {
        ...char.settings,
        denoising_strength: denoising,
        n_iter: nIter,
      },
    });

    setQueued(true);
    setTimeout(() => setQueued(false), 2000);

    // Auto-advance to next image after queue add
    if (currentImageIndex < imagePaths.length - 1) {
      nextImage(true);
    }

    // Smooth scroll tag panel back to top
    tagPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex h-full">
      {/* Left: Tag Selection + Actions */}
      <div className="w-[420px] border-r flex flex-col">
        {/* Tag selection - scrollable */}
        <div ref={tagPanelRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          <CharacterSelector />

          {activeCharacterId && (
            <>
              <div className="border-t pt-2 pb-1">
                <DenoisingSlider value={denoising} onChange={setDenoising} />
              </div>

              <div className="border-t pt-3">
                <TagPicker disabledCategories={disabledCategories} />
              </div>

              {selections.face_visibility === "hidden" && <FaceVisibilityPanel />}

              <div className="border-t pt-3">
                <FreeTextInput />
              </div>

              <div className="border-t pt-3">
                <BatchCountControl value={nIter} onChange={setNIter} />
              </div>
            </>
          )}
        </div>

        {/* Action bar - fixed bottom */}
        {activeCharacterId && (
          <div className="shrink-0 border-t p-2 flex gap-1 bg-background">
            <Button variant="outline" size="sm" className="h-8" onClick={reset} aria-label="リセット" title="リセット">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              className="h-8 flex-1"
              onClick={handleAddToQueue}
              disabled={!prompt || !hasSourceImage}
            >
              {queued ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {queued ? "追加済み" : hasSourceImage ? "キューに追加" : "画像を選択してください"}
            </Button>
          </div>
        )}
      </div>

      {/* Right: Image + Preview */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-4">
          <ImageNavigator />

          {/* Copy button + Preview header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">プロンプトプレビュー</h2>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={handleCopy}
              disabled={!prompt}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "コピー済み" : "コピー"}
            </Button>
          </div>

          <PromptPreview prompt={prompt} />

          {prompt && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                全文（コピー用）
              </label>
              <textarea
                readOnly
                value={prompt.full}
                className="w-full h-32 p-3 text-xs font-mono border rounded-md bg-muted/30 resize-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
