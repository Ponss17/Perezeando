let started = false;

/** La ficha se pide al pasar el cursor, no durante el primer pintado. */
export function prefetchDetails() {
  if (started) return;
  started = true;
  void import('../features/detail/PlaceDetail');
  void import('../features/detail/ProvinceDetail');
}
