import { useState, useEffect, useCallback, useRef } from "react";
import {
  Trash2,
  Copy,
  Check,
  X,
  Pencil,
  Save,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Image as ImageIcon,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useCharacterStore } from "@/stores/characterStore";
import { useClipboard } from "@/hooks/useClipboard";
import { cn } from "@/lib/utils";
import type { QueueItem, QueueStatusInfo, QueueEvent, QueueRunnerStatus } from "@sd-prompt/shared";

type TabType = "pending" | "history";
type SortMode = "generated_desc" | "created_asc" | "created_desc";

export function QueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runnerStatus, setRunnerStatus] = useState<QueueRunnerStatus>("idle");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: number; total: number } | null>(null);
  const [forgeConnected, setForgeConnected] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabType>("pending");
  const [historySort, setHistorySort] = useState<SortMode>("generated_desc");
  const characters = useCharacterStore((s) => s.characters);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const [data, status] = await Promise.all([
        api.getQueue(),
        api.getQueueStatus(),
      ]);
      setQueue(data);
      setRunnerStatus(status.runner);
      setCurrentTaskId(status.current_task_id);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check Forge connection periodically
  useEffect(() => {
    const check = () => api.getForgeStatus().then((s) => setForgeConnected(s.connected)).catch(() => setForgeConnected(false));
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch queue on mount
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // SSE for real-time updates
  useEffect(() => {
    const es = api.createQueueEventSource();
    eventSourceRef.current = es;

    es.onerror = () => {
      // EventSource will auto-reconnect; no action needed
    };

    es.onmessage = (event) => {
      let evt: QueueEvent;
      try {
        evt = JSON.parse(event.data);
      } catch {
        return; // Skip malformed messages
      }

      switch (evt.type) {
        case "status":
          setRunnerStatus(evt.data.runner);
          setCurrentTaskId(evt.data.current_task_id);
          break;
        case "task_start":
          setQueue((q) =>
            q.map((item) =>
              item.id === evt.data.id ? { ...item, status: "running" as const } : item
            )
          );
          setProgress(null);
          break;
        case "task_done":
          setQueue((q) =>
            q.map((item) =>
              item.id === evt.data.id
                ? { ...item, status: "done" as const, result_images: evt.data.result_images }
                : item
            )
          );
          setProgress(null);
          break;
        case "task_failed":
          setQueue((q) =>
            q.map((item) =>
              item.id === evt.data.id
                ? { ...item, status: "failed" as const, error_message: evt.data.error }
                : item
            )
          );
          setProgress(null);
          break;
        case "progress":
          setProgress({ step: evt.data.step, total: evt.data.total });
          break;
      }
    };

    return () => es.close();
  }, []);

  const handleDelete = async (id: string) => {
    await api.deleteQueueItem(id);
    setQueue((q) => q.filter((item) => item.id !== id));
  };

  const handleUpdate = async (id: string, newPrompt: string) => {
    const updated = await api.updateQueueItem(id, { final_prompt: newPrompt });
    setQueue((q) => q.map((item) => (item.id === id ? updated : item)));
  };

  const handleClearPending = async () => {
    await api.clearQueue();
    setQueue((q) => q.filter((item) => item.status !== "pending"));
  };

  const handleClearHistory = async () => {
    await api.clearHistory();
    setQueue((q) => q.filter((item) => item.status !== "done" && item.status !== "failed"));
  };

  const handleStart = async () => {
    await api.startQueue();
  };

  const handlePause = async () => {
    await api.pauseQueue();
  };

  const handleResume = async () => {
    await api.resumeQueue();
  };

  const handleRunSingle = async (id: string) => {
    await api.runQueueItem(id);
  };

  const handleRequeue = async (id: string) => {
    await api.requeueItem(id);
    fetchQueue();
  };

  const handleMove = async (id: string, direction: "up" | "down") => {
    const newQueue = await api.moveQueueItem(id, direction);
    setQueue(newQueue);
  };

  const pendingItems = queue.filter((q) => q.status === "pending" || q.status === "running");
  const historyItems = (() => {
    const items = queue.filter((q) => q.status === "done" || q.status === "failed");
    const sorted = [...items];
    switch (historySort) {
      case "generated_desc":
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case "created_asc":
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "created_desc":
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return sorted;
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="shrink-0 border-b p-3 space-y-2">
        {/* Forge connection + runner status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">キュー管理</h2>
            <ForgeStatusBadge connected={forgeConnected} />
            <RunnerStatusBadge status={runnerStatus} />
          </div>
          <div className="flex items-center gap-1">
            {runnerStatus === "idle" && pendingItems.length > 0 && (
              <Button size="sm" className="h-8" onClick={handleStart}>
                <Play className="h-3.5 w-3.5" /> 実行開始
              </Button>
            )}
            {runnerStatus === "running" && (
              <Button variant="outline" size="sm" className="h-8" onClick={handlePause}>
                <Pause className="h-3.5 w-3.5" /> 一時停止
              </Button>
            )}
            {runnerStatus === "paused" && (
              <Button size="sm" className="h-8" onClick={handleResume}>
                <Play className="h-3.5 w-3.5" /> 再開
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {currentTaskId && progress && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: `${(progress.step / progress.total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {progress.step}/{progress.total}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn(
              "px-3 py-1 text-sm rounded-md transition-colors",
              tab === "pending"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setTab("pending")}
          >
            待機中 ({pendingItems.length})
          </button>
          <button
            type="button"
            className={cn(
              "px-3 py-1 text-sm rounded-md transition-colors",
              tab === "history"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setTab("history")}
          >
            履歴 ({historyItems.length})
          </button>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            title="更新"
            onClick={() => fetchQueue()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          <div className="flex-1" />

          {/* History sort */}
          {tab === "history" && historyItems.length > 1 && (
            <div className="flex items-center gap-0.5">
              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
              {(
                [
                  ["generated_desc", "生成順"],
                  ["created_desc", "登録順(新)"],
                  ["created_asc", "登録順(古)"],
                ] as [SortMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setHistorySort(mode)}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] rounded border transition-colors",
                    historySort === mode
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {tab === "pending" && pendingItems.length > 0 && (
            <Button variant="outline" size="sm" className="h-7" onClick={handleClearPending}>
              <Trash2 className="h-3.5 w-3.5" /> 全削除
            </Button>
          )}
          {tab === "history" && historyItems.length > 0 && (
            <Button variant="outline" size="sm" className="h-7" onClick={handleClearHistory}>
              <Trash2 className="h-3.5 w-3.5" /> 全削除
            </Button>
          )}
        </div>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        )}

        {!loading && tab === "pending" && pendingItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            待機中のタスクがありません。ビルダーページから追加してください。
          </p>
        )}

        {!loading && tab === "history" && historyItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            実行履歴がありません。
          </p>
        )}

        <div className="space-y-2">
          {(tab === "pending" ? pendingItems : historyItems).map((item, idx, arr) => (
            <QueueCard
              key={item.id}
              item={item}
              characterName={
                characters.find((c) => c.id === item.character_id)?.name ||
                item.character_id
              }
              outfitName={
                characters
                  .find((c) => c.id === item.character_id)
                  ?.outfits.find((o) => o.id === item.outfit_id)?.name ||
                item.outfit_id
              }
              isRunning={item.id === currentTaskId}
              progress={item.id === currentTaskId ? progress : null}
              onDelete={() => handleDelete(item.id)}
              onUpdate={(newPrompt) => handleUpdate(item.id, newPrompt)}
              onRunSingle={() => handleRunSingle(item.id)}
              onRequeue={() => handleRequeue(item.id)}
              onMoveUp={item.status === "pending" && idx > 0 ? () => handleMove(item.id, "up") : undefined}
              onMoveDown={item.status === "pending" && idx < arr.length - 1 ? () => handleMove(item.id, "down") : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== Sub-components =====

function ForgeStatusBadge({ connected }: { connected: boolean | null }) {
  if (connected === null) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        Forge: 確認中...
      </span>
    );
  }
  return connected ? (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
      Forge: 接続済み
    </span>
  ) : (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
      Forge: 未接続
    </span>
  );
}

function RunnerStatusBadge({ status }: { status: QueueRunnerStatus }) {
  const config: Record<QueueRunnerStatus, { label: string; color: string; icon: React.ReactNode }> = {
    idle: { label: "待機", color: "bg-muted text-muted-foreground", icon: <Clock className="h-3 w-3" /> },
    running: { label: "実行中", color: "bg-primary/15 text-primary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    paused: { label: "一時停止", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400", icon: <Pause className="h-3 w-3" /> },
  };
  const c = config[status];
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1", c.color)}>
      {c.icon} {c.label}
    </span>
  );
}

function QueueCard({
  item,
  characterName,
  outfitName,
  isRunning,
  progress,
  onDelete,
  onUpdate,
  onRunSingle,
  onRequeue,
  onMoveUp,
  onMoveDown,
}: {
  item: QueueItem;
  characterName: string;
  outfitName: string;
  isRunning: boolean;
  progress: { step: number; total: number } | null;
  onDelete: () => void;
  onUpdate: (newPrompt: string) => void;
  onRunSingle: () => void;
  onRequeue: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { copied, copy } = useClipboard();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.final_prompt);
  const [showResult, setShowResult] = useState(item.status === "done");
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: {
      label: "待機中",
      color: "bg-muted text-muted-foreground",
      icon: <Clock className="h-3 w-3" />,
    },
    running: {
      label: "実行中",
      color: "bg-primary/15 text-primary",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    done: {
      label: `完了 (${item.result_images.length}枚)`,
      color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    failed: {
      label: "エラー",
      color: "bg-destructive/15 text-destructive",
      icon: <AlertCircle className="h-3 w-3" />,
    },
  };

  const sc = statusConfig[item.status] || statusConfig.pending;

  const handleSave = () => {
    onUpdate(editText);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditText(item.final_prompt);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "border rounded-lg p-3 space-y-2 transition-colors",
        isRunning && "border-primary/40 bg-primary/5"
      )}
    >
      {/* Header row with source thumbnail */}
      <div className="flex gap-3">
        {/* Source image thumbnail */}
        {item.source_image_path && (
          <img
            src={api.getImageUrl(item.source_image_path)}
            alt="Source"
            className="w-12 h-16 rounded border object-cover shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{characterName}</span>
          <span className="text-xs text-muted-foreground">/ {outfitName}</span>
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5",
              sc.color
            )}
          >
            {sc.icon} {sc.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Move up/down (pending only) */}
          {onMoveUp && (
            <Button variant="ghost" size="sm" className="h-7 px-1" title="上へ" onClick={onMoveUp}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
          )}
          {onMoveDown && (
            <Button variant="ghost" size="sm" className="h-7 px-1" title="下へ" onClick={onMoveDown}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Run single (pending only) */}
          {item.status === "pending" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              title="この1件だけ実行"
              onClick={onRunSingle}
            >
              <Zap className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Requeue (done/failed) */}
          {(item.status === "done" || item.status === "failed") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              title="再実行"
              onClick={onRequeue}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Edit (pending only) */}
          {!editing && item.status === "pending" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              title="プロンプト編集"
              aria-label="プロンプト編集"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Copy */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            title="コピー"
            aria-label="プロンプトをコピー"
            onClick={() => copy(editing ? editText : item.final_prompt)}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          {/* Toggle results (done) */}
          {item.status === "done" && item.result_images.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              title="結果画像を表示"
              aria-label="結果画像を表示"
              onClick={() => setShowResult(!showResult)}
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Delete */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive hover:text-destructive"
            title="削除"
            aria-label="削除"
            onClick={onDelete}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Settings */}
      <div className="flex gap-3 text-[11px] text-muted-foreground flex-wrap">
        <span>Steps: {item.settings.steps}</span>
        <span>CFG: {item.settings.cfg_scale}</span>
        <span>Denoising: {item.settings.denoising_strength}</span>
        <span>枚数: {item.settings.n_iter || 1}</span>
        <span>Sampler: {item.settings.sampler}</span>
      </div>
      {/* Close the content wrapper */}
      </div>
      {/* Close the flex row with thumbnail */}
      </div>

      {/* Progress bar (when running) */}
      {isRunning && progress && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${(progress.step / progress.total) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">
            {progress.step}/{progress.total}
          </span>
        </div>
      )}

      {/* Error message */}
      {item.status === "failed" && item.error_message && (
        <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
          {item.error_message}
        </div>
      )}

      {/* Agent-scheduler style result gallery */}
      {showResult && item.result_images.length > 0 && (
        <ResultGallery
          images={item.result_images}
          selectedIdx={selectedImageIdx}
          onSelect={setSelectedImageIdx}
        />
      )}

      {/* Prompt: editable or read-only */}
      {editing ? (
        <div className="space-y-1">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full text-xs font-mono border rounded p-2 bg-background resize-y min-h-[80px]"
            rows={6}
            autoFocus
          />
          <div className="flex gap-1 justify-end">
            <Button variant="outline" size="sm" className="h-7" onClick={handleCancel}>
              キャンセル
            </Button>
            <Button size="sm" className="h-7" onClick={handleSave}>
              <Save className="h-3.5 w-3.5 mr-1" /> 保存
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={item.status === "pending" ? () => setEditing(true) : undefined}
          className={cn(
            "w-full text-left",
            item.status === "pending" && "cursor-pointer"
          )}
        >
          <div className="text-xs font-mono bg-muted/30 rounded p-2 break-all whitespace-pre-wrap line-clamp-3">
            {item.final_prompt}
          </div>
        </button>
      )}

      {/* Timestamp */}
      <div className="text-[10px] text-muted-foreground text-right">
        {new Date(item.created_at).toLocaleString("ja-JP")}
      </div>
    </div>
  );
}

/** Agent-scheduler style result gallery: large preview + thumbnail strip + lightbox */
function ResultGallery({
  images,
  selectedIdx,
  onSelect,
}: {
  images: string[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}) {
  const safeIdx = Math.min(selectedIdx, images.length - 1);
  const selectedPath = images[safeIdx];
  const [lightbox, setLightbox] = useState(false);

  // Keyboard nav for lightbox
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowRight" && safeIdx < images.length - 1) onSelect(safeIdx + 1);
      else if (e.key === "ArrowLeft" && safeIdx > 0) onSelect(safeIdx - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, safeIdx, images.length, onSelect]);

  return (
    <div className="space-y-2">
      {/* Main preview image - click to enlarge */}
      <div
        className="border rounded-lg overflow-hidden bg-muted/20 flex items-center justify-center cursor-pointer"
        onClick={() => setLightbox(true)}
      >
        <img
          src={api.getImageUrl(selectedPath)}
          alt={`Result ${safeIdx + 1}`}
          className="max-h-[400px] object-contain"
        />
      </div>

      {/* Image info bar */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {safeIdx + 1} / {images.length} 枚
        </span>
        <span className="truncate max-w-[300px]" title={selectedPath}>
          {selectedPath.split(/[/\\]/).pop()}
        </span>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {images.map((path, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "shrink-0 w-16 h-16 rounded border overflow-hidden transition-all",
                i === safeIdx
                  ? "border-primary ring-1 ring-primary"
                  : "border-border opacity-70 hover:opacity-100"
              )}
            >
              <img
                src={api.getImageUrl(path)}
                alt={`Thumb ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox modal */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={api.getImageUrl(selectedPath)}
              alt={`Result ${safeIdx + 1}`}
              className="max-w-[90vw] max-h-[90vh] object-contain"
            />
            {/* Nav arrows */}
            {safeIdx > 0 && (
              <button
                type="button"
                aria-label="前の画像"
                onClick={() => onSelect(safeIdx - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70"
              >
                &#8249;
              </button>
            )}
            {safeIdx < images.length - 1 && (
              <button
                type="button"
                aria-label="次の画像"
                onClick={() => onSelect(safeIdx + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70"
              >
                &#8250;
              </button>
            )}
            {/* Close button */}
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => setLightbox(false)}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </button>
            {/* Counter */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
              {safeIdx + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
