import { Plus, ArrowDownUp, Trash2, Check, X } from 'lucide-react';
import { Favicon } from '../../../shared/utils/faviconUtils';
import { cn } from '../../../shared/lib/utils';
import { FlatModel, SortKey, SortDirection } from '../types';
import { getSequenceClass, getSortColorClass } from '../utils/modelUtils';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, MousePointer2, ChevronUp, ChevronDown } from 'lucide-react';

interface ModelsTableProps {
  models: FlatModel[];
  startIndex: number;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  getModelSequence: (modelId: string, providerId: string) => number | undefined;
  maxSequence: number;
  onSetNext: (model: FlatModel) => void;
  onOpenInsert: (model: FlatModel) => void;
  onRemove: (model: FlatModel) => void;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

const SortIndicator = ({ direction }: { direction: SortDirection }) => {
  if (direction === 'none') return null;
  return direction === 'asc' ? (
    <ChevronUp className="w-3.5 h-3.5 ml-1" />
  ) : (
    <ChevronDown className={cn('w-3.5 h-3.5 ml-1', direction === 'desc' && 'text-red-500')} />
  );
};

export const ModelsTable = ({
  models,
  startIndex,
  sortKey,
  sortDirection,
  onSort,
  getModelSequence,
  maxSequence,
  onSetNext,
  onOpenInsert,
  onRemove,
}: ModelsTableProps) => {
  const navigate = useNavigate();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [menuModel, setMenuModel] = useState<FlatModel | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent, model: FlatModel) => {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuModel(model);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuPosition(null);
      }
    };
    if (menuPosition) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuPosition]);

  return (
    <div className="w-full overflow-auto flex-1">
      <table className="w-full caption-bottom text-sm text-left">
        <thead className="sticky top-0 bg-card z-10 border-b">
          <tr className="border-b transition-colors text-muted-foreground font-medium">
            <th className="h-9 px-4 align-middle w-[60px] text-center font-medium">STT</th>
            <th className="h-9 px-4 align-middle text-left font-medium">Model</th>
            <th className="h-9 px-4 align-middle w-[80px] text-center font-medium">Thinking</th>
            <th
              className={cn(
                'h-9 px-4 align-middle cursor-pointer select-none transition-colors whitespace-nowrap font-medium',
                getSortColorClass('max_req_conversation', sortKey, sortDirection),
              )}
              onClick={() => onSort('max_req_conversation')}
            >
              <div className="flex items-center justify-center">
                Max Conv Token
                <SortIndicator
                  direction={sortKey === 'max_req_conversation' ? sortDirection : 'none'}
                />
              </div>
            </th>
            <th
              className={cn(
                'h-9 px-4 align-middle cursor-pointer select-none transition-colors whitespace-nowrap font-medium',
                getSortColorClass('usage_requests', sortKey, sortDirection),
              )}
              onClick={() => onSort('usage_requests')}
            >
              <div className="flex items-center justify-center">
                Totals (Req | Token)
                <SortIndicator direction={sortKey === 'usage_requests' ? sortDirection : 'none'} />
              </div>
            </th>
            <th className="h-9 px-4 align-middle w-[100px] text-center font-medium">Sequence</th>
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {models.length === 0 && (
            <tr>
              <td colSpan={6} className="h-24 text-center text-muted-foreground">
                No models available.
              </td>
            </tr>
          )}
          {models.map((model, index) => {
            const sequence = getModelSequence(model.model_id, model.provider_id);
            const absoluteIndex = startIndex + index + 1;
            const hasSequence = sequence !== undefined;
            const uniqueKey = `${model.provider_id}-${model.model_id}`;

            return (
              <tr
                key={uniqueKey}
                onContextMenu={(e) => handleContextMenu(e, model)}
                className={cn(
                  'border-b transition-colors hover:bg-muted/50 relative group cursor-default',
                  hasSequence && 'bg-primary/5',
                )}
              >
                <td className="px-4 py-1.5 align-middle text-muted-foreground text-center">
                  {absoluteIndex}
                </td>
                <td className="px-4 py-1.5 align-middle">
                  <div className="flex items-center gap-2 truncate flex-1">
                    <div className="w-32 shrink-0 flex items-center justify-end gap-1.5">
                      <Favicon url={model.website} size={14} className="rounded-sm opacity-70" />
                      <span className="text-[10px] text-zinc-500 font-mono shrink-0 lowercase">
                        {model.provider_id}
                      </span>
                    </div>
                    <span className="text-zinc-700 font-light shrink-0">|</span>
                    <span className="truncate flex-1 font-medium">{model.model_id}</span>
                  </div>
                </td>
                <td className="px-4 py-1.5 align-middle text-center">
                  {model.is_thinking ? (
                    <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-2.5 align-middle text-center">
                  <span className="text-sm font-medium text-foreground">
                    {formatNumber(model.max_token_conversation || 0)}
                  </span>
                </td>
                <td className="px-4 py-2.5 align-middle text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">
                      {model.usage_requests?.toLocaleString() || 0}
                    </span>
                    <span className="text-xs text-muted-foreground opacity-40">|</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {formatNumber(model.usage_tokens || 0)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 align-middle text-center">
                  {hasSequence ? (
                    <span
                      className={cn('text-sm font-bold', getSequenceClass(sequence, maxSequence))}
                    >
                      {sequence}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {menuPosition && menuModel && (
        <div
          ref={menuRef}
          className="fixed z-[100] w-64 rounded-md border border-dropdown-border bg-dropdown-background p-1 shadow-md animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: Math.min(menuPosition.y, window.innerHeight - 200),
            left: Math.min(menuPosition.x, window.innerWidth - 270),
          }}
        >
          <div className="p-1">
            <button
              onClick={() => {
                navigate('/playground', {
                  state: { providerId: menuModel.provider_id, modelId: menuModel.model_id },
                });
                setMenuPosition(null);
              }}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-dropdown-itemHover text-foreground"
            >
              <MousePointer2 className="mr-2 h-4 w-4" />
              Open in Playground
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(menuModel, null, 2));
                setMenuPosition(null);
              }}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-dropdown-itemHover text-foreground"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy JSON
            </button>

            <div className="my-1 h-px bg-dropdown-border" />

            {!getModelSequence(menuModel.model_id, menuModel.provider_id) ? (
              <>
                <button
                  onClick={() => {
                    onSetNext(menuModel);
                    setMenuPosition(null);
                  }}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-dropdown-itemHover"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Set as sequence {maxSequence + 1}
                </button>
                {maxSequence > 0 && (
                  <button
                    onClick={() => {
                      onOpenInsert(menuModel);
                      setMenuPosition(null);
                    }}
                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-dropdown-itemHover"
                  >
                    <ArrowDownUp className="mr-2 h-4 w-4" />
                    Insert at sequence...
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => {
                  onRemove(menuModel);
                  setMenuPosition(null);
                }}
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-destructive/10 hover:text-destructive text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove sequence
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
