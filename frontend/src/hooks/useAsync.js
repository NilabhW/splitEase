import { useCallback, useEffect, useState } from 'react';

// Runs fn on mount (and when deps change); exposes loading/error/data plus reload for retry buttons.
export default function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    run()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [run]);

  useEffect(reload, [reload]);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: updater(s.data) })), []);

  return { ...state, reload, setData };
}
