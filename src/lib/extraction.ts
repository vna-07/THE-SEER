import { askVision } from './ai';
import type { OcrResult } from './ocr';
import type { Entry, LayoutProfile, LegacyShape } from './layout';

export type ExtractedRecord = LegacyShape & {
  businessName?: string;
  pageType?: string;
  entries: Entry[];
  staged: Array<{ entry: Entry; reason: string }>;
  profile: LayoutProfile;
  pageIssues: string[];
  profileChanges: string[];
  rejects: { section: string; index: number; error: string; row: any }[];
  ocr: OcrResult;
};

export async function extractRecord(
  imageUrl: string,
  options?: {
    shopKey?: string;
    profile?: LayoutProfile | null;
    saveProfile?: boolean;
  }
): Promise<ExtractedRecord> {
  let profile: LayoutProfile | null = options?.profile ?? null;
  const shopKey = options?.shopKey;

  if (!profile && shopKey) {
    try {
      const { loadProfile } = await import('./profile-store');
      profile = await loadProfile(shopKey);
    } catch (e) {
      console.warn('[extraction] profile load failed:', e);
    }
  }

  let discovered = false;
  if (!profile || (profile.layout_confidence ?? 0) < 0.5) {
    try {
      const { discoverLayout } = await import('./layout');
      const r = await discoverLayout(imageUrl);
      profile = r.profile;
      discovered = true;
    } catch (e) {
      console.warn('[extraction] layout discovery failed:', e);
      const { DEFAULT_PROFILE } = await import('./layout');
      profile = DEFAULT_PROFILE;
    }
  }

  const { extractEntries, entriesToLegacy } = await import('./layout');
  const { result, error: extractError } = await extractEntries(imageUrl, profile!);

  if (extractError) {
    throw new Error(`Extraction failed: ${extractError}`);
  }

  const { legacy, staged } = entriesToLegacy(result.entries);

  if (discovered && shopKey && options?.saveProfile !== false) {
    try {
      const { saveProfile } = await import('./profile-store');
      await saveProfile(shopKey, profile!);
    } catch (e) {
      console.warn('[extraction] profile save failed:', e);
    }
  }

  const ocr: OcrResult = {
    text: result.entries.map((e) => e.raw_text).join('\n'),
    lines: [],
    language: 'en',
    confidence: 0,
  };

  return {
    businessName: undefined,
    pageType: profile!.document_types.join(',') || undefined,
    products: legacy.products,
    sales: legacy.sales,
    expenses: legacy.expenses,
    suppliers: legacy.suppliers,
    receivables: legacy.receivables,
    orders: legacy.orders,
    entries: result.entries,
    staged,
    profile: profile!,
    pageIssues: result.page_issues,
    profileChanges: result.profile_changes,
    rejects: [],
    ocr,
  };
}