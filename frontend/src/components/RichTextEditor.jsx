import { useRef, useCallback, useEffect } from 'react';
import { Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered } from 'lucide-react';

function ToolbarButton({ onClick, active, children, title }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = '300px' }) {
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const initializedRef = useRef(false);

  // Keep onChange ref current
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Set initial content once on mount
  useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = value || '';
      initializedRef.current = true;
    }
  }, []);

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    if (editorRef.current && initializedRef.current) {
      // Only sync if value was cleared externally (form reset)
      if (value === '' && editorRef.current.innerHTML !== '') {
        editorRef.current.innerHTML = '';
      }
    }
  }, [value]);

  const emitChange = useCallback(() => {
    if (editorRef.current) {
      onChangeRef.current(editorRef.current.innerHTML);
    }
  }, []);

  const execCmd = useCallback((command, val = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    emitChange();
  }, [emitChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      execCmd('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  }, [execCmd]);

  const iconSize = 'w-4 h-4';

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
        {/* Text formatting */}
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

        {/* Alignment */}
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

        {/* Lists */}
        <ToolbarButton onClick={() => execCmd('insertUnorderedList')} title="Bullet List">
          <List className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd('insertOrderedList')} title="Numbered List">
          <ListOrdered className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Headings */}
        <ToolbarButton onClick={() => execCmd('formatBlock', 'h3')} title="Heading">
          <span className="text-xs font-bold">H</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd('formatBlock', 'p')} title="Paragraph">
          <span className="text-xs font-bold">P</span>
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={emitChange}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder || 'Start typing...'}
        className="px-4 py-3 text-gray-900 dark:text-white text-sm focus:outline-none overflow-y-auto
          [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400 [&:empty]:before:dark:text-gray-500
          [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-1
          [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-1
          [&_li]:my-0.5
          [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-2
          [&_p]:my-1"
        style={{ minHeight }}
      />
    </div>
  );
}
