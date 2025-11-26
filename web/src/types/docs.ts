export interface ContentItem {
  type: 'text' | 'command' | 'code' | 'list' | 'note' | 'warning';
  value?: string;
  title?: string;
  command?: string;
  description?: string;
  examples?: string[];
  items?: string[];
}

export interface Subsection {
  id: string;
  title: string;
  content: ContentItem[];
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  subsections: Subsection[];
}

export interface DocsData {
  sections: Section[];
}
