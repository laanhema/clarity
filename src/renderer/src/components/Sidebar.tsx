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
          {expanded ? '▾' : '▸'}
        </span>
        {node.name}
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
          Open Folder…
        </button>
      </header>
      {folder && folder.tree.length === 0 && <p className="sidebar-empty">No Markdown files in this folder.</p>}
      {folder && folder.tree.length > 0 && (
        <Tree nodes={folder.tree} activePath={activePath} dirty={dirty} onSelectFile={onSelectFile} />
      )}
    </nav>
  )
}
