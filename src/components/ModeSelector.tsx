import type { DeleteMode } from "../../shared/types";
import { ModeCard } from "./ModeCard";

interface ModeSelectorProps {
  value: DeleteMode;
  onChange: (mode: DeleteMode) => void;
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <section>
      <h2 className="type-card-title mb-2 text-[var(--color-heading)]">选择匹配与删除模式</h2>
      <div className="grid grid-cols-1 gap-3 min-[980px]:grid-cols-2">
        <ModeCard
          mode="jpg_as_source_delete_raw"
          title="以 JPG 为准删除 RAW"
          description="当 JPG 与 RAW 成功匹配时，删除多余的 RAW 文件"
          sourceLabel="JPG"
          deleteLabel="RAW"
          active={value === "jpg_as_source_delete_raw"}
          onSelect={onChange}
        />
        <ModeCard
          mode="raw_as_source_delete_jpg"
          title="以 RAW 为准删除 JPG"
          description="当 RAW 与 JPG 成功匹配时，删除多余的 JPG 文件"
          sourceLabel="RAW"
          deleteLabel="JPG"
          active={value === "raw_as_source_delete_jpg"}
          onSelect={onChange}
        />
      </div>
    </section>
  );
}
