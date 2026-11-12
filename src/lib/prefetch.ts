let started = false;

export function prefetchDetails() {
  if (started) return;
  started = true;
  void import('../features/detail/PlaceDetail');
  void import('../features/detail/ProvinceDetail');
}
