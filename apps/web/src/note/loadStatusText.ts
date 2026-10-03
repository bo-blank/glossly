import type { LoadStatus } from '@glossly/shared';

/** The margin note's line while the model server has not answered yet. */
export function loadStatusText(status: LoadStatus, configuredModel: string): string {
  switch (status.state) {
    case 'busy':
      return `${status.model} is still answering another request — ${configuredModel} is next.`;
    case 'loading':
      return `Loading ${status.model}… the first request after a model switch takes a moment.`;
    default:
      return 'Waiting for the model server…';
  }
}
