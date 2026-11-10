import { useApp } from '../store/useApp';

export function Toast() {
  const toast = useApp((s) => s.toast);
  return (
    <div className={'toast' + (toast ? ' show' : '')} role="status" aria-live="polite">
      {toast?.msg}
    </div>
  );
}
