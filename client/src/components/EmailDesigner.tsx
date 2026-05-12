import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { closestCenter, defaultDropAnimationSideEffects, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronRight,
  Code2,
  Columns,
  Copy, Download,
  Eye,
  FileText,
  Globe,
  GripVertical,
  Image as ImageIcon,
  Layout,
  LayoutTemplate,
  Link2,
  Maximize2,
  Minus,
  Monitor,
  Moon,
  MousePointerClick,
  Plus,
  Redo2,
  RotateCcw,
  Smartphone,
  Space,
  Sun,
  Trash2,
  Type,
  Type as TypeIcon,
  Undo2,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark as syntaxTheme } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { DEFAULT_BLOCKS, DEFAULT_SETTINGS, EMAIL_TEMPLATES } from './email-designer/templates';
import type { Block, BlockType, CanvasTab, EmailSettings, HistoryState } from './email-designer/types';

// --- Components ---

function SidebarDraggableItem({ type }: { type: BlockType }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${type}`,
    data: { isSidebarItem: true, type }
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-neutral-800 bg-neutral-900 transition-all group cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-50 border-brand-500 scale-95' : 'hover:border-brand-500 hover:bg-brand-500/10'}`}
    >
      <div className="text-neutral-400 group-hover:text-brand-500 transition-colors">
        {getSidebarIcon(type)}
      </div>
      <span className="text-[10px] font-semibold text-neutral-300 uppercase tracking-tighter">{type}</span>
    </div>
  );
}

function SortableLayerItem({ block, isSelected, onSelect, onDelete }: { block: Block, isSelected: boolean, onSelect: () => void, onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `layer-${block.id}`,
    data: { isLayerItem: true, block }
  });

  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-2 mb-1 rounded border text-xs transition-all cursor-pointer group
        ${isSelected ? 'border-brand-500 bg-brand-500/10 text-brand-400' : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900 text-neutral-400'}
        ${isDragging ? 'opacity-50' : 'opacity-100'}
      `}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="flex items-center gap-2 flex-1 overflow-hidden">
        <div {...attributes} {...listeners} className="cursor-grab hover:text-white p-1 -ml-1 text-neutral-600 transition-colors">
          <GripVertical className="w-3 h-3" />
        </div>
        <span className="truncate font-medium">{block.type}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-400 text-neutral-600 transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function EditableBlockContent({
  block, isSelected, selectedBlockId, onSelect, themeMode, onUpdateContent
}: {
  block: Block, isSelected: boolean, selectedBlockId: string | null, onSelect: (id: string) => void, themeMode: string, onUpdateContent: (id: string, content: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false);
  const editRef = useRef<any>(null);

  let computedStyle = { ...block.style };
  if (themeMode === 'dark') {
    if (computedStyle.color === '#111827' || !computedStyle.color) computedStyle.color = '#f8fafc';
    if (computedStyle.color === '#4b5563') computedStyle.color = '#cbd5e1';
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (block.type === 'Text' || block.type === 'Heading' || block.type === 'Button') {
      setIsEditing(true);
      setTimeout(() => editRef.current?.focus(), 0);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editRef.current) {
      onUpdateContent(block.id, editRef.current.innerHTML);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'Text') {
      e.preventDefault();
      editRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(block.id);
  };

  const commonProps = {
    ref: editRef,
    contentEditable: isEditing,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onDoubleClick: handleDoubleClick,
    style: computedStyle,
    className: `outline-none ${isEditing ? 'cursor-text bg-brand-500/5 ring-1 ring-brand-500/50 rounded-sm' : ''}`,
    onClick: handleClick
  };

  const hoverClass = isSelected ? 'ring-1 ring-brand-500 rounded-sm shadow-sm z-10' : 'hover:ring-1 hover:ring-dashed hover:ring-brand-500/50 hover:bg-brand-500/5';

  switch (block.type) {
    case 'Heading': return <h1 {...commonProps} dangerouslySetInnerHTML={{ __html: block.content || '' }} className={`${commonProps.className} ${hoverClass}`} />;
    case 'Text': return <p {...commonProps} dangerouslySetInnerHTML={{ __html: block.content || '' }} className={`${commonProps.className} ${hoverClass}`} />;
    case 'Link': return <a href={block.href || '#'} {...commonProps} onClick={(e) => { e.preventDefault(); commonProps.onClick(e); }} dangerouslySetInnerHTML={{ __html: block.content || '' }} className={`${commonProps.className} ${hoverClass}`} />;
    case 'Spacer': return <div {...commonProps} style={{ height: computedStyle.height || '20px', width: '100%', ...computedStyle }} className={`${commonProps.className} ${hoverClass}`} />;
    case 'Button':
      return (
        <div style={{ textAlign: (computedStyle as any).textAlign || 'center', width: '100%' }} onClick={handleClick} className={`${commonProps.className} ${hoverClass}`}>
          <a href={block.href || '#'} {...commonProps} onClick={(e) => { e.preventDefault(); commonProps.onClick(e); }} dangerouslySetInnerHTML={{ __html: block.content || '' }} />
        </div>
      );
    case 'Image': return <img src={block.src} alt={block.alt} {...commonProps} className={`${commonProps.className} ${hoverClass}`} />;
    case 'Divider': return <hr {...commonProps} className={`${commonProps.className} ${hoverClass}`} />;
    case 'Row':
      return (
        <div {...commonProps} style={{ display: 'flex', gap: computedStyle.gap || '20px', ...computedStyle }} className={`${commonProps.className} ${hoverClass}`}>
          {block.columns?.map(col => (
            <div key={col.id} style={{ width: `${col.width}%` }} className="flex flex-col relative group/col">
              {col.blocks.map(b => (
                <EditableBlockContent
                  key={b.id}
                  block={b}
                  isSelected={selectedBlockId === b.id}
                  selectedBlockId={selectedBlockId}
                  onSelect={onSelect}
                  themeMode={themeMode}
                  onUpdateContent={onUpdateContent}
                />
              ))}
              {col.blocks.length === 0 && <div className="p-4 border border-dashed border-neutral-300 rounded text-[10px] text-center text-neutral-400 uppercase font-bold">Column</div>}
            </div>
          ))}
        </div>
      );
    default: return null;
  }
}

function SortableCanvasItem({
  block, isSelected, selectedBlockId, onSelect, themeMode, onUpdateContent
}: {
  block: Block, isSelected: boolean, selectedBlockId: string | null, onSelect: (id: string) => void, themeMode: string, onUpdateContent: (id: string, content: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `canvas-${block.id}`,
    data: { isCanvasItem: true, block }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.4 : 1
  };

  const wrapperClass = `relative group transition-all rounded-sm outline-offset-2 ${isSelected ? 'z-10' : ''}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={wrapperClass}
    >
      {isSelected && (
        <div className="absolute -top-6 left-0 bg-brand-500 text-brand-950 text-[10px] font-bold px-2 py-0.5 rounded-t-sm shadow-sm z-20 flex items-center gap-1 animate-in slide-in-from-bottom-1">
          <LayoutTemplate className="w-3 h-3" /> {block.type}
        </div>
      )}
      <EditableBlockContent
        block={block}
        isSelected={isSelected}
        selectedBlockId={selectedBlockId}
        onSelect={onSelect}
        themeMode={themeMode}
        onUpdateContent={onUpdateContent}
      />
    </div>
  );
}

// --- Main Component ---

export function EmailDesigner() {
  // Tabs State
  const [tabs, setTabs] = useState<CanvasTab[]>(() => {
    const saved = localStorage.getItem('fairarena_email_tabs');
    if (saved) return JSON.parse(saved);
    return [{
      id: 'default',
      name: 'Untitled Email',
      blocks: DEFAULT_BLOCKS,
      settings: DEFAULT_SETTINGS,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }];
  });
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const blocks = activeTab.blocks;
  const emailSettings = activeTab.settings;

  const setBlocks = useCallback((newBlocks: Block[] | ((prev: Block[]) => Block[])) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const blocksValue = typeof newBlocks === 'function' ? newBlocks(t.blocks) : newBlocks;
        return { ...t, blocks: blocksValue, updatedAt: Date.now() };
      }
      return t;
    }));
  }, [activeTabId]);

  const setEmailSettings = useCallback((newSettings: Partial<EmailSettings>) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        return { ...t, settings: { ...t.settings, ...newSettings }, updatedAt: Date.now() };
      }
      return t;
    }));
  }, [activeTabId]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  const [activeView, setActiveView] = useState<'preview' | 'code'>('preview');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<any>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Persistence
  useEffect(() => {
    localStorage.setItem('fairarena_email_tabs', JSON.stringify(tabs));
  }, [tabs]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBlockId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && !document.activeElement?.hasAttribute('contenteditable')) {
          removeBlock(selectedBlockId);
        }
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          handleUndo();
        }
        if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
        }
        if (e.key === 's') {
          e.preventDefault();
          // Auto-saved, but can add toast
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, past, future]);

  const pushStateToHistory = useCallback(() => {
    setPast(prev => [...prev.slice(-19), { blocks, settings: emailSettings }]);
    setFuture([]);
  }, [blocks, emailSettings]);

  const handleUndo = () => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setFuture(f => [{ blocks, settings: emailSettings }, ...f]);
    setPast(p => p.slice(0, -1));
    setBlocks(prev.blocks);
    setEmailSettings(prev.settings);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setPast(p => [...p, { blocks, settings: emailSettings }]);
    setFuture(f => f.slice(1));
    setBlocks(next.blocks);
    setEmailSettings(next.settings);
  };

  const createNewBlock = (type: BlockType): Block => {
    const id = Math.random().toString(36).substr(2, 9);
    const base: Block = { id, type, style: { fontFamily: emailSettings.fontFamily } };
    switch (type) {
      case 'Heading': return { ...base, content: 'New Heading', style: { ...base.style, color: '#111827', fontSize: '24px', fontWeight: 'bold', margin: '20px 0' } };
      case 'Text': return { ...base, content: 'Add your text here...', style: { ...base.style, color: '#4b5563', fontSize: '15px', lineHeight: '24px', margin: '10px 0' } };
      case 'Link': return { ...base, content: 'Click here', href: '#', style: { ...base.style, color: '#2563eb', textDecoration: 'underline' } };
      case 'Spacer': return { ...base, style: { height: '30px' } };
      case 'Button': return { ...base, content: 'Action Button', href: '#', style: { ...base.style, backgroundColor: '#000000', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', display: 'inline-block', fontWeight: 'bold' } };
      case 'Image': return { ...base, src: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena Logo', style: { ...base.style, width: '100%', height: 'auto', display: 'block' } };
      case 'Divider': return { ...base, style: { borderColor: '#e5e7eb', borderTopWidth: '1px', borderTopStyle: 'solid', margin: '20px 0' } };
      case 'Row': return {
        ...base, columns: [
          { id: `${id}-c1`, width: 50, blocks: [] },
          { id: `${id}-c2`, width: 50, blocks: [] }
        ], style: { gap: '20px', padding: '20px 0' }
      };
    }
    return base;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id.toString());
    setActiveDragData(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    setActiveDragData(null);
    const { active, over } = event;
    if (!over) return;

    const isSidebarItem = active.data.current?.isSidebarItem;
    const activeRawId = active.id.toString().replace(/^(canvas-|layer-|sidebar-)/, '');
    const overRawId = over.id.toString().replace(/^(canvas-|layer-)/, '');

    if (isSidebarItem) {
      pushStateToHistory();
      const newBlock = createNewBlock(active.data.current?.type as BlockType);
      if (over.id === 'canvas-droppable') {
        setBlocks(prev => [...prev, newBlock]);
      } else {
        const idx = blocks.findIndex(b => b.id === overRawId);
        if (idx !== -1) {
          const newB = [...blocks];
          newB.splice(idx, 0, newBlock);
          setBlocks(newB);
        }
      }
      setSelectedBlockId(newBlock.id);
    } else {
      if (activeRawId !== overRawId) {
        pushStateToHistory();
        setBlocks(prev => {
          const oldI = prev.findIndex(i => i.id === activeRawId);
          const newI = prev.findIndex(i => i.id === overRawId);
          return arrayMove(prev, oldI, newI);
        });
      }
    }
  };

  const removeBlockDeep = (blockList: Block[], id: string): Block[] => {
    return blockList.filter(b => b.id !== id).map(b => {
      if (b.columns) {
        return { ...b, columns: b.columns.map(c => ({ ...c, blocks: removeBlockDeep(c.blocks, id) })) };
      }
      return b;
    });
  };

  const updateBlockDeep = (blockList: Block[], id: string, updater: (b: Block) => Block): Block[] => {
    return blockList.map(b => {
      if (b.id === id) return updater(b);
      if (b.columns) {
        return { ...b, columns: b.columns.map(c => ({ ...c, blocks: updateBlockDeep(c.blocks, id, updater) })) };
      }
      return b;
    });
  };

  const removeBlock = (id: string) => {
    pushStateToHistory();
    setBlocks(prev => removeBlockDeep(prev, id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const updateBlockContent = (id: string, content: string) => {
    pushStateToHistory();
    setBlocks(prev => updateBlockDeep(prev, id, b => ({ ...b, content })));
  };

  const [codeLanguage, setCodeLanguage] = useState<'HTML' | 'React' | 'JSON'>('HTML');

  const generateHTMLCode = (blocks: Block[], settings: EmailSettings) => {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${tabs.find(t => t.id === activeTabId)?.name || 'Email Template'}</title>
    <style>
      body { margin: 0; padding: 0; background-color: ${settings.bodyBg}; font-family: ${settings.fontFamily}; }
      .container { width: 100%; max-width: ${settings.maxWidth}; margin: 0 auto; background-color: ${settings.containerBg}; padding: ${settings.padding}; border-radius: ${settings.borderRadius}; overflow: hidden; }
      @media only screen and (max-width: 600px) { .container { width: 100% !important; } }
    </style>
  </head>
  <body>
    <div class="container">
      ${blocks.map(b => {
      const style = { ...b.style };
      const styleString = Object.entries(style).map(([k, v]) => `${k.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}:${v}`).join(';');

      if (b.type === 'Heading') return `<h1 style="${styleString}">${b.content}</h1>`;
      if (b.type === 'Text') return `<p style="${styleString}">${b.content}</p>`;
      if (b.type === 'Image') return `<img src="${b.src}" alt="${b.alt}" style="${styleString}" />`;
      if (b.type === 'Button') return `<div style="text-align:${(b.style as any).textAlign || 'left'}"><a href="${b.href}" style="display:inline-block;text-decoration:none;${styleString}">${b.content}</a></div>`;
      if (b.type === 'Link') return `<a href="${b.href}" style="${styleString}">${b.content}</a>`;
      if (b.type === 'Divider') return `<hr style="${styleString}" />`;
      if (b.type === 'Spacer') return `<div style="height:${b.style?.height || '20px'}"></div>`;
      return '';
    }).join('')}
    </div>
  </body>
</html>`;
  };

  const generateJSXCode = (blocks: Block[], settings: EmailSettings) => {
    const renderBlockJSX = (b: Block, indent = 8) => {
      const space = ' '.repeat(indent);
      const styleObj = JSON.stringify(b.style).replace(/"([^"]+)":/g, '$1:');

      const tag = b.type === 'Heading' ? 'Heading' : b.type === 'Text' ? 'Text' : b.type === 'Image' ? 'Img' : b.type === 'Button' ? 'Button' : b.type === 'Link' ? 'Link' : b.type === 'Divider' ? 'Hr' : 'Section';
      const props = b.type === 'Image' ? `src="${b.src}" alt="${b.alt}" ` : (b.type === 'Button' || b.type === 'Link') ? `href="${b.href}" ` : b.type === 'Spacer' ? `style={{ height: '${b.style?.height || '20px'}' }} ` : '';
      const content = b.content ? `\n${space}  ${b.content}\n${space}` : '';

      return `${space}<${tag} ${props}style={${styleObj}}>${content}</${tag}>`;
    };

    return `import React from 'react';
import {
  Html, Head, Body, Container, Section, Text, Heading, Button, Img, Hr, Link
} from '@react-email/components';

export default function Email() {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '${settings.bodyBg}', fontFamily: '${settings.fontFamily}' }}>
        <Container style={{
          maxWidth: '${settings.maxWidth}',
          margin: '0 auto',
          backgroundColor: '${settings.containerBg}',
          padding: '${settings.padding}',
          borderRadius: '${settings.borderRadius}'
        }}>
          <Section style={{ padding: '0 20px' }}>
${blocks.map(b => renderBlockJSX(b)).join('\n')}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
`;
  };

  const previewCode = codeLanguage === 'HTML'
    ? generateHTMLCode(blocks, emailSettings)
    : codeLanguage === 'React'
      ? generateJSXCode(blocks, emailSettings)
      : JSON.stringify({ settings: emailSettings, blocks }, null, 2);

  const previewHtml = generateHTMLCode(blocks, emailSettings);

  const updateSelectedBlockStyle = (styleUpdates: Partial<React.CSSProperties>) => {
    if (!selectedBlockId) return;
    pushStateToHistory();
    setBlocks(prev => updateBlockDeep(prev, selectedBlockId, b => ({ ...b, style: { ...b.style, ...styleUpdates } })));
  };

  const updateEmailSettings = (updates: Partial<EmailSettings>) => {
    pushStateToHistory();
    setEmailSettings(updates);
  };

  const addElementToColumn = (rowId: string, colId: string, type: BlockType) => {
    pushStateToHistory();
    const newBlock = createNewBlock(type);
    setBlocks(prev => updateBlockDeep(prev, rowId, b => {
      if (!b.columns) return b;
      return {
        ...b,
        columns: b.columns.map(c => c.id === colId ? { ...c, blocks: [...c.blocks, newBlock] } : c)
      };
    }));
  };

  const removeElementFromColumn = (rowId: string, colId: string, blockId: string) => {
    pushStateToHistory();
    setBlocks(prev => updateBlockDeep(prev, rowId, b => {
      if (!b.columns) return b;
      return {
        ...b,
        columns: b.columns.map(c => c.id === colId ? { ...c, blocks: c.blocks.filter(cb => cb.id !== blockId) } : c)
      };
    }));
    if (selectedBlockId === blockId) setSelectedBlockId(rowId);
  };

  const handleResetCanvas = () => {
    pushStateToHistory();
    setBlocks([]);
    setSelectedBlockId(null);
    setShowResetModal(false);
  };

  const findBlockDeep = (blockList: Block[], id: string): Block | undefined => {
    for (const b of blockList) {
      if (b.id === id) return b;
      if (b.columns) {
        for (const c of b.columns) {
          const found = findBlockDeep(c.blocks, id);
          if (found) return found;
        }
      }
    }
    return undefined;
  };

  const selectedBlock = selectedBlockId ? findBlockDeep(blocks, selectedBlockId) : undefined;

  const addNewTab = () => {
    const newTab: CanvasTab = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Untitled ${tabs.length + 1}`,
      blocks: DEFAULT_BLOCKS,
      settings: DEFAULT_SETTINGS,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) setActiveTabId(newTabs[newTabs.length - 1].id);
  };

  const importTemplate = (template: any, inNewTab: boolean = false) => {
    if (inNewTab) {
      const newTab: CanvasTab = {
        id: Math.random().toString(36).substr(2, 9),
        name: template.name,
        blocks: template.blocks as Block[],
        settings: template.settings,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
    } else {
      pushStateToHistory();
      setBlocks(template.blocks as Block[]);
      setEmailSettings(template.settings);
    }
    setShowTemplates(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(previewCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const { setNodeRef: setCanvasRef, isOver: isCanvasOver } = useDroppable({ id: 'canvas-droppable' });

  const renderStyleInput = (label: string, property: string, placeholder = '', type = "text", obj: any = selectedBlock?.style, onChange: any = updateSelectedBlockStyle, isRoot = false) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">{label}</label>
      <input
        type={type}
        value={(obj?.[property] as string) || ''}
        onChange={(e) => onChange({ [property]: e.target.value })}
        className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 font-mono transition-colors"
        placeholder={placeholder}
      />
    </div>
  );

  const renderColorInput = (label: string, property: string, obj: any, setter: any) => (
    <div className="col-span-2 flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">{label}</label>
      <div className="flex gap-2 items-center">
        <div className="relative w-8 h-8 rounded border border-neutral-700 overflow-hidden shrink-0">
          <input type="color" value={(obj?.[property] as string) || '#000000'} onChange={(e) => setter({ [property]: e.target.value })} className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" />
        </div>
        <input type="text" value={(obj?.[property] as string) || ''} onChange={(e) => setter({ [property]: e.target.value })} className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 font-mono" />
      </div>
    </div>
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-[calc(100vh-80px)] w-full bg-neutral-950 overflow-hidden">

        {/* Tab Bar */}
        <div className="flex items-center bg-neutral-900 border-b border-neutral-800 px-2 overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <div
              key={t.id}
              onClick={() => setActiveTabId(t.id)}
              className={`flex items-center gap-3 px-4 py-2.5 text-xs font-semibold cursor-pointer border-r border-neutral-800 transition-all relative min-w-[140px] max-w-[200px] group
                ${activeTabId === t.id ? 'bg-neutral-950 text-brand-400' : 'text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300'}`}
            >
              <FileText className={`w-3.5 h-3.5 ${activeTabId === t.id ? 'text-brand-500' : 'text-neutral-600'}`} />
              <input
                value={t.name}
                onChange={(e) => setTabs(prev => prev.map(tab => tab.id === t.id ? { ...tab, name: e.target.value } : tab))}
                className="bg-transparent border-none outline-none w-24 truncate focus:ring-0 p-0"
                onClick={(e) => e.stopPropagation()}
              />
              <button onClick={(e) => closeTab(t.id, e)} className="ml-auto opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity">
                <X className="w-3 h-3" />
              </button>
              {activeTabId === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
            </div>
          ))}
          <button onClick={addNewTab} className="p-3 text-neutral-500 hover:text-white transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowTemplates(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-md transition-all border border-neutral-700/50">
              <LayoutTemplate className="w-3.5 h-3.5 text-brand-500" /> Templates
            </button>
            <div className="w-px h-6 bg-neutral-800" />
            <div className="flex bg-neutral-950 border border-neutral-800 rounded p-0.5 shadow-inner">
              <button onClick={handleUndo} disabled={past.length === 0} className="p-1.5 rounded-sm text-neutral-400 hover:text-white disabled:opacity-20 transition"><Undo2 className="w-4 h-4" /></button>
              <button onClick={handleRedo} disabled={future.length === 0} className="p-1.5 rounded-sm text-neutral-400 hover:text-white disabled:opacity-20 transition"><Redo2 className="w-4 h-4" /></button>
            </div>
            <button onClick={() => setShowResetModal(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>

          <div className="flex items-center gap-4">
            <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)} className="w-[180px]">
              <TabsList className="grid w-full grid-cols-2 bg-neutral-950 p-1 h-9">
                <TabsTrigger value="preview" className="text-[10px] font-bold uppercase tracking-tight"><Eye className="w-3 h-3 mr-2" />Design</TabsTrigger>
                <TabsTrigger value="code" className="text-[10px] font-bold uppercase tracking-tight"><Code2 className="w-3 h-3 mr-2" />Code</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="w-px h-6 bg-neutral-800" />
            <div className="flex items-center gap-2">
              <button onClick={() => setDeviceMode('desktop')} className={`p-2 rounded ${deviceMode === 'desktop' ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}><Monitor className="w-4 h-4" /></button>
              <button onClick={() => setDeviceMode('mobile')} className={`p-2 rounded ${deviceMode === 'mobile' ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}><Smartphone className="w-4 h-4" /></button>
            </div>
            <button onClick={() => setShowFullScreen(true)} className="p-2 text-neutral-500 hover:text-white transition-colors"><Maximize2 className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Elements Sidebar */}
          <div className="w-64 border-r border-neutral-800 bg-neutral-900/30 overflow-y-auto no-scrollbar p-4 flex flex-col gap-6">
            <div>
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Plus className="w-3 h-3 text-brand-500" /> New Elements
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <SidebarDraggableItem type="Heading" />
                <SidebarDraggableItem type="Text" />
                <SidebarDraggableItem type="Button" />
                <SidebarDraggableItem type="Image" />
                <SidebarDraggableItem type="Link" />
                <SidebarDraggableItem type="Spacer" />
                <div className="col-span-2">
                  <SidebarDraggableItem type="Divider" />
                </div>
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Layout className="w-3 h-3 text-brand-500" /> Layer Stack
              </h3>
              <SortableContext items={blocks.map(b => `layer-${b.id}`)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1">
                  {blocks.map(b => (
                    <SortableLayerItem key={b.id} block={b} isSelected={selectedBlockId === b.id} onSelect={() => setSelectedBlockId(b.id)} onDelete={() => removeBlock(b.id)} />
                  ))}
                  {blocks.length === 0 && (
                    <div className="py-12 border border-dashed border-neutral-800 rounded-xl flex flex-col items-center justify-center gap-2 text-neutral-600">
                      <LayoutTemplate className="w-8 h-8 opacity-20" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">Empty Canvas</span>
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden relative">
            {activeView === 'preview' ? (
              <div className="flex-1 overflow-y-auto no-scrollbar p-10 flex justify-center transition-colors duration-700" style={{ backgroundColor: themeMode === 'dark' ? '#020617' : emailSettings.bodyBg }}>
                <div
                  ref={setCanvasRef}
                  className={`h-fit min-h-[600px] transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white border-2 rounded-lg ${isCanvasOver && blocks.length === 0 ? 'border-brand-500 scale-[1.02]' : 'border-transparent'}`}
                  style={{
                    width: deviceMode === 'mobile' ? '320px' : '100%',
                    maxWidth: emailSettings.maxWidth,
                    backgroundColor: themeMode === 'dark' ? '#0f172a' : emailSettings.containerBg,
                    padding: `20px 0 60px 0`
                  }}
                  onClick={(e) => { e.stopPropagation(); setSelectedBlockId(null); }}
                >
                  <div style={{ padding: `0 ${emailSettings.padding}` }}>
                    <SortableContext items={blocks.map(b => `canvas-${b.id}`)} strategy={verticalListSortingStrategy}>
                      {blocks.map(b => (
                        <SortableCanvasItem
                          key={b.id}
                          block={b}
                          isSelected={selectedBlockId === b.id}
                          selectedBlockId={selectedBlockId}
                          onSelect={setSelectedBlockId}
                          themeMode={themeMode}
                          onUpdateContent={updateBlockContent}
                        />
                      ))}
                    </SortableContext>
                    {blocks.length === 0 && (
                      <div className="py-40 flex flex-col items-center justify-center gap-4 text-neutral-400">
                        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center animate-bounce">
                          <Plus className="w-8 h-8 text-neutral-300" />
                        </div>
                        <p className="text-sm font-medium">Drag an element here to start building</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-3 border-b border-neutral-800 bg-neutral-900/30 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand-400" />
                      <span className="text-xs font-bold text-neutral-300 tracking-tight">
                        {tabs.find(t => t.id === activeTabId)?.name || 'Untitled'}.{codeLanguage.toLowerCase() === 'react' ? 'jsx' : codeLanguage.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex items-center bg-neutral-800 p-0.5 rounded-lg border border-neutral-700">
                      {(['HTML', 'React', 'JSON'] as const).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setCodeLanguage(lang)}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${codeLanguage === lang ? 'bg-neutral-600 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleDownloadHtml} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-tight bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-all flex items-center gap-2 border border-neutral-700"><Download className="w-3.5 h-3.5" /> Export</button>
                    <button onClick={handleCopyCode} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-tight bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 rounded transition-all flex items-center gap-2 border border-brand-500/20"><Copy className="w-3.5 h-3.5" /> {copied ? 'Copied!' : `Copy ${codeLanguage}`}</button>
                  </div>
                </div>
                <div className="flex-1 bg-black p-6 overflow-y-auto custom-scrollbar min-h-0">
                  <SyntaxHighlighter
                    language={codeLanguage === 'React' ? 'jsx' : codeLanguage.toLowerCase()}
                    style={syntaxTheme}
                    customStyle={{
                      margin: 0,
                      padding: 0,
                      background: 'transparent',
                      fontSize: '11px',
                      lineHeight: '1.6',
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace'
                    }}
                    wrapLines={true}
                    wrapLongLines={true}
                  >
                    {previewCode}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}

            {/* Float Theme Toggle */}
            <div className="absolute bottom-6 right-6 flex bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-full p-1 shadow-2xl z-40">
              <button onClick={() => setThemeMode('light')} className={`p-2 rounded-full transition-all ${themeMode === 'light' ? 'bg-brand-500 text-brand-950 shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}><Sun className="w-4 h-4" /></button>
              <button onClick={() => setThemeMode('dark')} className={`p-2 rounded-full transition-all ${themeMode === 'dark' ? 'bg-brand-500 text-brand-950 shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}><Moon className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Properties Panel */}
          <div className="w-80 border-l border-neutral-800 bg-neutral-900/30 overflow-y-auto custom-scrollbar p-6">
            {selectedBlock ? (
              <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded bg-brand-500/10 text-brand-500">{getSidebarIcon(selectedBlock.type)}</div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-tighter">{selectedBlock.type}</h4>
                      <p className="text-[10px] text-neutral-500 font-mono tracking-tighter">{selectedBlock.id}</p>
                    </div>
                  </div>
                  <button onClick={() => removeBlock(selectedBlock.id)} className="p-2 text-neutral-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>

                <div className="flex flex-col gap-6">
                  {/* Content */}
                  <div className="flex flex-col gap-4">
                    <h5 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest border-b border-neutral-800 pb-2">Content</h5>
                    {(selectedBlock.type === 'Text' || selectedBlock.type === 'Heading' || selectedBlock.type === 'Button') && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">Label / Body</label>
                        <textarea value={selectedBlock.content} onChange={(e) => updateBlockContent(selectedBlock.id, e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 min-h-[80px]" />
                      </div>
                    )}
                    {(selectedBlock.type === 'Button' || selectedBlock.type === 'Link') && renderStyleInput('URL / Link', 'href', 'https://...', 'text', selectedBlock, (u: any) => setBlocks(prev => prev.map(b => b.id === selectedBlock.id ? { ...b, ...u } : b)), true)}
                    {selectedBlock.type === 'Image' && (
                      <>
                        {renderStyleInput('Source URL', 'src', 'https://...', 'text', selectedBlock, (u: any) => setBlocks(prev => prev.map(b => b.id === selectedBlock.id ? { ...b, ...u } : b)), true)}
                        {renderStyleInput('Alt Text', 'alt', 'Image description', 'text', selectedBlock, (u: any) => setBlocks(prev => prev.map(b => b.id === selectedBlock.id ? { ...b, ...u } : b)), true)}
                      </>
                    )}
                  </div>

                  {/* Styles */}
                  <div className="flex flex-col gap-4">
                    <h5 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest border-b border-neutral-800 pb-2">Appearance</h5>

                    {/* Text-based blocks */}
                    {(selectedBlock.type === 'Heading' || selectedBlock.type === 'Text' || selectedBlock.type === 'Button' || selectedBlock.type === 'Link') && (
                      <>
                        {renderColorInput('Text Color', 'color', selectedBlock.style, updateSelectedBlockStyle)}
                        <div className="grid grid-cols-2 gap-4">
                          {renderStyleInput('Font Size', 'fontSize', '16px')}
                          {renderStyleInput('Weight', 'fontWeight', 'bold', 'text', selectedBlock.style, updateSelectedBlockStyle)}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {renderStyleInput('Line Height', 'lineHeight', 'normal')}
                          {renderStyleInput('Letter Spacing', 'letterSpacing', 'normal')}
                        </div>
                        {renderStyleInput('Text Align', 'textAlign', 'left', 'text', selectedBlock.style, updateSelectedBlockStyle)}
                      </>
                    )}

                    {/* Block Backgrounds */}
                    {(selectedBlock.type === 'Button' || selectedBlock.type === 'Row') && (
                      renderColorInput('Background', 'backgroundColor', selectedBlock.style, updateSelectedBlockStyle)
                    )}

                    {/* Sizing & Borders */}
                    {(selectedBlock.type === 'Image' || selectedBlock.type === 'Button') && (
                      <div className="grid grid-cols-2 gap-4">
                        {renderStyleInput('Width', 'width', 'auto')}
                        {renderStyleInput('Height', 'height', 'auto')}
                      </div>
                    )}

                    {(selectedBlock.type === 'Image' || selectedBlock.type === 'Button' || selectedBlock.type === 'Row') && (
                      renderStyleInput('Border Radius', 'borderRadius', '0px')
                    )}

                    {selectedBlock.type === 'Divider' && (
                      <div className="grid grid-cols-2 gap-4">
                        {renderColorInput('Border Color', 'borderColor', selectedBlock.style, updateSelectedBlockStyle)}
                        {renderStyleInput('Border Width', 'borderTopWidth', '1px')}
                        {renderStyleInput('Border Style', 'borderTopStyle', 'solid')}
                      </div>
                    )}

                    {selectedBlock.type === 'Spacer' && (
                      renderStyleInput('Height', 'height', '20px')
                    )}

                    {selectedBlock.type === 'Row' && (
                      <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          {renderStyleInput('Gap', 'gap', '20px')}
                          {renderStyleInput('Layout', 'tableLayout', 'fixed')}
                        </div>
                        <h5 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest border-b border-neutral-800 pb-2 mt-4">Column Configuration</h5>
                        {selectedBlock.columns?.map((col, i) => (
                          <div key={col.id} className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Column {i + 1}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-neutral-600 font-bold uppercase">Width</span>
                                  <input
                                    type="number"
                                    value={col.width}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      setBlocks(prev => updateBlockDeep(prev, selectedBlock.id, b => ({
                                        ...b,
                                        columns: b.columns?.map(c => c.id === col.id ? { ...c, width: val } : c)
                                      })));
                                    }}
                                    className="w-12 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-[10px] text-brand-400 font-bold focus:outline-none focus:border-brand-500"
                                  />
                                  <span className="text-[9px] text-neutral-600 font-bold">%</span>
                                </div>
                              </div>
                              <div className="relative group">
                                <button className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-white px-2 py-1 rounded transition-colors flex items-center gap-1 font-bold">
                                  + Add <ChevronRight className="w-3 h-3 group-hover:rotate-90 transition-transform" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 w-32 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 flex flex-col p-1">
                                  {['Text', 'Heading', 'Image', 'Button', 'Link', 'Divider', 'Spacer'].map(type => (
                                    <button
                                      key={type}
                                      onClick={() => addElementToColumn(selectedBlock.id, col.id, type as BlockType)}
                                      className="text-left px-3 py-1.5 text-xs text-white hover:bg-brand-500 hover:text-brand-950 rounded transition-colors font-medium"
                                    >
                                      {type}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5 mt-1 border-t border-neutral-800 pt-2">
                              <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Nested Elements</span>
                              {col.blocks.length === 0 && (
                                <div className="text-[10px] text-neutral-600 italic px-2 py-1">No elements</div>
                              )}
                              {col.blocks.map(b => (
                                <div
                                  key={b.id}
                                  onClick={(e) => { e.stopPropagation(); setSelectedBlockId(b.id); }}
                                  className={`flex justify-between items-center px-2 py-1.5 rounded transition-colors cursor-pointer ${selectedBlockId === b.id ? 'bg-brand-500/20 text-brand-400' : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300'}`}
                                >
                                  <span className="text-[10px] font-medium flex items-center gap-2">
                                    <LayoutTemplate className="w-3 h-3 opacity-50" /> {b.type}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeElementFromColumn(selectedBlock.id, col.id, b.id); }}
                                    className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Spacing */}
                  <div className="flex flex-col gap-4">
                    <h5 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest border-b border-neutral-800 pb-2">Spacing</h5>
                    <div className="grid grid-cols-2 gap-4">
                      {renderStyleInput('Margin T', 'marginTop', '0px')}
                      {renderStyleInput('Margin B', 'marginBottom', '0px')}
                      {renderStyleInput('Padding T', 'paddingTop', '0px')}
                      {renderStyleInput('Padding B', 'paddingBottom', '0px')}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <h3 className="text-xs font-bold text-white uppercase tracking-tighter flex items-center gap-2">
                  <Globe className="w-4 h-4 text-brand-500" /> Global Styles
                </h3>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-6">
                    {renderColorInput('Outer Background', 'bodyBg', emailSettings, updateEmailSettings)}
                    {renderColorInput('Canvas Background', 'containerBg', emailSettings, updateEmailSettings)}
                    {renderStyleInput('Container BG Image', 'backgroundImage', 'url(...)', 'text', emailSettings, updateEmailSettings)}
                    {renderStyleInput('Max Width', 'maxWidth', '600px', 'text', emailSettings, updateEmailSettings)}
                    {renderStyleInput('Canvas Border Radius', 'borderRadius', '8px', 'text', emailSettings, updateEmailSettings)}
                    {renderStyleInput('Canvas Horizontal Padding', 'padding', '40px', 'text', emailSettings, updateEmailSettings)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
          {activeDragId && activeDragData?.isSidebarItem && (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-brand-500 bg-neutral-900 shadow-2xl text-white opacity-90 scale-105 ring-4 ring-brand-500/10">
              {getSidebarIcon(activeDragData.type)}
              <span className="text-xs font-bold uppercase tracking-tight">{activeDragData.type}</span>
            </div>
          )}
          {activeDragId && activeDragData?.isCanvasItem && (
            <div className="bg-brand-500/10 border-2 border-brand-500/50 rounded shadow-2xl p-4 opacity-80 backdrop-blur-md">
              <span className="text-xs font-bold text-brand-400 bg-neutral-950 px-3 py-1.5 rounded uppercase tracking-tighter">Moving {activeDragData.block.type}</span>
            </div>
          )}
        </DragOverlay>

        {/* Templates Modal */}
        {showTemplates && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center p-4 md:p-12 animate-in fade-in duration-300">
            <button onClick={() => setShowTemplates(false)} className="absolute top-4 right-4 md:top-10 md:right-10 p-3 bg-neutral-800 hover:bg-neutral-700 rounded-full transition-all z-[110] shadow-2xl"><X className="w-5 h-5 md:w-6 md:h-6 text-white" /></button>
            <div className="max-w-7xl w-full flex flex-col gap-6 md:gap-8 flex-1 min-h-0 pt-10">
              <div className="shrink-0 text-center md:text-left">
                <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-2 tracking-tighter bg-gradient-to-r from-white to-neutral-500 bg-clip-text text-transparent">Template Library</h2>
                <p className="text-neutral-400 font-medium tracking-tight text-sm md:text-lg">Select a professionally designed starting point.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 overflow-y-auto p-2 md:p-6 custom-scrollbar flex-1 min-h-0 pb-40">
                {EMAIL_TEMPLATES.map((t, i) => (
                  <div
                    key={i}
                    className="group relative bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-brand-500 transition-all shadow-2xl flex flex-col min-h-[400px] md:min-h-[450px]"
                  >
                    <div className="flex-1 bg-neutral-950 overflow-hidden relative w-full border-b border-neutral-800">
                      {/* Preview Mini Render - Simulated */}
                      <div className="origin-top scale-[0.35] sm:scale-[0.4] w-[280%] sm:w-[250%] opacity-40 group-hover:opacity-100 transition-all duration-700 absolute top-6 left-1/2 -translate-x-1/2">
                        <div style={{ backgroundColor: t.settings.bodyBg, padding: '20px', minHeight: '1000px' }}>
                          <div style={{ backgroundColor: t.settings.containerBg, padding: '20px', borderRadius: t.settings.borderRadius, margin: '0 auto', maxWidth: t.settings.maxWidth }}>
                            {t.blocks.map(b => (
                              <div key={b.id} style={{ ...b.style, marginBottom: '10px' }}>{b.content || b.type}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-60" />

                      {/* Action Buttons overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 gap-4 bg-black/60 backdrop-blur-[2px] z-10 translate-y-4 group-hover:translate-y-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); importTemplate(t, false); }}
                          className="w-[80%] px-4 py-3 bg-brand-500 hover:bg-white text-brand-950 font-bold rounded-xl shadow-2xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95"
                        >
                          <LayoutTemplate className="w-4 h-4" /> Use Template
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); importTemplate(t, true); }}
                          className="w-[80%] px-4 py-3 bg-neutral-800/80 hover:bg-neutral-700 text-white font-bold rounded-xl shadow-2xl flex items-center justify-center gap-2 border border-neutral-700 backdrop-blur-md transition-all transform hover:scale-[1.02] active:scale-95"
                        >
                          <Plus className="w-4 h-4" /> Open New Tab
                        </button>
                      </div>
                    </div>
                    <div className="p-5 bg-neutral-900 flex justify-between items-center shrink-0 z-20">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-white tracking-tight text-base">{t.name}</span>
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{t.blocks.length} Elements</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reset Modal */}
        {showResetModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center animate-in fade-in">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl scale-in-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                <RotateCcw className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Clear Canvas?</h3>
              <p className="text-neutral-400 text-sm leading-relaxed mb-8">This will wipe everything on the current tab. This action can be undone with Ctrl+Z.</p>
              <div className="flex gap-4">
                <button onClick={() => setShowResetModal(false)} className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold text-xs transition-all tracking-tight">Cancel</button>
                <button onClick={handleResetCanvas} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs transition-all tracking-tight shadow-lg shadow-red-500/20">Yes, Clear</button>
              </div>
            </div>
          </div>
        )}

        {/* Full Screen Preview */}
        {showFullScreen && (
          <div className="fixed inset-0 z-[200] bg-neutral-950 flex flex-col animate-in slide-in-from-bottom-10">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-900">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">{activeTab.name} — Full Preview</h2>
                <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded p-0.5">
                  <button onClick={() => setDeviceMode('desktop')} className={`p-2 rounded ${deviceMode === 'desktop' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}><Monitor className="w-4 h-4" /></button>
                  <button onClick={() => setDeviceMode('mobile')} className={`p-2 rounded ${deviceMode === 'mobile' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}><Smartphone className="w-4 h-4" /></button>
                </div>
              </div>
              <button onClick={() => setShowFullScreen(false)} className="p-2 bg-neutral-800 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-20 flex justify-center bg-neutral-950 no-scrollbar">
              <div
                className="shadow-2xl h-fit border border-neutral-800 rounded-xl overflow-hidden transition-all duration-700"
                style={{ width: deviceMode === 'mobile' ? '320px' : '100%', maxWidth: emailSettings.maxWidth, backgroundColor: emailSettings.bodyBg }}
              >
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </div>
        )}

      </div>
    </DndContext>
  );
}

const getSidebarIcon = (type: BlockType) => {
  switch (type) {
    case 'Heading': return <Type className="w-4 h-4" />;
    case 'Text': return <TypeIcon className="w-4 h-4" />;
    case 'Button': return <MousePointerClick className="w-4 h-4" />;
    case 'Image': return <ImageIcon className="w-4 h-4" />;
    case 'Link': return <Link2 className="w-4 h-4" />;
    case 'Spacer': return <Space className="w-4 h-4" />;
    case 'Divider': return <Minus className="w-4 h-4" />;
    case 'Row': return <Columns className="w-4 h-4" />;
    default: return <Plus className="w-4 h-4" />;
  }
};
