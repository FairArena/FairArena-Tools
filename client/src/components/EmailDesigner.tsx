import React, { useState, useEffect, useCallback } from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Button,
  Img,
  Hr,
  Link,
} from '@react-email/components';
import { render } from '@react-email/render';
import reactElementToJSXString from 'react-element-to-jsx-string';
import {
  Type,
  Image as ImageIcon,
  MousePointerClick,
  Minus,
  Settings2,
  Code2,
  Eye,
  Trash2,
  LayoutTemplate,
  GripVertical,
  Palette,
  Layout,
  Type as TypeIcon,
  BoxSelect,
  Monitor,
  Smartphone,
  Moon,
  Sun,
  Copy,
  Download,
  Link2,
  Space,
  Globe,
  Plus,
  Undo2,
  Redo2,
  RotateCcw
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// DnD Kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Types ---
type BlockType = 'Heading' | 'Text' | 'Button' | 'Image' | 'Divider' | 'Link' | 'Spacer';

interface Block {
  id: string;
  type: BlockType;
  content?: string;
  href?: string;
  src?: string;
  alt?: string;
  style?: React.CSSProperties;
}

interface EmailSettings {
  bodyBg: string;
  containerBg: string;
  maxWidth: string;
  fontFamily: string;
  padding: string;
}

interface HistoryState {
  blocks: Block[];
  emailSettings: EmailSettings;
}

const DEFAULT_BLOCKS: Block[] = [
  {
    id: '1',
    type: 'Image',
    src: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin',
    alt: 'FairArena Logo',
    style: { width: '80px', height: 'auto', margin: '0 auto', display: 'block' }
  },
  {
    id: '2',
    type: 'Heading',
    content: 'Welcome to FairArena',
    style: { color: '#111827', textAlign: 'center', fontSize: '28px', fontWeight: 'bold', margin: '30px 0 10px 0', fontFamily: 'sans-serif' }
  },
  {
    id: '3',
    type: 'Text',
    content: 'We are thrilled to have you on board. Start building amazing hackathons and tools with our new platform features.',
    style: { color: '#4b5563', fontSize: '16px', lineHeight: '26px', textAlign: 'center', margin: '0 0 20px 0', fontFamily: 'sans-serif' }
  },
  {
    id: '4',
    type: 'Button',
    content: 'Get Started Today',
    href: 'https://fairarena.app',
    style: { backgroundColor: '#000000', color: '#ffffff', padding: '14px 24px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block', textAlign: 'center', marginTop: '10px', fontWeight: 'bold', fontFamily: 'sans-serif' }
  },
  {
    id: '5',
    type: 'Divider',
    style: { borderColor: '#e5e7eb', margin: '40px 0', borderTopWidth: '1px', borderTopStyle: 'solid' }
  },
  {
    id: '6',
    type: 'Text',
    content: '© 2026 FairArena. All rights reserved.',
    style: { color: '#9ca3af', fontSize: '12px', textAlign: 'center', fontFamily: 'sans-serif' }
  }
];

const DEFAULT_SETTINGS: EmailSettings = {
  bodyBg: '#f6f9fc',
  containerBg: '#ffffff',
  maxWidth: '600px',
  fontFamily: 'sans-serif',
  padding: '40px'
};

const FONTS = [
  "sans-serif", "serif", "monospace", "Arial, sans-serif", "Helvetica, sans-serif", "'Times New Roman', serif", "'Courier New', monospace", "'Roboto', sans-serif", "'Open Sans', sans-serif", "Inter, sans-serif"
];

const getSidebarIcon = (type: BlockType) => {
  switch (type) {
    case 'Heading': return <Type className="w-5 h-5" />;
    case 'Text': return <TypeIcon className="w-5 h-5" />;
    case 'Button': return <MousePointerClick className="w-5 h-5" />;
    case 'Image': return <ImageIcon className="w-5 h-5" />;
    case 'Link': return <Link2 className="w-5 h-5" />;
    case 'Spacer': return <Space className="w-5 h-5" />;
    case 'Divider': return <Minus className="w-5 h-5" />;
    default: return <Plus className="w-5 h-5" />;
  }
};

// --- Sidebar Draggable Component ---
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
      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-neutral-800 bg-neutral-900 transition-colors group cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-50 border-brand-500' : 'hover:border-brand-500 hover:bg-brand-500/10'}`}
    >
      <div className="text-neutral-400 group-hover:text-brand-500">{getSidebarIcon(type)}</div>
      <span className="text-xs font-medium text-neutral-300">{type}</span>
    </div>
  );
}

// --- Sortable Layer Item Component ---
function SortableLayerItem({ block, isSelected, onSelect, onDelete }: { block: Block, isSelected: boolean, onSelect: () => void, onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `layer-${block.id}`, data: { isLayerItem: true, block } });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1 };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`flex items-center justify-between p-2 mb-1 rounded border text-xs transition-colors cursor-pointer
        ${isSelected ? 'border-brand-500 bg-brand-500/10 text-brand-400' : 'border-neutral-800 hover:border-neutral-600 bg-neutral-900 text-neutral-300'}
        ${isDragging ? 'opacity-50' : 'opacity-100'}
      `}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="flex items-center gap-2 flex-1 overflow-hidden">
        <div {...attributes} {...listeners} className="cursor-grab hover:text-white p-1 -ml-1 text-neutral-500">
          <GripVertical className="w-3 h-3" />
        </div>
        <span className="truncate font-medium">{block.type}</span>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 hover:text-red-400 text-neutral-500 transition-colors" title="Delete">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// --- Sortable Canvas Item Component (FIXES HOOK CRASH) ---
function SortableCanvasItem({ block, isSelected, onSelect, themeMode }: { block: Block, isSelected: boolean, onSelect: () => void, themeMode: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: `canvas-${block.id}`,
    data: { isCanvasItem: true, block }
  });

  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 1, opacity: isDragging ? 0.4 : 1 };
  
  const wrapperClass = `relative group transition-all cursor-pointer rounded-sm outline-2 outline-offset-2 
    ${isSelected ? 'outline outline-brand-500 z-10' : 'hover:outline hover:outline-dashed hover:outline-brand-500/50 hover:bg-brand-500/5'}`;

  // Dark Mode Adjustments
  let computedStyle = { ...block.style };
  if (themeMode === 'dark') {
    // Attempt to invert common dark text to white, or soft gray
    if (computedStyle.color === '#000000' || computedStyle.color === '#111827') computedStyle.color = '#f8fafc';
    if (computedStyle.color === '#4b5563' || computedStyle.color === '#444' || computedStyle.color === '#333') computedStyle.color = '#cbd5e1';
    if (computedStyle.backgroundColor === '#000000') computedStyle.backgroundColor = '#1e293b';
  }

  let innerContent = null;
  switch (block.type) {
    case 'Heading': innerContent = <h1 style={computedStyle}>{block.content}</h1>; break;
    case 'Text': innerContent = <p style={computedStyle}>{block.content}</p>; break;
    case 'Link': innerContent = <a href={block.href || '#'} style={computedStyle} onClick={(e) => e.preventDefault()}>{block.content}</a>; break;
    case 'Spacer': innerContent = <div style={{ height: computedStyle.height || '20px', width: '100%' }} />; break;
    case 'Button': innerContent = <div style={{ textAlign: (computedStyle as any).textAlign || 'center', width: '100%' }}><a href={block.href || '#'} style={computedStyle} onClick={(e) => e.preventDefault()}>{block.content}</a></div>; break;
    case 'Image': innerContent = <img src={block.src} alt={block.alt} style={computedStyle} />; break;
    case 'Divider': innerContent = <hr style={computedStyle} />; break;
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={wrapperClass}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {isSelected && (
        <div className="absolute -top-6 left-0 bg-brand-500 text-brand-950 text-[10px] font-bold px-2 py-0.5 rounded-t-sm shadow-sm z-20 flex items-center gap-1">
          <LayoutTemplate className="w-3 h-3" /> {block.type}
        </div>
      )}
      {innerContent}
    </div>
  );
}


export function EmailDesigner() {
  // Initialization with LocalStorage
  const [blocks, setBlocks] = useState<Block[]>(() => {
    try {
      const saved = localStorage.getItem('fairarena_email_blocks');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return DEFAULT_BLOCKS;
  });
  
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(() => {
    try {
      const saved = localStorage.getItem('fairarena_email_settings');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return DEFAULT_SETTINGS;
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  
  // Undo / Redo History
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  const pushStateToHistory = useCallback(() => {
    setPast(prev => [...prev, { blocks, emailSettings }]);
    setFuture([]); // Clear future on new action
  }, [blocks, emailSettings]);

  const handleUndo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    setFuture(prev => [{ blocks, emailSettings }, ...prev]);
    setPast(newPast);
    setBlocks(previous.blocks);
    setEmailSettings(previous.emailSettings);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast(prev => [...prev, { blocks, emailSettings }]);
    setFuture(newFuture);
    setBlocks(next.blocks);
    setEmailSettings(next.emailSettings);
  };

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('fairarena_email_blocks', JSON.stringify(blocks));
    localStorage.setItem('fairarena_email_settings', JSON.stringify(emailSettings));
  }, [blocks, emailSettings]);

  // Views and Previews
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewCode, setPreviewCode] = useState<string>('');
  const [activeView, setActiveView] = useState<'preview' | 'code'>('preview');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  
  // Drag state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<any>(null);

  // Modals
  const [showResetModal, setShowResetModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const createNewBlock = (type: BlockType): Block => {
    const newBlock: Block = { id: Math.random().toString(36).substr(2, 9), type, style: { fontFamily: emailSettings.fontFamily } };
    switch (type) {
      case 'Heading': newBlock.content = 'New Heading'; newBlock.style = { ...newBlock.style, color: '#111827', fontSize: '24px', fontWeight: 'bold', margin: '20px 0' }; break;
      case 'Text': newBlock.content = 'Add your text here...'; newBlock.style = { ...newBlock.style, color: '#4b5563', fontSize: '15px', lineHeight: '24px', margin: '10px 0' }; break;
      case 'Link': newBlock.content = 'Click here'; newBlock.href = '#'; newBlock.style = { ...newBlock.style, color: '#2563eb', textDecoration: 'underline', fontSize: '15px' }; break;
      case 'Spacer': newBlock.style = { height: '30px' }; break;
      case 'Button': newBlock.content = 'Click Me'; newBlock.href = '#'; newBlock.style = { ...newBlock.style, backgroundColor: '#000000', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', display: 'inline-block', fontWeight: 'bold' }; break;
      case 'Image': newBlock.src = 'https://react.email/static/vercel-logo.png'; newBlock.style = { ...newBlock.style, width: '100px', height: 'auto', margin: '0 auto', display: 'block' }; break;
      case 'Divider': newBlock.style = { ...newBlock.style, borderColor: '#e5e7eb', margin: '20px 0', borderTopWidth: '1px', borderTopStyle: 'solid' }; break;
    }
    return newBlock;
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
      const type = active.data.current?.type as BlockType;
      const newBlock = createNewBlock(type);
      
      if (over.id === 'canvas-droppable') {
        setBlocks([...blocks, newBlock]);
      } else {
        const overIndex = blocks.findIndex(b => b.id === overRawId);
        if (overIndex !== -1) {
          const newBlocks = [...blocks];
          newBlocks.splice(overIndex, 0, newBlock);
          setBlocks(newBlocks);
        }
      }
      setSelectedBlockId(newBlock.id);
    } else {
      if (activeRawId !== overRawId) {
        pushStateToHistory();
        setBlocks((items) => {
          const oldIndex = items.findIndex((i) => i.id === activeRawId);
          const newIndex = items.findIndex((i) => i.id === overRawId);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
  };

  const generateEmailElement = () => {
    const content = (
      <Container style={{ backgroundColor: emailSettings.containerBg, margin: '0 auto', padding: '20px 0 48px', borderRadius: '8px', overflow: 'hidden', maxWidth: emailSettings.maxWidth }}>
        <Section style={{ padding: `0 ${emailSettings.padding}` }}>
          {blocks.map((block) => {
            switch (block.type) {
              case 'Heading': return <Heading key={block.id} style={block.style}>{block.content}</Heading>;
              case 'Text': return <Text key={block.id} style={block.style}>{block.content}</Text>;
              case 'Link': return <Link key={block.id} href={block.href} style={block.style}>{block.content}</Link>;
              case 'Spacer': return <Section key={block.id} style={{ height: block.style?.height || '20px' }}></Section>;
              case 'Button': return <Section key={block.id} style={{ textAlign: (block.style as any)?.textAlign || 'center' }}><Button href={block.href} style={block.style}>{block.content}</Button></Section>;
              case 'Image': return <Img key={block.id} src={block.src} alt={block.alt} style={block.style} />;
              case 'Divider': return <Hr key={block.id} style={block.style} />;
              default: return null;
            }
          })}
        </Section>
      </Container>
    );

    return (
      <Html>
        <Head />
        <Body style={{ backgroundColor: emailSettings.bodyBg, fontFamily: emailSettings.fontFamily }}>
          {content}
        </Body>
      </Html>
    );
  };

  useEffect(() => {
    const updatePreview = async () => {
      try {
        const element = generateEmailElement();
        const html = await render(element);
        setPreviewHtml(html);
        
        const jsxString = reactElementToJSXString(element, { showFunctions: false, maxInlineAttributesLineLength: 100 });
        const boilerplate = `import {\n  Html,\n  Head,\n  Body,\n  Container,\n  Section,\n  Text,\n  Heading,\n  Button,\n  Img,\n  Hr,\n  Link\n} from '@react-email/components';\n\nexport default function CustomEmail() {\n  return (\n${jsxString.split('\\n').map(l => '    ' + l).join('\\n')}\n  );\n}`;
        setPreviewCode(boilerplate);
      } catch (err) {
        console.error('Error rendering email:', err);
      }
    };
    const timeout = setTimeout(updatePreview, 300);
    return () => clearTimeout(timeout);
  }, [blocks, emailSettings]);

  const removeBlock = (id: string) => {
    pushStateToHistory();
    setBlocks(blocks.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const updateSelectedBlock = (updates: Partial<Block>) => {
    if (!selectedBlockId) return;
    pushStateToHistory();
    setBlocks(blocks.map(b => b.id === selectedBlockId ? { ...b, ...updates } : b));
  };

  const updateSelectedBlockStyle = (styleUpdates: Partial<React.CSSProperties>) => {
    if (!selectedBlockId) return;
    pushStateToHistory();
    setBlocks(blocks.map(b => b.id === selectedBlockId ? { ...b, style: { ...b.style, ...styleUpdates } } : b));
  };

  const updateEmailSettings = (updates: Partial<EmailSettings>) => {
    pushStateToHistory();
    setEmailSettings({ ...emailSettings, ...updates });
  };

  const handleResetCanvas = () => {
    pushStateToHistory();
    setBlocks([]);
    setSelectedBlockId(null);
    setShowResetModal(false);
  };

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

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

  const renderStyleInput = (label: string, property: keyof React.CSSProperties, placeholder: string = '', type: string = "text", obj: any = selectedBlock?.style, onChange: any = updateSelectedBlockStyle) => {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">{label}</label>
        <input 
          type={type}
          value={(obj?.[property] as string) || ''}
          onChange={(e) => onChange({ [property]: e.target.value })}
          className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 font-mono transition-colors"
          placeholder={placeholder}
        />
      </div>
    );
  };

  const renderColorInput = (label: string, property: string, obj: any, setter: any, placeholder: string) => (
    <div className="col-span-2 flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">{label}</label>
      <div className="flex gap-2 items-center">
        <div className="relative w-8 h-8 rounded border border-neutral-700 overflow-hidden shrink-0">
          <input 
            type="color"
            value={(obj?.[property] as string) || '#000000'}
            onChange={(e) => setter({ [property]: e.target.value })}
            className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
          />
        </div>
        <input 
          type="text"
          value={(obj?.[property] as string) || ''}
          onChange={(e) => setter({ [property]: e.target.value })}
          className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 font-mono"
          placeholder={placeholder}
        />
      </div>
    </div>
  );

  // Canvas Droppable Wrapper
  const { setNodeRef: setCanvasRef, isOver: isCanvasOver } = useDroppable({ id: 'canvas-droppable' });

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex h-[calc(100vh-120px)] gap-4 w-full" onClick={() => setSelectedBlockId(null)}>
          
          {/* Left Sidebar - Blocks & Layers */}
          <div className="w-64 bg-neutral-900/50 border border-neutral-800 rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/80 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-brand-500" />
                Elements
              </h2>
              <button 
                onClick={() => setSelectedBlockId(null)}
                className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition"
                title="Global Settings"
              >
                <Globe className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
              {/* Add Blocks Grid (Draggable) */}
              <div className="grid grid-cols-2 gap-2 mb-4">
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
              
              <div className="mt-2 border-t border-neutral-800 pt-4">
                <h3 className="text-xs font-semibold text-neutral-500 mb-3 uppercase tracking-wider flex justify-between items-center">
                  Layers 
                  <span className="text-[10px] text-neutral-600 font-normal normal-case border border-neutral-800 px-1.5 py-0.5 rounded">Drag to reorder</span>
                </h3>
                
                <SortableContext items={blocks.map(b => `layer-${b.id}`)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-1">
                    {blocks.map((block) => (
                      <SortableLayerItem 
                        key={block.id} 
                        block={block} 
                        isSelected={selectedBlockId === block.id}
                        onSelect={() => setSelectedBlockId(block.id)}
                        onDelete={() => removeBlock(block.id)}
                      />
                    ))}
                    {blocks.length === 0 && (
                      <div className="text-xs text-neutral-600 text-center py-4 border border-dashed border-neutral-800 rounded">
                        No layers yet. Drag elements here.
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            </div>
          </div>

          {/* Center - Interactive Preview / Code */}
          <div className="flex-1 bg-neutral-900/30 border border-neutral-800 rounded-xl flex flex-col overflow-hidden">
            <div className="p-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/80" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)} className="w-[200px]">
                  <TabsList className="grid w-full grid-cols-2 bg-neutral-950">
                    <TabsTrigger value="preview" className="text-xs data-[state=active]:bg-neutral-800"><Eye className="w-3 h-3 mr-2"/>Preview</TabsTrigger>
                    <TabsTrigger value="code" className="text-xs data-[state=active]:bg-neutral-800"><Code2 className="w-3 h-3 mr-2"/>Code</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* History Controls */}
                <div className="flex bg-neutral-950 border border-neutral-800 rounded p-0.5 ml-2">
                  <button onClick={handleUndo} disabled={past.length === 0} className="p-1.5 rounded-sm text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition" title="Undo"><Undo2 className="w-4 h-4" /></button>
                  <button onClick={handleRedo} disabled={future.length === 0} className="p-1.5 rounded-sm text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition" title="Redo"><Redo2 className="w-4 h-4" /></button>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Reset Button */}
                <button onClick={() => setShowResetModal(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded transition-colors">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <div className="w-px h-6 bg-neutral-800 mx-1"></div>

                {/* Device & Theme Toggles */}
                {activeView === 'preview' ? (
                  <>
                    <div className="flex bg-neutral-950 border border-neutral-800 rounded p-0.5">
                      <button onClick={() => setDeviceMode('desktop')} className={`p-1.5 rounded-sm ${deviceMode === 'desktop' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}><Monitor className="w-4 h-4" /></button>
                      <button onClick={() => setDeviceMode('mobile')} className={`p-1.5 rounded-sm ${deviceMode === 'mobile' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}><Smartphone className="w-4 h-4" /></button>
                    </div>
                    <div className="flex bg-neutral-950 border border-neutral-800 rounded p-0.5">
                      <button onClick={() => setThemeMode('light')} className={`p-1.5 rounded-sm ${themeMode === 'light' ? 'bg-neutral-800 text-yellow-400' : 'text-neutral-500 hover:text-neutral-300'}`}><Sun className="w-4 h-4" /></button>
                      <button onClick={() => setThemeMode('dark')} className={`p-1.5 rounded-sm ${themeMode === 'dark' ? 'bg-neutral-800 text-blue-400' : 'text-neutral-500 hover:text-neutral-300'}`}><Moon className="w-4 h-4" /></button>
                    </div>
                  </>
                ) : (
                  <>
                    <button onClick={handleDownloadHtml} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-300 transition-colors">
                      <Download className="w-3 h-3" /> HTML
                    </button>
                    <button onClick={handleCopyCode} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-brand-400 rounded transition-colors">
                      <Copy className="w-3 h-3" /> {copied ? 'Copied!' : 'Copy JSX'}
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden relative bg-neutral-950">
              {activeView === 'preview' ? (
                <div className="w-full h-full overflow-y-auto flex justify-center py-10 transition-colors duration-500" style={{ backgroundColor: themeMode === 'dark' ? '#0f172a' : emailSettings.bodyBg }} onClick={() => setSelectedBlockId(null)}>
                  
                  {/* Droppable Canvas Wrapper */}
                  <div 
                    ref={setCanvasRef}
                    className={`shadow-xl transition-all duration-300 h-fit min-h-[400px] border-2 ${isCanvasOver && blocks.length === 0 ? 'border-brand-500 bg-brand-500/5' : 'border-transparent'}`}
                    style={{ 
                      backgroundColor: themeMode === 'dark' ? '#1e293b' : emailSettings.containerBg,
                      width: deviceMode === 'mobile' ? '320px' : '100%',
                      maxWidth: emailSettings.maxWidth,
                      padding: `20px 0 48px`,
                      borderRadius: '8px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col" style={{ padding: `0 ${emailSettings.padding}` }}>
                      <SortableContext items={blocks.map(b => `canvas-${b.id}`)} strategy={verticalListSortingStrategy}>
                        {blocks.map((block) => (
                          <SortableCanvasItem 
                            key={block.id} 
                            block={block} 
                            isSelected={selectedBlockId === block.id}
                            onSelect={() => setSelectedBlockId(block.id)}
                            themeMode={themeMode}
                          />
                        ))}
                      </SortableContext>
                      
                      {blocks.length === 0 && (
                        <div className="py-20 text-center text-neutral-400 border-2 border-dashed border-neutral-200 rounded-lg">
                          Drag elements here from the left panel
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="w-full h-full p-4 overflow-auto bg-[#0d1117]" onClick={(e) => e.stopPropagation()}>
                  <pre className="text-sm text-neutral-300 font-mono">
                    <code>{previewCode}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Granular Properties */}
          <div className="w-80 bg-neutral-900/50 border border-neutral-800 rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/80">
              <h2 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-brand-500" />
                {selectedBlock ? 'Block Properties' : 'Global Settings'}
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
              {selectedBlock ? (
                <div className="flex flex-col">
                  {/* Header Info */}
                  <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-900/30">
                    <span className="text-[10px] font-medium text-neutral-500 uppercase">ID: {selectedBlock.id}</span>
                    <span className="text-xs font-bold text-brand-400 bg-brand-500/10 px-3 py-1 rounded-full border border-brand-500/20 shadow-[0_0_10px_rgba(217,255,0,0.1)]">{selectedBlock.type}</span>
                  </div>
                  
                  {/* --- CONTENT SECTION --- */}
                  <div className="p-4 border-b border-neutral-800">
                    <h3 className="text-xs font-bold text-white mb-4 flex items-center gap-2"><Layout className="w-3.5 h-3.5 text-brand-500" /> Content</h3>
                    
                    <div className="flex flex-col gap-4">
                      {(selectedBlock.type === 'Text' || selectedBlock.type === 'Heading' || selectedBlock.type === 'Button') && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Text Content</label>
                          <textarea 
                            value={selectedBlock.content || ''}
                            onChange={(e) => updateSelectedBlock({ content: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-brand-500 min-h-[80px] transition-colors"
                          />
                        </div>
                      )}
                      
                      {(selectedBlock.type === 'Button' || selectedBlock.type === 'Link') && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Link URL</label>
                          <input 
                            type="url"
                            value={selectedBlock.href || ''}
                            onChange={(e) => updateSelectedBlock({ href: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 font-mono"
                            placeholder="https://"
                          />
                        </div>
                      )}

                      {selectedBlock.type === 'Link' && (
                        <div className="flex flex-col gap-1.5 mt-2">
                          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Link Text</label>
                          <input 
                            type="text"
                            value={selectedBlock.content || ''}
                            onChange={(e) => updateSelectedBlock({ content: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500"
                          />
                        </div>
                      )}
                      
                      {selectedBlock.type === 'Image' && (
                        <>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Image Source URL</label>
                            <input 
                              type="url"
                              value={selectedBlock.src || ''}
                              onChange={(e) => updateSelectedBlock({ src: e.target.value })}
                              className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 font-mono"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Alt Text</label>
                            <input 
                              type="text"
                              value={selectedBlock.alt || ''}
                              onChange={(e) => updateSelectedBlock({ alt: e.target.value })}
                              className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* --- TYPOGRAPHY SECTION --- */}
                  {selectedBlock.type !== 'Spacer' && selectedBlock.type !== 'Divider' && selectedBlock.type !== 'Image' && (
                    <div className="p-4 border-b border-neutral-800">
                      <h3 className="text-xs font-bold text-white mb-4 flex items-center gap-2"><TypeIcon className="w-3.5 h-3.5 text-brand-500" /> Typography</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Font Family</label>
                          <select 
                            value={(selectedBlock.style?.fontFamily as string) || ''}
                            onChange={(e) => updateSelectedBlockStyle({ fontFamily: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500"
                          >
                            <option value="">Default Theme Font</option>
                            {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0].replace(/'/g, '')}</option>)}
                          </select>
                        </div>
                        
                        {renderStyleInput('Font Size', 'fontSize', '16px')}
                        {renderStyleInput('Line Height', 'lineHeight', '24px')}
                        
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Font Weight</label>
                          <select 
                            value={(selectedBlock.style?.fontWeight as string) || ''}
                            onChange={(e) => updateSelectedBlockStyle({ fontWeight: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500"
                          >
                            <option value="">Normal (400)</option>
                            <option value="lighter">Lighter</option>
                            <option value="500">Medium (500)</option>
                            <option value="600">Semi Bold (600)</option>
                            <option value="bold">Bold (700)</option>
                            <option value="bolder">Bolder (900)</option>
                          </select>
                        </div>
                        
                        {renderStyleInput('Letter Spacing', 'letterSpacing', '0px')}

                        <div className="col-span-2 flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Text Alignment</label>
                          <div className="flex bg-neutral-950 border border-neutral-800 rounded overflow-hidden p-0.5">
                            {['left', 'center', 'right', 'justify'].map(align => (
                              <button
                                key={align}
                                onClick={() => updateSelectedBlockStyle({ textAlign: align as any })}
                                className={`flex-1 py-1.5 text-xs capitalize ${selectedBlock.style?.textAlign === align ? 'bg-brand-500/20 text-brand-400 font-medium rounded-sm' : 'text-neutral-400 hover:text-white'}`}
                              >
                                {align}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="col-span-2 flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Text Decoration</label>
                          <div className="flex bg-neutral-950 border border-neutral-800 rounded overflow-hidden p-0.5">
                            {['none', 'underline', 'line-through'].map(decor => (
                              <button
                                key={decor}
                                onClick={() => updateSelectedBlockStyle({ textDecoration: decor })}
                                className={`flex-1 py-1.5 text-xs capitalize ${selectedBlock.style?.textDecoration === decor ? 'bg-brand-500/20 text-brand-400 font-medium rounded-sm' : 'text-neutral-400 hover:text-white'}`}
                              >
                                {decor}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- APPEARANCE SECTION --- */}
                  {selectedBlock.type !== 'Spacer' && (
                    <div className="p-4 border-b border-neutral-800">
                      <h3 className="text-xs font-bold text-white mb-4 flex items-center gap-2"><Palette className="w-3.5 h-3.5 text-brand-500" /> Colors & Borders</h3>
                      <div className="grid grid-cols-2 gap-4">
                        
                        {selectedBlock.type !== 'Image' && selectedBlock.type !== 'Divider' && 
                          renderColorInput('Text Color', 'color', selectedBlock.style, updateSelectedBlockStyle, '#000000')
                        }

                        {selectedBlock.type !== 'Divider' && selectedBlock.type !== 'Image' &&
                          renderColorInput('Background Color', 'backgroundColor', selectedBlock.style, updateSelectedBlockStyle, 'transparent')
                        }
                        
                        {(selectedBlock.type === 'Divider' || selectedBlock.type === 'Button' || selectedBlock.type === 'Image') &&
                          renderColorInput('Border Color', 'borderColor', selectedBlock.style, updateSelectedBlockStyle, '#eaeaea')
                        }

                        {selectedBlock.type !== 'Divider' && renderStyleInput('Border Radius', 'borderRadius', '8px')}
                        {renderStyleInput('Border Width', 'borderWidth', '1px')}
                        
                        <div className="col-span-2">
                          {selectedBlock.type !== 'Divider' && renderStyleInput('Box Shadow', 'boxShadow', '0px 4px 10px rgba(0,0,0,0.1)')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- DIMENSIONS & SPACING --- */}
                  <div className="p-4 border-b border-neutral-800">
                    <h3 className="text-xs font-bold text-white mb-4 flex items-center gap-2"><BoxSelect className="w-3.5 h-3.5 text-brand-500" /> Sizing & Spacing</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {renderStyleInput('Width', 'width', '100% or 200px')}
                      {renderStyleInput('Height', 'height', 'auto')}
                      
                      <div className="col-span-2 mt-2">
                        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">Margin (Outside Spacing)</label>
                        <div className="grid grid-cols-4 gap-2 bg-neutral-950/50 p-2 rounded border border-neutral-800/50">
                          {renderStyleInput('Top', 'marginTop', '0')}
                          {renderStyleInput('Right', 'marginRight', '0')}
                          {renderStyleInput('Bottom', 'marginBottom', '0')}
                          {renderStyleInput('Left', 'marginLeft', '0')}
                        </div>
                      </div>

                      {selectedBlock.type !== 'Divider' && selectedBlock.type !== 'Spacer' && selectedBlock.type !== 'Image' && (
                        <div className="col-span-2 mt-2">
                          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">Padding (Inside Spacing)</label>
                          <div className="grid grid-cols-4 gap-2 bg-neutral-950/50 p-2 rounded border border-neutral-800/50">
                            {renderStyleInput('Top', 'paddingTop', '0')}
                            {renderStyleInput('Right', 'paddingRight', '0')}
                            {renderStyleInput('Bottom', 'paddingBottom', '0')}
                            {renderStyleInput('Left', 'paddingLeft', '0')}
                          </div>
                        </div>
                      )}
                      
                      <div className="col-span-2 mt-2">
                        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Display</label>
                        <select 
                          value={(selectedBlock.style?.display as string) || ''}
                          onChange={(e) => updateSelectedBlockStyle({ display: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500"
                        >
                          <option value="">Default</option>
                          <option value="inline-block">Inline Block</option>
                          <option value="block">Block</option>
                          <option value="none">None (Hidden)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                // --- GLOBAL EMAIL SETTINGS ---
                <div className="flex flex-col">
                  <div className="p-4 border-b border-neutral-800 bg-neutral-900/30">
                    <h3 className="text-sm font-semibold text-white mb-1">Global Layout</h3>
                    <p className="text-xs text-neutral-500">Customize the root email structure.</p>
                  </div>
                  
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      {renderColorInput('Page Background', 'bodyBg', emailSettings, updateEmailSettings, '#f6f9fc')}
                      {renderColorInput('Container Box', 'containerBg', emailSettings, updateEmailSettings, '#ffffff')}
                      
                      <div className="col-span-2 flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Default Font Family</label>
                        <select 
                          value={emailSettings.fontFamily}
                          onChange={(e) => updateEmailSettings({ fontFamily: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500"
                        >
                          {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0].replace(/'/g, '')}</option>)}
                        </select>
                      </div>

                      <div className="col-span-2 flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Max Width</label>
                        <input 
                          type="text"
                          value={emailSettings.maxWidth}
                          onChange={(e) => updateEmailSettings({ maxWidth: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 font-mono"
                          placeholder="600px"
                        />
                      </div>
                      
                      <div className="col-span-2 flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Inner Container Padding</label>
                        <input 
                          type="text"
                          value={emailSettings.padding}
                          onChange={(e) => updateEmailSettings({ padding: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 font-mono"
                          placeholder="40px"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Render a floating preview when dragging */}
          <DragOverlay dropAnimation={defaultDropAnimationSideEffects({ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) })}>
            {activeDragId && activeDragData?.isSidebarItem && (
              <div className="flex items-center gap-2 p-3 rounded border border-brand-500 bg-brand-500/20 text-brand-400 shadow-xl w-32 justify-center opacity-90 scale-105">
                {getSidebarIcon(activeDragData.type)}
                <span className="text-sm font-bold">{activeDragData.type}</span>
              </div>
            )}
            {activeDragId && activeDragData?.isCanvasItem && (
              <div className="bg-brand-500/10 border-2 border-brand-500/50 rounded shadow-2xl p-2 opacity-80 backdrop-blur-sm">
                 <span className="text-xs font-bold text-brand-400 bg-neutral-900 px-2 py-1 rounded">Dragging {activeDragData.block.type}...</span>
              </div>
            )}
          </DragOverlay>

        </div>
      </DndContext>

      {/* Modals */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm px-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-400" />
              Reset Canvas?
            </h2>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              Are you sure you want to completely clear the email canvas? This action will remove all elements and settings. You can use Undo to revert this if you change your mind.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleResetCanvas}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-lg shadow-red-500/20 transition"
              >
                Yes, clear canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
