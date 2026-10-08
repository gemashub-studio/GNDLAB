'use client';

import { TOUR_EVENT } from './Tour';

export function ReopenTour() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}>
      Putar tur lagi
    </button>
  );
}
