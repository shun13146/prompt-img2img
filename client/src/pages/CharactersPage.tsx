import { useState } from "react";
import { useCharacterStore } from "@/stores/characterStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Copy, ChevronDown, ChevronRight } from "lucide-react";
import type { Character, CharacterOutfit } from "@sd-prompt/shared";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function createEmptyOutfit(): CharacterOutfit {
  return {
    id: generateId(),
    name: "新しい衣装",
    block1: { quality: "masterpiece, best quality, absurdres" },
    block2: { hair: "", lora: "", eyes: "", features: "", clothing: "" },
  };
}

function createEmptyCharacter(): Character {
  return {
    id: generateId(),
    name: "",
    group: "神様のかくしごと/メイン",
    outfits: [createEmptyOutfit()],
    settings: {
      steps: 35,
      sampler: "DPM++ 2M Karras",
      cfg_scale: 7,
      width: 512,
      height: 768,
      denoising_strength: 0.55,
    },
    memo: "",
  };
}

export function CharactersPage() {
  const { characters, create, update, remove } = useCharacterStore();
  const [editing, setEditing] = useState<Character | null>(null);
  const [isNew, setIsNew] = useState(false);

  const handleNew = () => {
    setEditing(createEmptyCharacter());
    setIsNew(true);
  };

  const handleEdit = (char: Character) => {
    setEditing(structuredClone(char));
    setIsNew(false);
  };

  const handleDuplicate = (char: Character) => {
    const dup = structuredClone(char);
    dup.id = generateId();
    dup.name = `${char.name} (コピー)`;
    dup.outfits = dup.outfits.map((o: CharacterOutfit) => ({ ...o, id: generateId() }));
    setEditing(dup);
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (isNew) {
      await create(editing);
    } else {
      await update(editing.id, editing);
    }
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("このキャラクターを削除しますか？")) {
      await remove(id);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">キャラクター管理</h2>
        <Button onClick={handleNew} size="sm">
          <Plus className="h-4 w-4" /> 新規作成
        </Button>
      </div>

      <div className="grid gap-4">
        {characters.map((char) => (
          <div key={char.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{char.name}</h3>
                <p className="text-xs text-muted-foreground">{char.group}</p>
                <p className="text-sm text-muted-foreground">
                  衣装: {char.outfits.map((o) => o.name).join(", ")}
                </p>
                {char.memo && (
                  <p className="text-xs text-muted-foreground mt-1">{char.memo}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label="編集" onClick={() => handleEdit(char)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="複製" onClick={() => handleDuplicate(char)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="削除" onClick={() => handleDelete(char.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {characters.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            キャラクターがありません。「新規作成」で追加してください。
          </p>
        )}
      </div>

      {/* Character Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "キャラクター作成" : "キャラクター編集"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <CharacterForm
              character={editing}
              onChange={setEditing}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CharacterForm({
  character,
  onChange,
  onSave,
  onCancel,
}: {
  character: Character;
  onChange: (c: Character) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [expandedOutfit, setExpandedOutfit] = useState<string>(
    character.outfits[0]?.id || ""
  );

  const updateField = (field: keyof Character, value: any) => {
    onChange({ ...character, [field]: value });
  };

  const updateOutfit = (outfitId: string, updates: Partial<CharacterOutfit>) => {
    onChange({
      ...character,
      outfits: character.outfits.map((o) =>
        o.id === outfitId ? { ...o, ...updates } : o
      ),
    });
  };

  const updateBlock2 = (outfitId: string, field: string, value: string) => {
    const outfit = character.outfits.find((o) => o.id === outfitId);
    if (!outfit) return;
    updateOutfit(outfitId, {
      block2: { ...outfit.block2, [field]: value },
    });
  };

  const addOutfit = () => {
    onChange({
      ...character,
      outfits: [...character.outfits, createEmptyOutfit()],
    });
  };

  const duplicateOutfit = (outfitId: string) => {
    const source = character.outfits.find((o) => o.id === outfitId);
    if (!source) return;
    const dup = { ...structuredClone(source), id: generateId(), name: `${source.name} (コピー)` };
    onChange({
      ...character,
      outfits: [...character.outfits, dup],
    });
  };

  const removeOutfit = (outfitId: string) => {
    if (character.outfits.length <= 1) return;
    onChange({
      ...character,
      outfits: character.outfits.filter((o) => o.id !== outfitId),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">キャラ名</label>
          <Input
            value={character.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="カレン"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">キャラID</label>
          <Input
            value={character.id}
            onChange={(e) => updateField("id", e.target.value)}
            placeholder="karen"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">グループ</label>
        <Input
          value={character.group}
          onChange={(e) => updateField("group", e.target.value)}
          placeholder="神様のかくしごと/メイン"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">メモ</label>
        <Input
          value={character.memo}
          onChange={(e) => updateField("memo", e.target.value)}
          placeholder="キャラの説明メモ"
        />
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">衣装バリエーション</h4>
          <Button variant="outline" size="sm" onClick={addOutfit}>
            <Plus className="h-3 w-3" /> 衣装追加
          </Button>
        </div>

        {character.outfits.map((outfit) => {
          const isExpanded = expandedOutfit === outfit.id;
          return (
            <div key={outfit.id} className="border rounded-md mb-2">
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedOutfit(isExpanded ? "" : outfit.id)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">{outfit.name}</span>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => duplicateOutfit(outfit.id)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOutfit(outfit.id)}
                    disabled={character.outfits.length <= 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {isExpanded && (
                <div className="p-3 pt-0 space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">衣装名</label>
                    <Input
                      value={outfit.name}
                      onChange={(e) => updateOutfit(outfit.id, { name: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      ブロック1: クオリティタグ
                    </label>
                    <Input
                      value={outfit.block1.quality}
                      onChange={(e) =>
                        updateOutfit(outfit.id, { block1: { quality: e.target.value } })
                      }
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium block">ブロック2: キャラプロンプト</label>
                    {(
                      [
                        ["hair", "髪型・髪色"],
                        ["lora", "キャラLoRA"],
                        ["eyes", "目元 (閉じ目・顔映らない時に自動削除)"],
                        ["features", "その他特徴（性別・体型・アクセ等）"],
                        ["clothing", "服装"],
                      ] as const
                    ).map(([field, label]) => (
                      <div key={field}>
                        <label className="text-xs text-muted-foreground mb-0.5 block">
                          {label}
                        </label>
                        <Input
                          value={outfit.block2[field]}
                          onChange={(e) => updateBlock2(outfit.id, field, e.target.value)}
                          className="text-sm"
                          placeholder={field}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
        <Button onClick={onSave} disabled={!character.name}>
          保存
        </Button>
      </div>
    </div>
  );
}
