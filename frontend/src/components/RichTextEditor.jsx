import { useRef, useCallback, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered } from 'lucide-react';

function ToolbarButton({ onClick, children, title }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className="p-1.5 rounded transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200"
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = '300px' }) {
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Keep onChange ref current
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Set initial content on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || '';
      setIsEmpty(!value);
    }
  }, []);

  // Sync when value is externally cleared (form reset)
  useEffect(() => {
    if (editorRef.current && value === '' && editorRef.current.innerHTML !== '') {
      editorRef.current.innerHTML = '';
      setIsEmpty(true);
    }
  }, [value]);

  const emitChange = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const textOnly = editorRef.current.textContent || '';
      setIsEmpty(textOnly.trim() === '' && !html.includes('<img'));
      onChangeRef.current(html);
    }
  }, []);

  const execCmd = useCallback((command, val = null) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(command, false, val);
      emitChange();
    }
  }, [emitChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '\u00a0\u00a0\u00a0\u00a0');
      emitChange();
    }
  }, [emitChange]);

  const iconSize = 'w-4 h-4';

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
        <ToolbarButton onClick={() => execCmd('bold')} title="Bold (Ctrl+B)">
          <Bold className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd('italic')} title="Italic (Ctrl+I)">
          <Italic className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd('underline')} title="Underline (Ctrl+U)">
          <Underline className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd('strikeThrough')} title="Strikethrough">
          <Strikethrough className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

        <ToolbarButton onClick={() => execCmd('justifyLeft')} title="Align Left">
          <AlignLeft className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd('justifyCenter')} title="Align Center">
          <AlignCenter className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd('justifyRight')} title="Align Right">
          <AlignRight className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd('justifyFull')} title="Justify">
          <AlignJustify className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

        <ToolbarButton onClick={() => execCmd('insertUnorderedList')} title="Bullet List">
          <List className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd('insertOrderedList')} title="Numbered List">
          <ListOrdered className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

        <ToolbarButton onClick={() => execCmd('formatBlock', 'h3')} title="Heading">
          <span className="text-xs font-bold">H</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd('formatBlock', 'p')} title="Paragraph">
          <span className="text-xs font-bold">P</span>
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div className="relative">
        {isEmpty && (
          <div
            className="absolute top-3 left-4 text-gray-400 dark:text-gray-500 text-sm pointer-events-none select-none"
          >
            {placeholder || 'Start typing...'}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          onInput={emitChange}
          onFocus={() => {}}
          onBlur={emitChange}
          onKeyDown={handleKeyDown}
          className="px-4 py-3 text-gray-900 dark:text-white text-sm focus:outline-none overflow-y-auto"
          style={{
            minHeight,
            listStylePosition: 'inside',
          }}
        />
      </div>

      {/* Scoped styles for editor content */}
      <style>{`
        [contenteditable] ul { list-style-type: disc; margin-left: 1.5rem; margin-top: 0.25rem; margin-bottom: 0.25rem; }
        [contenteditable] ol { list-style-type: decimal; margin-left: 1.5rem; margin-top: 0.25rem; margin-bottom: 0.25rem; }
        [contenteditable] li { margin-top: 0.125rem; margin-bottom: 0.125rem; }
        [contenteditable] h3 { font-size: 1.125rem; font-weight: 600; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        [contenteditable] p { margin-top: 0.25rem; margin-bottom: 0.25rem; }
      `}</style>
    </div>
  );
}
