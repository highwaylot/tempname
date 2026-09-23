// The frame clock and the frame-error tally. Kept apart from main.js on
// purpose: main.js boots at import time and pulls in the stylesheet, so no
// other module may import it, while ui.js needs to reset the clock and show
// the error count.
export var loop = { lastTs: 0, errCount: 0, lastErr: "" };
export function resetClock(){ loop.lastTs = 0; }
