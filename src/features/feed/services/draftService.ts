export interface Draft {
    id: string;
    title: string;
    body: string;
    tags: string;
    lastUpdated: number;
    scheduledAt?: number;
}

class DraftService {
    private readonly STORAGE_KEY = 'bac_post_drafts';

    getDrafts(): Draft[] {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return [];
        try {
            return JSON.parse(stored);
        } catch {
            return [];
        }
    }

    saveDraft(draft: Omit<Draft, 'id' | 'lastUpdated'> & { id?: string }): Draft {
        const drafts = this.getDrafts();
        const now = Date.now();
        const id = draft.id || Math.random().toString(36).substring(2, 9);

        const existingIndex = drafts.findIndex(d => d.id === id);
        const newDraft: Draft = {
            ...draft,
            id,
            lastUpdated: now
        };

        if (existingIndex > -1) {
            drafts[existingIndex] = newDraft;
        } else {
            drafts.unshift(newDraft);
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(drafts));
        return newDraft;
    }

    deleteDraft(id: string): void {
        const drafts = this.getDrafts().filter(d => d.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(drafts));
    }

    clearDrafts(): void {
        localStorage.removeItem(this.STORAGE_KEY);
    }
}

export const draftService = new DraftService();
