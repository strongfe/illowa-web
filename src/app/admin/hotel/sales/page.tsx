import SalesPageInline from '@/components/hotel/SalesPageInline';
import SalesPageLegacy from '@/components/hotel/SalesPageLegacy';

// Phase 1 rollback switch — see requirement #17.
// Set NEXT_PUBLIC_USE_INLINE_EDIT=false in Vercel env to roll back instantly.
const useInlineEdit = process.env.NEXT_PUBLIC_USE_INLINE_EDIT !== 'false';

export default function Page() {
  return useInlineEdit ? <SalesPageInline /> : <SalesPageLegacy />;
}
