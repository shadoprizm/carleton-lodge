import { sanitizeRichTextHtml } from '../utils/richText';

interface RichTextContentProps {
  html?: string | null;
  tone?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
}

export const RichTextContent = ({
  html,
  tone = 'light',
  compact = false,
  className = '',
}: RichTextContentProps) => {
  const safeHtml = sanitizeRichTextHtml(html);

  if (!safeHtml) {
    return null;
  }

  const classes = [
    'rich-text',
    tone === 'dark' ? 'rich-text-dark' : 'rich-text-light',
    compact ? 'rich-text-compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
};
