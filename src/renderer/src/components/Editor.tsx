export interface EditorProps {
  value: string
  onChange: (value: string) => void
}

/** A plain text editor; a code editor replaces it in a later phase. */
export function Editor({ value, onChange }: EditorProps) {
  return (
    <section className="pane editor-pane" aria-label="Editor">
      <textarea
        className="editor"
        aria-label="Markdown source"
        value={value}
        spellCheck={false}
        placeholder="Start writing Markdown…"
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  )
}
