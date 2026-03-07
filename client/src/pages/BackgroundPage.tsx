import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, FolderOpen, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { createEmptySelections } from "@sd-prompt/shared";

const LOCATION_OPTIONS = [
  { id: "school", label: "学校", prompt: "school" },
  { id: "classroom", label: "教室", prompt: "classroom" },
  { id: "hallway", label: "廊下", prompt: "hallway" },
  { id: "indoor", label: "屋内", prompt: "indoors" },
  { id: "outdoor", label: "屋外", prompt: "outdoors" },
  { id: "church", label: "教会", prompt: "church" },
  { id: "park", label: "公園", prompt: "park" },
  { id: "street", label: "街並み", prompt: "street, cityscape" },
  { id: "forest", label: "森", prompt: "forest" },
  { id: "beach", label: "浜辺", prompt: "beach, ocean" },
  { id: "cafe", label: "カフェ", prompt: "cafe interior" },
  { id: "library", label: "図書館", prompt: "library" },
  { id: "rooftop", label: "屋上", prompt: "rooftop" },
  { id: "shrine", label: "神社", prompt: "shrine, torii" },
  { id: "night_city", label: "夜の街", prompt: "night, city lights, urban" },
  { id: "sunset", label: "夕景", prompt: "sunset, golden hour" },
  { id: "room", label: "部屋", prompt: "room, interior" },
  { id: "kitchen", label: "キッチン", prompt: "kitchen" },
  { id: "bathroom", label: "浴室", prompt: "bathroom" },
  { id: "bedroom", label: "寝室", prompt: "bedroom" },
];

export function BackgroundPage() {
  const settings = useSettingsStore((s) => s.settings);

  // Image navigator state (local, not shared with BuilderPage)
  const [folder, setFolder] = useState("");
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loadingImages, setLoadingImages] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Selection state
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [propsText, setPropsText] = useState("");
  const [freeText, setFreeText] = useState("");
  const [nIter, setNIter] = useState(1);

  // UI state
  const [added, setAdded] = useState(false);

  const handleLoadImages = async () => {
    if (!folder.trim()) return;
    setLoadingImages(true);
    setLoadError("");
    try {
      const images = await api.listImages(folder.trim());
      if (images.length === 0) {
        setLoadError("画像が見つかりません");
        return;
      }
      setImagePaths(images.map((img) => img.path));
      setCurrentImageIndex(0);
    } catch (err: any) {
      setLoadError(err.message || "フォルダを読み込めません");
    } finally {
      setLoadingImages(false);
    }
  };

  const toggleLocation = (id: string) => {
    setSelectedLocations((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  const qualityPrompt = settings?.background_quality_prompt ||
    "score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up, masterpiece,best quality,amazing quality,, Smooth Quality, high contrast, intricate details, kudo, Ultra high quality,";

  const prompt = useMemo(() => {
    const parts: string[] = [];
    const locationPrompts = selectedLocations
      .map((id) => LOCATION_OPTIONS.find((o) => o.id === id)?.prompt)
      .filter(Boolean) as string[];
    if (locationPrompts.length > 0) parts.push(locationPrompts.join(", "));
    if (propsText.trim()) parts.push(propsText.trim());
    if (freeText.trim()) parts.push(freeText.trim());

    const block3 = parts.join(", ");
    return `${qualityPrompt}\nBREAK\nno humans, scenery,\nBREAK\n${block3}`;
  }, [qualityPrompt, selectedLocations, propsText, freeText]);

  const currentPath = imagePaths[currentImageIndex];
  const total = imagePaths.length;

  const handleAddToQueue = useCallback(async () => {
    if (!currentPath) return;
    await api.addToQueue({
      type: "background",
      source_image_path: currentPath,
      character_id: "",
      outfit_id: "",
      selections: createEmptySelections(),
      free_text: freeText,
      final_prompt: prompt,
      settings: {
        steps: 35,
        sampler: "Euler a",
        cfg_scale: 7,
        width: 512,
        height: 768,
        denoising_strength: 0.55,
        n_iter: nIter,
      },
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);

    // Auto-advance to next image
    if (currentImageIndex < total - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  }, [currentPath, prompt, freeText, nIter, currentImageIndex, total]);

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-[420px] border-r flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <h2 className="text-lg font-bold">背景生成</h2>

          {/* Location selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground block">
              場所
            </label>
            <div className="flex flex-wrap gap-1.5">
              {LOCATION_OPTIONS.map((loc) => {
                const isActive = selectedLocations.includes(loc.id);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => toggleLocation(loc.id)}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md border transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {loc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Props input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground block">
              小物・追加要素
            </label>
            <Input
              value={propsText}
              onChange={(e) => setPropsText(e.target.value)}
              placeholder="desk, chair, window..."
              className="text-xs"
            />
          </div>

          {/* Free text */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground block">
              自由テキスト
            </label>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="追加のプロンプト..."
              className="w-full text-xs font-mono border rounded-md p-2 bg-background resize-y min-h-[60px]"
              rows={3}
            />
          </div>

          {/* Batch count */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground block">
              生成枚数
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 4, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNIter(n)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-md border transition-colors",
                    nIter === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {n}枚
                </button>
              ))}
            </div>
          </div>

          {/* Settings summary */}
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            <div>Denoising: 0.55 (固定) / Steps: 35 / CFG: 7</div>
            <div>ADetailer: なし</div>
          </div>
        </div>

        {/* Action bar */}
        <div className="shrink-0 border-t p-2 flex justify-end">
          <Button
            onClick={handleAddToQueue}
            disabled={!currentPath}
            className="h-9"
          >
            {added ? (
              <>
                <Check className="h-4 w-4 mr-1" /> 追加済み
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" /> キューに追加
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Image navigator (inline, not using promptStore) */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground block">
            画像フォルダ
          </label>
          <div className="flex gap-1">
            <Input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="D:\path\to\images フォルダパスを貼り付け"
              className="text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleLoadImages()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadImages}
              disabled={loadingImages || !folder.trim()}
              className="shrink-0"
            >
              <FolderOpen className="h-4 w-4 mr-1" />
              {loadingImages ? "読込中..." : "読込"}
            </Button>
          </div>
          {loadError && <p className="text-xs text-destructive">{loadError}</p>}

          {total > 0 && currentPath && (
            <>
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                  disabled={currentImageIndex <= 0}
                  className="h-7"
                >
                  <ChevronLeft className="h-4 w-4" /> 前へ
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentImageIndex + 1} / {total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentImageIndex(Math.min(total - 1, currentImageIndex + 1))}
                  disabled={currentImageIndex >= total - 1}
                  className="h-7"
                >
                  次へ <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden bg-muted/20">
                <img
                  src={api.getImageUrl(currentPath)}
                  alt={`Image ${currentImageIndex + 1}`}
                  className="w-full max-h-[500px] object-contain"
                />
              </div>

              <div className="flex gap-1 overflow-x-auto py-1">
                {imagePaths.map((path, i) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => setCurrentImageIndex(i)}
                    className={cn(
                      "shrink-0 w-12 h-12 rounded border overflow-hidden cursor-pointer transition-all",
                      i === currentImageIndex
                        ? "border-primary ring-1 ring-primary"
                        : "border-border opacity-60 hover:opacity-100"
                    )}
                  >
                    <img
                      src={api.getImageUrl(path)}
                      alt={`Thumb ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground truncate">
                {currentPath.split(/[/\\]/).pop()}
              </p>
            </>
          )}
        </div>

        {/* Prompt preview */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground block">
            プロンプトプレビュー
          </label>
          <div className="text-xs font-mono bg-muted/30 rounded p-3 whitespace-pre-wrap break-all">
            {prompt}
          </div>
        </div>
      </div>
    </div>
  );
}
