import { supabase } from '@/db/supabase';
import type { DocumentationCategory, DocumentationSection } from '@/types/types';

export async function getDocumentationCategories(): Promise<DocumentationCategory[]> {
  const { data, error } = await supabase
    .from('documentation_sections')
    .select('*')
    .order('category_order', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw error;

  const sections = (data ?? []) as DocumentationSection[];
  const byCategory = new Map<string, DocumentationCategory>();

  for (const section of sections) {
    const existing = byCategory.get(section.category);
    if (existing) {
      existing.sections.push(section);
    } else {
      byCategory.set(section.category, {
        category: section.category,
        category_label: section.category_label,
        category_order: section.category_order,
        sections: [section],
      });
    }
  }

  return [...byCategory.values()].sort((a, b) => a.category_order - b.category_order);
}
