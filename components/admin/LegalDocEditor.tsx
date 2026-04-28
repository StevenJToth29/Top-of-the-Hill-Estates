'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'

interface LegalDocEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      aria-pressed={active}
      className={[
        'px-2 py-1 rounded text-sm font-medium transition-colors',
        active
          ? 'bg-secondary/20 text-secondary'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function LegalDocEditor({ value, onChange, placeholder }: LegalDocEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
  })

  // Sync external value changes (e.g. form reset or external set)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  function handleLink() {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Enter URL', previousUrl ?? 'https://')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
    }
  }

  return (
    <div className="rounded-xl border border-outline-variant overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 bg-surface-container/50 border-b border-outline-variant">
        <ToolbarButton
          active={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <span className="font-bold">B</span>
        </ToolbarButton>

        <ToolbarButton
          active={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <span className="italic">I</span>
        </ToolbarButton>

        <ToolbarButton
          active={editor?.isActive('underline')}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <span className="underline">U</span>
        </ToolbarButton>

        <span className="w-px h-5 bg-outline-variant mx-1 self-center" aria-hidden />

        <ToolbarButton
          active={editor?.isActive('heading', { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          H2
        </ToolbarButton>

        <ToolbarButton
          active={editor?.isActive('heading', { level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          H3
        </ToolbarButton>

        <span className="w-px h-5 bg-outline-variant mx-1 self-center" aria-hidden />

        <ToolbarButton
          active={editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          •—
        </ToolbarButton>

        <ToolbarButton
          active={editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          1—
        </ToolbarButton>

        <span className="w-px h-5 bg-outline-variant mx-1 self-center" aria-hidden />

        <ToolbarButton
          active={editor?.isActive('link')}
          onClick={handleLink}
          title="Link"
        >
          Link
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div className="relative bg-surface-highest/40">
        {editor && !editor.getText() && placeholder && (
          <span
            className="absolute top-4 left-4 text-on-surface-variant/50 text-sm pointer-events-none select-none"
            aria-hidden
          >
            {placeholder}
          </span>
        )}
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none text-on-surface px-4 py-4 min-h-[160px] focus:outline-none [&_.ProseMirror]:outline-none"
        />
      </div>
    </div>
  )
}
