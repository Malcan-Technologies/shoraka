"use client";

import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Bold, List, ListOrdered } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "../components/button";
import { sanitizeDeclarationHtml } from "./sanitize";

const MAX_TEXT_LENGTH = 5000;

export interface DeclarationRichTextEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
}

/**
 * Minimal rich text for product declaration copy: bold, bullet and numbered lists only.
 */
export function DeclarationRichTextEditor({
  id,
  value,
  onChange,
  placeholder = "Enter declaration text…",
  className,
  editorClassName,
}: DeclarationRichTextEditorProps) {
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        italic: false,
        underline: false,
        link: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[80px] max-h-[min(480px,70vh)] resize-y overflow-auto px-3 py-2 rounded-md border border-input bg-background text-sm leading-6 outline-none",
          "focus-visible:outline-none focus-visible:ring-0 focus-visible:border-ring",
          "[&_p]:my-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
          editorClassName
        ),
        ...(id ? { id } : {}),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const text = ed.getText();
      if (text.length > MAX_TEXT_LENGTH) {
        ed.chain().undo().run();
        return;
      }
      const html = sanitizeDeclarationHtml(ed.getHTML());
      onChangeRef.current(html);
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const current = sanitizeDeclarationHtml(editor.getHTML());
    const next = sanitizeDeclarationHtml(value);
    if (next !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "min-h-[80px] rounded-md border border-input bg-muted/30 animate-pulse",
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        "grid gap-2",
        "[&_p.is-empty::before]:content-[attr(data-placeholder)] [&_p.is-empty::before]:text-muted-foreground",
        "[&_p.is-empty::before]:pointer-events-none [&_p.is-empty::before]:float-left [&_p.is-empty::before]:h-0",
        className
      )}
    >
      <div
        className="flex flex-wrap items-center gap-0.5 rounded-md border border-input bg-muted/20 p-1"
        role="toolbar"
        aria-label="Formatting"
      >
        <Button
          type="button"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
          aria-pressed={editor.isActive("bold")}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
          aria-pressed={editor.isActive("bulletList")}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
          aria-pressed={editor.isActive("orderedList")}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
