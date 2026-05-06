const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

const SAFE_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'div',
  'em',
  'figcaption',
  'figure',
  'h3',
  'h4',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'strong',
  'u',
  'ul',
]);

function getBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://example.com';
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hasHtmlMarkup(value: string) {
  return HTML_TAG_PATTERN.test(value);
}

function isSafeUrl(value: string, kind: 'href' | 'src') {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;

  try {
    const parsed = new URL(trimmed, getBaseUrl());
    if (kind === 'src') {
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }
    return parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'mailto:' ||
      parsed.protocol === 'tel:';
  } catch {
    return false;
  }
}

function unwrapChildren(node: HTMLElement, cleanDocument: Document) {
  const fragment = cleanDocument.createDocumentFragment();
  Array.from(node.childNodes).forEach((child) => {
    const sanitizedChild = sanitizeNode(child, cleanDocument);
    if (sanitizedChild) {
      fragment.appendChild(sanitizedChild);
    }
  });
  return fragment;
}

function sanitizeAnchorAttributes(source: HTMLElement, clean: HTMLElement) {
  const href = source.getAttribute('href');
  if (!href || !isSafeUrl(href, 'href')) {
    return false;
  }

  clean.setAttribute('href', href.trim());

  const parsed = new URL(href, getBaseUrl());
  const isExternalLink = parsed.protocol === 'http:' || parsed.protocol === 'https:' || href.startsWith('/');
  if (isExternalLink) {
    clean.setAttribute('target', '_blank');
    clean.setAttribute('rel', 'noopener noreferrer');
  }

  if (source.getAttribute('data-kind') === 'attachment') {
    clean.setAttribute('data-kind', 'attachment');
  }

  if (source.hasAttribute('download')) {
    const downloadName = source.getAttribute('download')?.trim();
    if (downloadName) {
      clean.setAttribute('download', downloadName);
    } else {
      clean.setAttribute('download', '');
    }
  }

  return true;
}

function sanitizeImageAttributes(source: HTMLElement, clean: HTMLElement) {
  const src = source.getAttribute('src');
  if (!src || !isSafeUrl(src, 'src')) {
    return false;
  }

  clean.setAttribute('src', src.trim());

  const alt = source.getAttribute('alt');
  if (alt) {
    clean.setAttribute('alt', alt);
  }

  const title = source.getAttribute('title');
  if (title) {
    clean.setAttribute('title', title);
  }

  clean.setAttribute('loading', 'lazy');
  clean.setAttribute('decoding', 'async');
  return true;
}

function sanitizeNode(node: Node, cleanDocument: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return cleanDocument.createTextNode(node.textContent ?? '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (!SAFE_TAGS.has(tag)) {
    return unwrapChildren(element, cleanDocument);
  }

  const cleanElement = cleanDocument.createElement(tag);

  if (tag === 'a' && !sanitizeAnchorAttributes(element, cleanElement)) {
    return unwrapChildren(element, cleanDocument);
  }

  if (tag === 'img' && !sanitizeImageAttributes(element, cleanElement)) {
    return null;
  }

  Array.from(element.childNodes).forEach((child) => {
    const sanitizedChild = sanitizeNode(child, cleanDocument);
    if (sanitizedChild) {
      cleanElement.appendChild(sanitizedChild);
    }
  });

  if (tag === 'figcaption' && !cleanElement.textContent?.trim()) {
    return null;
  }

  if ((tag === 'p' || tag === 'div' || tag === 'blockquote') && !cleanElement.childNodes.length) {
    cleanElement.appendChild(cleanDocument.createElement('br'));
  }

  return cleanElement;
}

export function normalizeRichTextHref(value: string) {
  let href = value.trim();
  if (!href) return null;

  if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href) && !href.startsWith('/')) {
    if (href.includes('@') && !href.includes(' ')) {
      href = `mailto:${href}`;
    } else {
      href = `https://${href}`;
    }
  }

  return isSafeUrl(href, 'href') ? href : null;
}

export function normalizeRichTextHtml(value: string | null | undefined) {
  const input = (value ?? '').trim();
  if (!input) return '';
  if (hasHtmlMarkup(input)) return input;

  const paragraphs = input
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`);

  if (paragraphs.length > 0) {
    return paragraphs.join('');
  }

  return `<p>${escapeHtml(input).replace(/\n/g, '<br />')}</p>`;
}

export function sanitizeRichTextHtml(value: string | null | undefined) {
  const normalized = normalizeRichTextHtml(value);
  if (!normalized) return '';

  if (typeof DOMParser === 'undefined' || typeof document === 'undefined') {
    return normalized;
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(normalized, 'text/html');
  const cleanDocument = document.implementation.createHTMLDocument('');
  const container = cleanDocument.createElement('div');

  Array.from(parsed.body.childNodes).forEach((child) => {
    const sanitizedChild = sanitizeNode(child, cleanDocument);
    if (sanitizedChild) {
      container.appendChild(sanitizedChild);
    }
  });

  return container.innerHTML.trim();
}

export function richTextToPlainText(value: string | null | undefined) {
  const normalized = normalizeRichTextHtml(value);
  if (!normalized) return '';

  if (typeof DOMParser === 'undefined') {
    return normalized.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const parsed = new DOMParser().parseFromString(normalized, 'text/html');
  return (parsed.body.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function richTextHasEmbeds(value: string | null | undefined) {
  const sanitized = sanitizeRichTextHtml(value);
  if (!sanitized) return false;
  return /<img\b/i.test(sanitized) || /data-kind="attachment"/i.test(sanitized);
}

export function prepareRichTextForStorage(value: string | null | undefined) {
  const sanitized = sanitizeRichTextHtml(value);
  if (!sanitized) return '';

  const plainText = richTextToPlainText(sanitized);
  const hasEmbeds = richTextHasEmbeds(sanitized);

  if (!plainText && !hasEmbeds) {
    return '';
  }

  return sanitized;
}
