// Change an issue's status straight from a list, without opening it.
import { api, type Issue, type Status } from './api';
import { store } from './store.svelte';

class Quick {
  /** The issue whose status picker is open, if any. */
  issue = $state<Issue | null>(null);

  async setStatus(issue: Issue, status: Status) {
    if (issue.status === status) return;
    const before = issue.status;
    // Show it at once; the sync that follows brings the server's copy.
    store.issues[issue.id] = { ...issue, status, updated_at: new Date().toISOString() };
    try {
      await api.updateIssue(issue.identifier, { status });
      navigator.vibrate?.(10);
    } catch (e) {
      store.issues[issue.id] = { ...issue, status: before };
      store.handleError(e);
    }
    store.sync();
  }
}

export const quick = new Quick();
