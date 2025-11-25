export interface ChangeItem {
    type: 'added' | 'changed' | 'fixed' | 'security' | 'deprecated' | 'removed';
    title: string;
    items: string[];
}

export interface Version {
    version: string;
    date: string;
    isLatest: boolean;
    changes: ChangeItem[];
}

export interface ChangelogData {
    versions: Version[];
}
