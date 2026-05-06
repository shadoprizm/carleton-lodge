import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { Bold, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Paperclip } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { processImage } from '../utils/imageProcessor';
import { escapeHtml, normalizeRichTextHref, normalizeRichTextHtml, sanitizeRichTextHtml } from '../utils/richText';

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor = ({
  id,
  value,
  onChange,
  placeholder = 'Add event details, images, posters, or supporting files...',
  className = '',
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const [uploadingLabel, setUploadingLabel] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const normalized = normalizeRichTextHtml(value);
    if (editor.innerHTML !== normalized) {
      editor.innerHTML = normalized;
    }
  }, [value]);

  const syncEditorValue = (sanitize = false) => {
    const editor = editorRef.current;
    if (!editor) return;

    const nextValue = sanitize ? sanitizeRichTextHtml(editor.innerHTML) : editor.innerHTML;
    if (sanitize && editor.innerHTML !== nextValue) {
      editor.innerHTML = nextValue;
    }
    onChange(nextValue);
  };

  const saveSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  };

  const focusEditorAtEnd = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;

    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    selectionRef.current = range.cloneRange();
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;

    editor.focus();
    selection.removeAllRanges();

    if (selectionRef.current) {
      selection.addRange(selectionRef.current);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.addRange(range);
    selectionRef.current = range.cloneRange();
  };

  const runCommand = (command: string, commandValue?: string, sanitize = false) => {
    setError('');
    restoreSelection();
    document.execCommand(command, false, commandValue);
    syncEditorValue(sanitize);
    saveSelection();
  };

  const insertHtml = (html: string) => {
    runCommand('insertHTML', html, true);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    insertHtml(escapeHtml(text).replace(/\n/g, '<br />'));
  };

  const handleAddLink = () => {
    const rawHref = window.prompt('Enter the link or email address');
    if (!rawHref) return;

    const href = normalizeRichTextHref(rawHref);
    if (!href) {
      setError('Enter a valid link, email address, or phone number.');
      return;
    }

    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText) {
      runCommand('createLink', href, true);
      return;
    }

    insertHtml(`<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`);
  };

  const uploadAsset = async (file: File, kind: 'image' | 'file') => {
    try {
      setError('');
      setUploadingLabel(`Uploading ${file.name}...`);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('Please sign in to upload event assets.');
      }

      const originalName = file.name || (kind === 'image' ? 'image' : 'file');
      const baseName = originalName.replace(/\.[^.]+$/, '') || 'asset';
      const safeBase = baseName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'asset';

      let uploadSource: Blob = file;
      let contentType = file.type || 'application/octet-stream';
      let extension = originalName.includes('.') ? originalName.slice(originalName.lastIndexOf('.')).toLowerCase() : '';

      if (kind === 'image') {
        const processed = await processImage(file);
        uploadSource = processed.blob;
        contentType = 'image/webp';
        extension = '.webp';
      }

      const path = `${session.user.id}/${Date.now()}-${safeBase}${extension}`;
      const { error: uploadError } = await supabase.storage.from('event-assets').upload(path, uploadSource, {
        contentType,
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('event-assets').getPublicUrl(path);
      const publicUrl = data.publicUrl;

      if (kind === 'image') {
        insertHtml(
          `<figure><img src="${escapeHtml(publicUrl)}" alt="${escapeHtml(originalName)}" title="${escapeHtml(originalName)}" /><figcaption>${escapeHtml(baseName)}</figcaption></figure><p><br /></p>`
        );
      } else {
        insertHtml(
          `<p><a href="${escapeHtml(publicUrl)}" data-kind="attachment" target="_blank" rel="noopener noreferrer" download="${escapeHtml(originalName)}">${escapeHtml(originalName)}</a></p><p><br /></p>`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploadingLabel('');
    }
  };

  const toolbarButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className={className}>
      <div className="rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand('bold')}
            className={toolbarButtonClass}
            aria-label="Bold"
            title="Bold"
            disabled={!!uploadingLabel}
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand('italic')}
            className={toolbarButtonClass}
            aria-label="Italic"
            title="Italic"
            disabled={!!uploadingLabel}
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand('insertUnorderedList')}
            className={toolbarButtonClass}
            aria-label="Bulleted list"
            title="Bulleted list"
            disabled={!!uploadingLabel}
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand('insertOrderedList')}
            className={toolbarButtonClass}
            aria-label="Numbered list"
            title="Numbered list"
            disabled={!!uploadingLabel}
          >
            <ListOrdered size={15} />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleAddLink}
            className={toolbarButtonClass}
            aria-label="Insert link"
            title="Insert link"
            disabled={!!uploadingLabel}
          >
            <Link2 size={15} />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => imageInputRef.current?.click()}
            className={toolbarButtonClass}
            aria-label="Upload image"
            title="Upload image or poster"
            disabled={!!uploadingLabel}
          >
            <ImagePlus size={15} />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={toolbarButtonClass}
            aria-label="Upload file"
            title="Upload file attachment"
            disabled={!!uploadingLabel}
          >
            <Paperclip size={15} />
          </button>
          <div className="ml-auto text-xs text-slate-500">
            Add text, images, PDFs, or linked files directly in the event details.
          </div>
        </div>

        <div
          id={id}
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          className="rich-text-editor min-h-[220px] px-4 py-3 text-sm text-slate-700 focus:outline-none"
          onInput={() => syncEditorValue()}
          onBlur={() => {
            saveSelection();
            syncEditorValue(true);
          }}
          onFocus={saveSelection}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          onPaste={handlePaste}
        />
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (!selectionRef.current) {
            focusEditorAtEnd();
          }
          void uploadAsset(file, 'image');
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (!selectionRef.current) {
            focusEditorAtEnd();
          }
          void uploadAsset(file, 'file');
        }}
      />

      {(uploadingLabel || error) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {uploadingLabel && (
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <Loader2 size={12} className="animate-spin" />
              {uploadingLabel}
            </span>
          )}
          {error && <span className="text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
};
