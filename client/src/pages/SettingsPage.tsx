import { useState, useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";

export function SettingsPage() {
  const { settings, fetch, update } = useSettingsStore();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (!form) return <div className="p-6">読み込み中...</div>;

  const handleSave = async () => {
    await update(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold mb-6">設定</h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Forge API URL</label>
          <Input
            value={form.forge_api_url}
            onChange={(e) => setForm({ ...form, forge_api_url: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Checkpoint モデル名</label>
          <Input
            value={form.checkpoint_model}
            onChange={(e) => setForm({ ...form, checkpoint_model: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">出力フォルダ</label>
          <Input
            value={form.output_folder}
            onChange={(e) => setForm({ ...form, output_folder: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Negative Prompt（全キャラ共通）</label>
          <Textarea
            value={form.negative_prompt}
            onChange={(e) => setForm({ ...form, negative_prompt: e.target.value })}
            rows={4}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Steps</label>
            <Input
              type="number"
              value={form.default_settings.steps}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_settings: { ...form.default_settings, steps: parseInt(e.target.value) },
                })
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">CFG Scale</label>
            <Input
              type="number"
              value={form.default_settings.cfg_scale}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_settings: {
                    ...form.default_settings,
                    cfg_scale: parseFloat(e.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Sampler</label>
            <Input
              value={form.default_settings.sampler}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_settings: { ...form.default_settings, sampler: e.target.value },
                })
              }
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saved}>
          {saved ? <><Check className="h-4 w-4 mr-1" /> 保存済み</> : "保存"}
        </Button>
      </div>
    </div>
  );
}
