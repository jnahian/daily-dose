export interface ScriptParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ScriptExample {
  code: string;
  description?: string;
}

export interface ScriptFeature {
  title: string;
  items: string[];
}

export interface Script {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  purpose: string;
  usageNote?: {
    type: 'info' | 'warning' | 'success' | 'danger';
    title: string;
    description: string;
  };
  examples: ScriptExample[];
  parameters?: ScriptParameter[];
  features?: ScriptFeature[];
  whatItDoes?: string[];
  prerequisites?: string[];
}

export interface ScriptCategory {
  id: string;
  title: string;
  icon: string;
  iconColor: string;
  description: string;
  highlights: string[];
  scripts: Script[];
}

export interface ScriptsData {
  overview: {
    title: string;
    description: string;
    warning: {
      title: string;
      description: string;
    };
    categories: Array<{
      title: string;
      icon: string;
      iconColor: string;
      description: string;
      highlights: string[];
    }>;
  };
  prerequisites: {
    environmentSetup: string;
    requiredPermissions: Array<{
      title: string;
      description: string;
    }>;
    generalUsage: string;
  };
  categories: ScriptCategory[];
}
