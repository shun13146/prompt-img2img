import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
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
  Search,
  Replace,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Download,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useCharacterStore } from "@/stores/characterStore";
import { useClipboard } from "@/hooks/useClipboard";
import { cn } from "@/lib/utils";
import type { QueueItem, QueueStatusInfo, QueueEvent, QueueRunnerStatus } from "@sd-prompt/shared";

type TabType = "pending" | "history";
type SortMode = "generated_desc" | "generated_asc" | "created_asc" | "created_desc";
type SortGroup = "generated" | "created";

/**
 * SD-style Ctrl+Up/Down weight adjustment.
 * Finds the (tag:weight) or plain tag at cursor position and adjusts weight by ±0.1.
 */
function adjustWeightAtCursor(text: string, selectionStart: number, delta: number): { text: string; cursorPos: number } {
  // Find the word/token at cursor
  // Look for (tag:weight) pattern around cursor
  const beforeCursor = text.substring(0, selectionStart);
  const afterCursor = text.substring(selectionStart);

  // Check if we're inside a (tag:weight) construct
  const parenOpenBefore = beforeCursor.lastIndexOf("(");
  const parenCloseBefore = beforeCursor.lastIndexOf(")");

  if (parenOpenBefore > parenCloseBefore) {
    // We're inside parentheses - find the closing paren
    const parenCloseAfter = afterCursor.indexOf(")");
    if (parenCloseAfter !== -1) {
      const fullToken = text.substring(parenOpenBefore, selectionStart + parenCloseAfter + 1);
      const match = fullToken.match(/^\((.+):([0-9.]+)\)$/);
      if (match) {
        const tag = match[1];
        const currentWeight = parseFloat(match[2]);
        const newWeight = Math.max(0, Math.round((currentWeight + delta) * 100) / 100);
        const replacement = `(${tag}:${newWeight.toFixed(1)})`;
        const newText = text.substring(0, parenOpenBefore) + replacement + text.substring(selectionStart + parenCloseAfter + 1);
        return { text: newText, cursorPos: parenOpenBefore + replacement.length };
      }
    }
  }

  // Not inside (tag:weight) — find the nearest comma-separated token
  const lastComma = beforeCursor.lastIndexOf(",");
  const nextComma = afterCursor.indexOf(",");
  const tokenStart = lastComma === -1 ? 0 : lastComma + 1;
  const tokenEnd = nextComma === -1 ? text.length : selectionStart + nextComma;
  const token = text.substring(tokenStart, tokenEnd).trim();

  if (!token) return { text, cursorPos: selectionStart };

  // Wrap in (tag:weight) format
  const newWeight = Math.max(0, Math.round((1.0 + delta) * 100) / 100);
  const replacement = `(${token}:${newWeight.toFixed(1)})`;
  const prefix = text.substring(0, tokenStart);
  const suffix = text.substring(tokenEnd);
  const spaceBefore = text[tokenStart] === " " ? " " : "";
  const newText = prefix + spaceBefore + replacement + suffix;
  return { text: newText, cursorPos: (prefix + spaceBefore + replacement).length };
}

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
  const characterMap = useMemo(() => {
    const map = new Map<string, { name: string; outfits: Map<string, string> }>();
    for (const c of characters) {
      const outfitMap = new Map<string, string>();
      for (const o of c.outfits) outfitMap.set(o.id, o.name);
      map.set(c.id, { name: c.name, outfits: outfitMap });
    }
    return map;
  }, [characters]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Scroll position persistence
  const scrollPositionRef = useRef<Record<TabType, number>>({ pending: 0, history: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleTabChange = useCallback((newTab: TabType) => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current[tab] = scrollContainerRef.current.scrollTop;
    }
    setTab(newTab);
  }, [tab]);

  // Restore scroll position on tab change
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = scrollPositionRef.current[tab];
      });
    }
  }, [tab]);

  // Page-level lightbox state (uses task ID to survive doneTasks reordering)
  const [lightboxState, setLightboxState] = useState<{
    taskId: string;
    imageIndex: number;
  } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceFrom, setReplaceFrom] = useState("");
  const [replaceTo, setReplaceTo] = useState("");
  const [showReplace, setShowReplace] = useState(false);

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

  const handleUpdate = async (id: string, updates: Partial<QueueItem>) => {
    const updated = await api.updateQueueItem(id, updates);
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

  const pendingItems = useMemo(() =>
    queue.filter((q) => q.status === "pending" || q.status === "running"),
    [queue]
  );

  const historyItems = useMemo(() => {
    const items = queue.filter((q) => q.status === "done" || q.status === "failed");
    const sorted = [...items];
    switch (historySort) {
      case "generated_desc":
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case "generated_asc":
        sorted.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
        break;
      case "created_asc":
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "created_desc":
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return sorted;
  }, [queue, historySort]);

  const displayItems = useMemo(() => {
    const items = tab === "pending" ? pendingItems : historyItems;
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => item.final_prompt.toLowerCase().includes(q));
  }, [tab, pendingItems, historyItems, searchQuery]);

  // Done tasks with results (for page-level lightbox navigation)
  const doneTasks = useMemo(() =>
    historyItems.filter((i) => i.status === "done" && i.result_images.length > 0),
    [historyItems]
  );

  const handleOpenLightbox = useCallback((itemId: string, imageIdx: number) => {
    setLightboxState({ taskId: itemId, imageIndex: imageIdx });
  }, []);

  // Bulk delete search results
  const handleDeleteSearchResults = async () => {
    for (const item of displayItems) {
      await api.deleteQueueItem(item.id);
    }
    setQueue((q) => q.filter((item) => !displayItems.some((i) => i.id === item.id)));
  };

  // Bulk replace
  const handleBulkReplace = async () => {
    if (!replaceFrom.trim()) return;
    const items = displayItems.filter((item) => item.status === "pending");
    for (const item of items) {
      const newPrompt = item.final_prompt.replaceAll(replaceFrom, replaceTo);
      if (newPrompt !== item.final_prompt) {
        await handleUpdate(item.id, { final_prompt: newPrompt });
      }
    }
    fetchQueue();
  };

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
            onClick={() => handleTabChange("pending")}
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
            onClick={() => handleTabChange("history")}
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
              {(["generated", "created"] as SortGroup[]).map((group) => {
                const currentGroup: SortGroup = historySort.startsWith("generated") ? "generated" : "created";
                const currentDir = historySort.endsWith("_desc") ? "desc" : "asc";
                const isActive = currentGroup === group;
                const label = group === "generated" ? "生成順" : "登録順";
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        setHistorySort(`${group}_${currentDir === "desc" ? "asc" : "desc"}` as SortMode);
                      } else {
                        setHistorySort(`${group}_desc` as SortMode);
                      }
                    }}
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] rounded border transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {label}{isActive ? (currentDir === "desc" ? " ↓" : " ↑") : ""}
                  </button>
                );
              })}
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

        {/* Search bar */}
        <div className="flex items-center gap-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="プロンプト検索..."
            className="flex-1 px-2 py-1 text-xs border rounded-md bg-background"
          />
          {searchQuery && (
            <>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {displayItems.length}件
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1"
                onClick={() => setShowReplace(!showReplace)}
                title="置換"
              >
                <Replace className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-destructive hover:text-destructive"
                onClick={handleDeleteSearchResults}
                title="検索結果を全削除"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1"
                onClick={() => { setSearchQuery(""); setShowReplace(false); }}
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>

        {/* Replace bar */}
        {showReplace && searchQuery && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground shrink-0">検索:</span>
            <input
              type="text"
              value={replaceFrom}
              onChange={(e) => setReplaceFrom(e.target.value)}
              placeholder="置換前の文字"
              className="flex-1 px-2 py-1 text-xs border rounded-md bg-background"
            />
            <span className="text-[10px] text-muted-foreground shrink-0">→</span>
            <input
              type="text"
              value={replaceTo}
              onChange={(e) => setReplaceTo(e.target.value)}
              placeholder="置換後の文字"
              className="flex-1 px-2 py-1 text-xs border rounded-md bg-background"
            />
            <Button size="sm" className="h-6 text-[10px]" onClick={handleBulkReplace}>
              一括置換
            </Button>
          </div>
        )}
      </div>

      {/* Queue list */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3">
        {loading && (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        )}

        {!loading && tab === "pending" && displayItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchQuery ? "検索結果がありません。" : "待機中のタスクがありません。ビルダーページから追加してください。"}
          </p>
        )}

        {!loading && tab === "history" && displayItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchQuery ? "検索結果がありません。" : "実行履歴がありません。"}
          </p>
        )}

        <div className="space-y-2">
          {displayItems.map((item, idx, arr) => (
            <QueueCard
              key={item.id}
              item={item}
              characterName={
                characterMap.get(item.character_id)?.name || item.character_id
              }
              outfitName={
                characterMap.get(item.character_id)?.outfits.get(item.outfit_id) || item.outfit_id
              }
              isRunning={item.id === currentTaskId}
              progress={item.id === currentTaskId ? progress : null}
              onDelete={() => handleDelete(item.id)}
              onUpdate={(updates) => handleUpdate(item.id, updates)}
              onRunSingle={() => handleRunSingle(item.id)}
              onRequeue={() => handleRequeue(item.id)}
              onMoveUp={item.status === "pending" && idx > 0 ? () => handleMove(item.id, "up") : undefined}
              onMoveDown={item.status === "pending" && idx < arr.length - 1 ? () => handleMove(item.id, "down") : undefined}
              onOpenLightbox={(imageIdx) => handleOpenLightbox(item.id, imageIdx)}
              searchHighlight={searchQuery}
            />
          ))}
        </div>
      </div>

      {/* Page-level lightbox */}
      {lightboxState && doneTasks.length > 0 && (
        <PageLightbox
          doneTasks={doneTasks}
          taskId={lightboxState.taskId}
          imageIndex={lightboxState.imageIndex}
          characterMap={characterMap}
          onNavigate={(taskId, imgIdx) => setLightboxState({ taskId, imageIndex: imgIdx })}
          onClose={() => setLightboxState(null)}
        />
      )}
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

const QueueCard = memo(function QueueCard({
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
  onOpenLightbox,
  searchHighlight,
}: {
  item: QueueItem;
  characterName: string;
  outfitName: string;
  isRunning: boolean;
  progress: { step: number; total: number } | null;
  onDelete: () => void;
  onUpdate: (updates: Partial<QueueItem>) => void;
  onRunSingle: () => void;
  onRequeue: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onOpenLightbox?: (imageIdx: number) => void;
  searchHighlight?: string;
}) {
  const { copied, copy } = useClipboard();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.final_prompt);
  const [showResult, setShowResult] = useState(item.status === "done");
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [editingDenoising, setEditingDenoising] = useState(false);
  const [denoisingValue, setDenoisingValue] = useState(item.settings.denoising_strength);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    onUpdate({ final_prompt: editText });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditText(item.final_prompt);
    setEditing(false);
  };

  const handleDenoisingSave = () => {
    onUpdate({ settings: { ...item.settings, denoising_strength: denoisingValue } } as any);
    setEditingDenoising(false);
  };

  // Ctrl+Up/Down weight adjustment + Enter save in editing mode
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const delta = e.key === "ArrowUp" ? 0.1 : -0.1;
      const result = adjustWeightAtCursor(editText, textarea.selectionStart, delta);
      setEditText(result.text);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        textarea.selectionStart = result.cursorPos;
        textarea.selectionEnd = result.cursorPos;
      });
    }
    // Enter (without Shift) saves
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
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
          <span className="font-medium text-sm">
            {item.type === "background" ? "背景生成" : characterName}
          </span>
          {item.type !== "background" && (
            <span className="text-xs text-muted-foreground">/ {outfitName}</span>
          )}
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
        {editingDenoising ? (
          <span className="flex items-center gap-1">
            Denoising:
            <input
              type="number"
              value={denoisingValue}
              min={0}
              max={1}
              step={0.05}
              onChange={(e) => setDenoisingValue(parseFloat(e.target.value))}
              onBlur={handleDenoisingSave}
              onKeyDown={(e) => e.key === "Enter" && handleDenoisingSave()}
              className="w-14 h-4 text-[10px] text-center border rounded bg-background"
              autoFocus
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => { setDenoisingValue(item.settings.denoising_strength); setEditingDenoising(true); }}
            className="hover:text-foreground hover:underline cursor-pointer"
            title="クリックで編集"
          >
            Denoising: {item.settings.denoising_strength}
          </button>
        )}
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
          onOpenLightbox={onOpenLightbox}
        />
      )}

      {/* Prompt: editable or read-only */}
      {editing ? (
        <div className="space-y-1">
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={() => {
              if (editText !== item.final_prompt) {
                handleSave();
              } else {
                setEditing(false);
              }
            }}
            className="w-full text-xs font-mono border rounded p-2 bg-background resize-y min-h-[80px]"
            rows={6}
            autoFocus
          />
          <div className="flex gap-1 justify-between">
            <span className="text-[10px] text-muted-foreground self-center">
              Ctrl+↑↓: ウェイト調整
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7" onMouseDown={(e) => e.preventDefault()} onClick={handleCancel}>
                キャンセル
              </Button>
              <Button size="sm" className="h-7" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1" /> 保存
              </Button>
            </div>
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
          <div className={cn(
            "text-xs font-mono bg-muted/30 rounded p-2 break-all whitespace-pre-wrap",
            !showResult && "line-clamp-3"
          )}>
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
}, (prev, next) => {
  return (
    prev.item === next.item &&
    prev.characterName === next.characterName &&
    prev.outfitName === next.outfitName &&
    prev.isRunning === next.isRunning &&
    prev.progress === next.progress &&
    prev.searchHighlight === next.searchHighlight &&
    !!prev.onMoveUp === !!next.onMoveUp &&
    !!prev.onMoveDown === !!next.onMoveDown &&
    !!prev.onOpenLightbox === !!next.onOpenLightbox
  );
});

/** Agent-scheduler style result gallery: large preview + thumbnail strip */
function ResultGallery({
  images,
  selectedIdx,
  onSelect,
  onOpenLightbox,
}: {
  images: string[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onOpenLightbox?: (imageIdx: number) => void;
}) {
  const safeIdx = Math.min(selectedIdx, images.length - 1);
  const selectedPath = images[safeIdx];

  return (
    <div className="space-y-2">
      {/* Main preview image - click to enlarge */}
      <div
        className="border rounded-lg overflow-hidden bg-muted/20 flex items-center justify-center cursor-pointer"
        onClick={() => onOpenLightbox?.(safeIdx)}
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
    </div>
  );
}

/** Page-level lightbox with task navigation and save */
function PageLightbox({
  doneTasks,
  taskId,
  imageIndex,
  characterMap,
  onNavigate,
  onClose,
}: {
  doneTasks: QueueItem[];
  taskId: string;
  imageIndex: number;
  characterMap: Map<string, { name: string; outfits: Map<string, string> }>;
  onNavigate: (taskId: string, imgIdx: number) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [destPath, setDestPath] = useState("");
  const saveHandlerRef = useRef<() => void>();

  // Derive task index from ID (stable across doneTasks changes)
  const safeTaskIdx = useMemo(() => {
    const idx = doneTasks.findIndex((t) => t.id === taskId);
    return idx >= 0 ? idx : Math.min(doneTasks.length - 1, 0);
  }, [doneTasks, taskId]);

  const task = doneTasks[safeTaskIdx];
  const images = task?.result_images ?? [];
  const safeImgIdx = Math.min(imageIndex, Math.max(0, images.length - 1));
  const currentPath = images[safeImgIdx];

  // Character/source info for display
  const charInfo = task ? characterMap.get(task.character_id) : null;
  const sourceName = task?.source_image_path.split(/[/\\]/).pop() || "";

  // Initialize destPath from task source (replace "original" with "AI済み")
  useEffect(() => {
    if (!task) return;
    const sourceDir = task.source_image_path.split(/[/\\]/).slice(0, -1).join("/");
    setDestPath(sourceDir.replace(/original/gi, "AI済み"));
  }, [task?.source_image_path]);

  const handleSave = useCallback(async () => {
    if (!task || !currentPath || saving) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const sourceFilename = task.source_image_path.split(/[/\\]/).pop() || "image.png";
      const result = await api.saveImage(currentPath, destPath, sourceFilename);
      setSaveResult(result.saved_path);
      setTimeout(() => setSaveResult(null), 3000);
    } catch {
      setSaveResult("error");
      setTimeout(() => setSaveResult(null), 3000);
    } finally {
      setSaving(false);
    }
  }, [task, currentPath, destPath, saving]);

  // Keep ref in sync for keyboard handler
  saveHandlerRef.current = handleSave;

  // Keyboard navigation
  useEffect(() => {
    if (!task) return;
    const handler = (e: KeyboardEvent) => {
      // Don't capture when input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter") {
        e.preventDefault();
        saveHandlerRef.current?.();
      } else if (e.key === "ArrowRight") {
        const nextIdx = (safeImgIdx + 1) % images.length;
        onNavigate(task.id, nextIdx);
      } else if (e.key === "ArrowLeft") {
        const prevIdx = (safeImgIdx - 1 + images.length) % images.length;
        onNavigate(task.id, prevIdx);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (safeTaskIdx > 0) onNavigate(doneTasks[safeTaskIdx - 1].id, 0);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (safeTaskIdx < doneTasks.length - 1) onNavigate(doneTasks[safeTaskIdx + 1].id, 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [task, safeTaskIdx, safeImgIdx, images.length, onNavigate, onClose, doneTasks]);

  if (!task || !currentPath) return null;

  const handlePrevImage = () => {
    const prevIdx = (safeImgIdx - 1 + images.length) % images.length;
    onNavigate(task.id, prevIdx);
  };

  const handleNextImage = () => {
    const nextIdx = (safeImgIdx + 1) % images.length;
    onNavigate(task.id, nextIdx);
  };

  const handlePrevTask = () => {
    if (safeTaskIdx > 0) onNavigate(doneTasks[safeTaskIdx - 1].id, 0);
  };

  const handleNextTask = () => {
    if (safeTaskIdx < doneTasks.length - 1) onNavigate(doneTasks[safeTaskIdx + 1].id, 0);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Top: task info + prev task button */}
      <div className="shrink-0 w-full flex flex-col items-center py-1" onClick={(e) => e.stopPropagation()}>
        {/* Character + source image name */}
        <div className="text-white/80 text-xs mb-1 flex items-center gap-2">
          {charInfo && <span className="font-medium">{charInfo.name}</span>}
          <span className="text-white/50">{sourceName}</span>
        </div>
        <button
          type="button"
          onClick={handlePrevTask}
          disabled={safeTaskIdx <= 0}
          className="flex items-center gap-1 text-white/70 text-xs px-3 py-1 rounded hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUp className="h-4 w-4" /> 前のタスク ({safeTaskIdx + 1}/{doneTasks.length})
        </button>
      </div>

      {/* Image area - click empty space to close */}
      <div
        className="relative flex-1 flex items-center justify-center w-full"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <img
          src={api.getImageUrl(currentPath)}
          alt={`Result ${safeImgIdx + 1}`}
          className="max-w-[90vw] max-h-[70vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        {/* Nav arrows (always shown, wrap-around) */}
        <button
          type="button"
          aria-label="前の画像"
          onClick={handlePrevImage}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70"
        >
          &#8249;
        </button>
        <button
          type="button"
          aria-label="次の画像"
          onClick={handleNextImage}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70"
        >
          &#8250;
        </button>
        {/* Close button */}
        <button
          type="button"
          aria-label="閉じる"
          onClick={onClose}
          className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Save + image counter + Enter hint */}
      <div className="shrink-0 flex items-center gap-2 py-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 text-white text-sm px-4 py-1.5 rounded bg-white/15 hover:bg-white/25 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {saveResult === "error" ? "エラー" : saveResult ? "保存済み" : "保存 (Enter)"}
        </button>
        <span className="text-white/50 text-xs">
          {safeImgIdx + 1}/{images.length} 枚
        </span>
      </div>

      {/* Bottom: next task button */}
      <div className="shrink-0 w-full flex justify-center py-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleNextTask}
          disabled={safeTaskIdx >= doneTasks.length - 1}
          className="flex items-center gap-1 text-white/70 text-xs px-3 py-1 rounded hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          次のタスク ({safeTaskIdx + 2}/{doneTasks.length}) <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom bar: save + editable path */}
      <div className="shrink-0 w-full bg-black/60 px-4 py-2 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <span className="text-white text-xs shrink-0">
          {safeImgIdx + 1}/{images.length} 枚
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 text-white text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 shrink-0"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {saveResult === "error" ? "エラー" : saveResult ? "保存済み" : "保存"}
        </button>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <FolderOpen className="h-3.5 w-3.5 text-white/50 shrink-0" />
          <input
            type="text"
            value={destPath}
            onChange={(e) => setDestPath(e.target.value)}
            className="flex-1 min-w-0 text-xs text-white/80 bg-white/10 border border-white/20 rounded px-2 py-1 focus:outline-none focus:border-white/40 focus:bg-white/15"
            title="保存先フォルダ"
          />
        </div>
      </div>
    </div>
  );
}
