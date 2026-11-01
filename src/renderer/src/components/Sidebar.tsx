import { useState } from 'react'
import type { FileTreeNode, OpenedFolder } from '../../../shared/api'
import { fileName } from '../text'

export interface SidebarProps {
  folder: OpenedFolder | null
  activePath: string | null
  dirty: boolean
  onSelectFile: (path: string) => void
  onOpenFolder: () => void
}

interface TreeContext {
  activePath: string | null
  dirty: boolean
  onSelectFile: (path: string) => void
}

type DirectoryNode = Extract<FileTreeNode, { kind: 'directory' }>

function UnsavedDot() {
  return (
    <span className="unsaved-dot" role="img" aria-label="Unsaved changes" title="Unsaved changes">
      ●
    </span>
  )
}

/* Tree icons, shown in every theme. */

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg className="tree-icon" viewBox="0 0 16 16" aria-hidden="true">
      {open ? (
        <>
          <path
            fill="currentColor"
            opacity=".9"
            d="M1.5 3h4.2l1.4 1.5h6.4c.5 0 .9.4.9.9V6H4.3c-.5 0-.9.3-1.1.7L1.5 11V3.9c0-.5.4-.9.9-.9z"
          />
          <path fill="currentColor" d="M3.6 7h11.2l-1.7 5.4c-.1.4-.5.6-.9.6H1.9z" />
        </>
      ) : (
        <path
          fill="currentColor"
          d="M1.5 3.9c0-.5.4-.9.9-.9h3.3l1.4 1.5h6.5c.5 0 .9.4.9.9v6.7c0 .5-.4.9-.9.9H2.4c-.5 0-.9-.4-.9-.9z"
        />
      )}
    </svg>
  )
}

function MarkdownIcon() {
  return (
    <svg className="tree-icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="3.5" width="14" height="9" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M3.6 10.3V5.8l1.6 2 1.6-2v4.5M10.8 5.8v4.3m-1.5-1.5 1.5 1.6 1.5-1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DirectoryItem({ node, ...context }: TreeContext & { node: DirectoryNode }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <li>
      <button
        type="button"
        className="tree-row tree-directory"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="tree-chevron" aria-hidden="true">
          <svg
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </span>
        <FolderIcon open={expanded} />
        <span className="tree-directory-name">{node.name}</span>
      </button>
      {expanded && <Tree {...context} nodes={node.children} />}
    </li>
  )
}

function Tree({ nodes, activePath, dirty, onSelectFile }: TreeContext & { nodes: FileTreeNode[] }) {
  return (
    <ul className="tree">
      {nodes.map((node) =>
        node.kind === 'directory' ? (
          <DirectoryItem key={node.path} node={node} activePath={activePath} dirty={dirty} onSelectFile={onSelectFile} />
        ) : (
          <li key={node.path}>
            <button
              type="button"
              className="tree-row tree-file"
              aria-current={node.path === activePath ? 'page' : undefined}
              title={node.path}
              onClick={() => onSelectFile(node.path)}
            >
              <MarkdownIcon />
              <span className="tree-file-name">{node.name}</span>
              {dirty && node.path === activePath && <UnsavedDot />}
            </button>
          </li>
        ),
      )}
    </ul>
  )
}

export function Sidebar({ folder, activePath, dirty, onSelectFile, onOpenFolder }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Files">
      <header className="sidebar-header">
        <span className="sidebar-title" title={folder?.rootPath}>
          {folder ? fileName(folder.rootPath) : 'No folder open'}
        </span>
        <button type="button" className="sidebar-open" onClick={onOpenFolder}>
          Open Folder
        </button>
      </header>
      {folder && folder.tree.length === 0 && <p className="sidebar-empty">No Markdown files in this folder.</p>}
      {folder && folder.tree.length > 0 && (
        <Tree nodes={folder.tree} activePath={activePath} dirty={dirty} onSelectFile={onSelectFile} />
      )}
    </nav>
  )
}
