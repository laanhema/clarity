import type { MdpadApi } from '../../shared/api'

declare global {
  interface Window {
    mdpad: MdpadApi
  }
}
