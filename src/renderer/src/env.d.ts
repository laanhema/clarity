import type { JSX as ReactJSX } from 'react'
import type { LanternApi } from '../../shared/api'

declare global {
  interface Window {
    lantern: LanternApi
  }

  // hast-util-to-jsx-runtime types its output with the global JSX namespace,
  // which React 19 no longer declares. Point it at React's.
  namespace JSX {
    type Element = ReactJSX.Element
    type ElementClass = ReactJSX.ElementClass
    type IntrinsicElements = ReactJSX.IntrinsicElements
  }
}
