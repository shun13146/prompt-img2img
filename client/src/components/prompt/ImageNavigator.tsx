import { useState } from "react";
import { ChevronLeft, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePromptStore } from "@/stores/promptStore";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ImageNavigator() {
  const imagePaths = usePromptStore((s) => s.imagePaths);
  const currentImageIndex = usePromptStore((s) => s.currentImageIndex);
  const setImagePaths = usePromptStore((s) => s.setImagePaths);
  const goToImage = usePromptStore((s) => s.goToImage);
  const nextImage = usePromptStore((s) => s.nextImage);
  const prevImage = usePromptStore((s) => s.prevImage);

  const [folder, setFolder] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [carryOver, setCarryOver] = useState(true);

  const handleLoad = async () => {
    if (!folder.trim()) return;
    setLoading(true);
    setError("");
    try {
      const images = await api.listImages(folder.trim());
      if (images.length === 0) {
        setError("画像が見つかりません");
        return;
      }
      setImagePaths(images.map((img) => img.path));
    } catch (err: any) {
      setError(err.message || "フォルダを読み込めません");
    } finally {
      setLoading(false);
    }
  };

  const currentPath = imagePaths[currentImageIndex];
  const total = imagePaths.length;

  return (
    <div className="space-y-2">
      {/* Folder input */}
      <label className="text-xs font-medium text-muted-foreground block">
        画像フォルダ
      </label>
      <div className="flex gap-1">
        <Input
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          placeholder="D:\path\to\images フォルダパスを貼り付け"
          className="text-xs"
          onKeyDown={(e) => e.key === "Enter" && handleLoad()}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoad}
          disabled={loading || !folder.trim()}
          className="shrink-0"
        >
          <FolderOpen className="h-4 w-4 mr-1" />
          {loading ? "読込中..." : "読込"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Image display */}
      {total > 0 && currentPath && (
        <>
          {/* Navigation bar */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => prevImage(carryOver)}
              disabled={currentImageIndex <= 0}
              className="h-7"
            >
              <ChevronLeft className="h-4 w-4" /> 前へ
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {currentImageIndex + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => setCarryOver(!carryOver)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer",
                  carryOver
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border"
                )}
              >
                引き継ぎ {carryOver ? "ON" : "OFF"}
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => nextImage(carryOver)}
              disabled={currentImageIndex >= total - 1}
              className="h-7"
            >
              次へ <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Current image */}
          <div className="border rounded-lg overflow-hidden bg-muted/20">
            <img
              src={api.getImageUrl(currentPath)}
              alt={`Image ${currentImageIndex + 1}`}
              className="w-full max-h-[500px] object-contain"
            />
          </div>

          {/* Thumbnail strip */}
          <div className="flex gap-1 overflow-x-auto py-1">
            {imagePaths.map((path, i) => (
              <button
                key={path}
                type="button"
                onClick={() => goToImage(i)}
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

          {/* Current file name */}
          <p className="text-[10px] text-muted-foreground truncate">
            {currentPath.split(/[/\\]/).pop()}
          </p>
        </>
      )}
    </div>
  );
}
