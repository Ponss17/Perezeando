import { useEffect } from 'react';
import { useApp, setApp } from '../store/useApp';
import { useData } from '../data/load';
import { computeRoute, routeKey } from '../features/route/routing';
import type { Place } from '../data/types';

export function useRouteCompute() {
  const route = useApp((s) => s.route);
  const data = useData((s) => s.data);
  useEffect(() => {
    if (!data) return;
    const stops = route.map((id) => data.byId.get(id)).filter(Boolean) as Place[];
    if (stops.length < 2) {
      setApp({ routeData: null, routeLoading: false });
      return;
    }
    const key = routeKey(route);
    if (useApp.getState().routeData?.key === key) return;
    const ctl = new AbortController();
    setApp({ routeLoading: true });
    computeRoute(stops, ctl.signal).then((r) => {
      if (ctl.signal.aborted || routeKey(useApp.getState().route) !== r.key) return;
      setApp({ routeData: r, routeLoading: false });
    });
    return () => ctl.abort();
  }, [route, data]);
}
