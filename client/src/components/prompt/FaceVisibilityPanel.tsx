import { usePromptStore } from "@/stores/promptStore";

export function FaceVisibilityPanel() {
  const { faceVisibilityOptions, setFaceVisibilityOption } = usePromptStore();

  return (
    <div className="border rounded-md p-3 bg-muted/30 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        顔映らないオプション
      </p>
      {(
        [
          ["face_out_of_frame", "face out of frame を追加"],
          ["head_out_of_frame", "head out of frame を追加"],
          ["remove_hair", "髪プロンプトを削除"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={faceVisibilityOptions[key]}
            onChange={(e) => setFaceVisibilityOption(key, e.target.checked)}
            className="rounded"
          />
          {label}
        </label>
      ))}
    </div>
  );
}
