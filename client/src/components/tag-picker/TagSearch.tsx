import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { TagEntry, TagCategory } from "@sd-prompt/shared";

interface TagSearchProps {
  categories: TagCategory[];
  onSelectTag: (categoryId: string, tag: TagEntry) => void;
}

interface SearchResult {
  tag: TagEntry;
  categoryId: string;
  categoryLabel: string;
  subcategoryName: string;
}

export function TagSearch({ categories, onSelectTag }: TagSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  const search = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      const lower = q.toLowerCase();
      const found: SearchResult[] = [];

      for (const cat of categories) {
        if (!cat.subcategories) continue;
        for (const sub of cat.subcategories) {
          for (const tag of sub.tags) {
            if (
              tag.prompt.toLowerCase().includes(lower) ||
              tag.label.toLowerCase().includes(lower) ||
              tag.id.toLowerCase().includes(lower)
            ) {
              found.push({
                tag,
                categoryId: cat.id,
                categoryLabel: cat.label,
                subcategoryName: sub.name,
              });
            }
          }
        }
      }

      setResults(found.slice(0, 30));
    },
    [categories]
  );

  useEffect(() => {
    const timer = setTimeout(() => search(query), 150);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="タグを検索..."
          className="pl-8 h-8 text-sm"
        />
      </div>
      {results.length > 0 && (
        <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
          {results.map((r) => (
            <button
              key={`${r.categoryId}-${r.tag.id}`}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex justify-between cursor-pointer"
              onClick={() => onSelectTag(r.categoryId, r.tag)}
            >
              <span>
                <span className="font-medium">{r.tag.label}</span>
                <span className="text-muted-foreground ml-1">({r.tag.prompt})</span>
              </span>
              <span className="text-muted-foreground">{r.categoryLabel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
