import React from 'react';

export type BlockType = 'Heading' | 'Text' | 'Button' | 'Image' | 'Divider' | 'Link' | 'Spacer' | 'Row';

export interface ColumnDef {
  id: string;
  width: number; // percentage, e.g. 50
  blocks: Block[];
}

export interface Block {
  id: string;
  type: BlockType;
  content?: string;
  href?: string;
  src?: string;
  alt?: string;
  style?: React.CSSProperties;
  columns?: ColumnDef[]; // only for Row type
}

export interface EmailSettings {
  bodyBg: string;
  containerBg: string;
  maxWidth: string;
  fontFamily: string;
  padding: string;
  borderRadius: string;
}

export interface CanvasTab {
  id: string;
  name: string;
  blocks: Block[];
  settings: EmailSettings;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryState {
  blocks: Block[];
  settings: EmailSettings;
}
