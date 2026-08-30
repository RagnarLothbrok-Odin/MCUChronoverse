export interface Database {
    public: {
        Tables: {
            watch_progress: {
                Insert: {
                    entry_slug: string;
                    user_id?: string;
                    watched_at?: string;
                };
                Relationships: [];
                Row: {
                    entry_slug: string;
                    user_id: string;
                    watched_at: string;
                };
                Update: {
                    entry_slug?: string;
                    user_id?: string;
                    watched_at?: string;
                };
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
}
