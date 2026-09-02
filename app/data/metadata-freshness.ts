export const METADATA_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface MetadataCacheRecord {
    fetchedAt: string;
    status: "failed" | "resolved";
}

export function isMetadataCacheRecordStale(
    record: MetadataCacheRecord | undefined,
    now = Date.now()
): boolean {
    if (record?.status !== "resolved") {
        return true;
    }

    const fetchedAt = Date.parse(record.fetchedAt);
    return !Number.isFinite(fetchedAt) || now - fetchedAt > METADATA_MAX_AGE_MS;
}
