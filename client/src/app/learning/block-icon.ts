const BLOCK_ICONS: Record<string, string> = {
  video: 'smart_display',
  article: 'article',
  practice: 'code',
  course: 'school',
  other: 'task_alt',
};

export function blockIcon(type: string): string {
  return BLOCK_ICONS[type] ?? BLOCK_ICONS['other'];
}
