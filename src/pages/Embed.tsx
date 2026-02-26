import useWidgetBootstrap from '../hooks/useWidgetBootstrap'
import { WidgetLayout } from '../components/WidgetLayout'

export function Embed() {
  useWidgetBootstrap()
  return <WidgetLayout />
}
