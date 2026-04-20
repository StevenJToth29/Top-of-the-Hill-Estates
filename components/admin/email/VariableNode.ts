import { Node, mergeAttributes } from '@tiptap/core'

export const VariableNode = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-variable'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-variable': attributes['key'],
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const key = HTMLAttributes['data-variable'] ?? ''
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class:
          'inline-flex items-center rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-mono text-primary select-all cursor-default',
      }),
      `{{${key}}}`,
    ]
  },
})
