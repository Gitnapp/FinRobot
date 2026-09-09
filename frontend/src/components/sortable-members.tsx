import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui";

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function Member({
  symbol,
  label = symbol,
  disabled,
  onRemove,
  onOpen,
  onRename,
}: {
  symbol: string;
  label?: string;
  disabled: boolean;
  onRemove: (symbol: string) => void;
  onOpen?: (id: string) => void;
  onRename?: (id: string) => void;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: symbol, disabled });
  return (
    <div
      ref={setNodeRef}
      className="sortable-member"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="member-drag-handle"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={`拖动排序 ${label}`}
      >
        <GripVertical size={16} />
      </Button>
      {onOpen ? (
        <Button
          type="button"
          variant="outline"
          className="sortable-list-name"
          disabled={disabled}
          onClick={() => onOpen(symbol)}
        >
          {label}
        </Button>
      ) : (
        <strong>{label}</strong>
      )}
      {onRename && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`重命名 ${label}`}
          onClick={() => onRename(symbol)}
        >
          <Pencil size={14} />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        aria-label={`移出 ${label}`}
        onClick={() => onRemove(symbol)}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}
export function SortableMembers({
  symbols,
  disabled,
  onReorder,
  onRemove,
  labels,
  onOpen,
  onRename,
}: {
  labels?: Record<string, string>;
  onOpen?: (id: string) => void;
  onRename?: (id: string) => void;
  symbols: string[];
  disabled: boolean;
  onReorder: (symbols: string[]) => Promise<boolean>;
  onRemove: (symbol: string) => void;
}) {
  const [items, setItems] = useState(symbols);
  const [active, setActive] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setItems(symbols), [symbols]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      accessibility={{
        screenReaderInstructions: {
          draggable: "按空格开始排序，方向键移动，再按空格放下，Escape 取消。",
        },
      }}
      onDragStart={({ active }) => setActive(String(active.id))}
      onDragCancel={() => setActive(null)}
      onDragEnd={async ({ active, over }) => {
        setActive(null);
        if (!over || active.id === over.id || disabled || saving) return;
        const previous = items;
        const next = arrayMove(
          items,
          items.indexOf(String(active.id)),
          items.indexOf(String(over.id)),
        );
        setItems(next);
        setSaving(true);
        try {
          if (!(await onReorder(next))) setItems(previous);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div
        className="list-members"
        aria-label="列表成员排序"
        aria-busy={disabled || saving}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((symbol) => (
            <Member
              key={symbol}
              symbol={symbol}
              label={labels?.[symbol]}
              onOpen={onOpen}
              onRename={onRename}
              disabled={disabled || saving}
              onRemove={onRemove}
            />
          ))}
        </SortableContext>
      </div>
      {createPortal(
        <DragOverlay
          dropAnimation={null}
          style={{ pointerEvents: "none" }}
          zIndex={100}
        >
          {active ? (
            <div className="sortable-member member-drag-preview">
              <span className="member-preview-grip">
                <GripVertical size={16} />
              </span>
              <strong>{labels?.[active] || active}</strong>
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
