// Shelly 1 Gen3
// Doppelimpuls mit konfigurierbaren Zeiten

// -----------------------------
// Konfiguration
// -----------------------------
let ON_TIME = 700;            // Relais EIN (inkl. "halten")
let PAUSE_BETWEEN = 1500;      // Pause zwischen den beiden Impulsen
let PAUSE_CYCLE = 1000*60*4;       // Pause bis zum nächsten Doppelimpuls
// -----------------------------

let step = 0;

function relay(on) {
  Shelly.call("Switch.Set", {
    id: 0,
    on: on
  });
}

function next() {
  switch (step) {

    case 0: // 1. Impuls EIN
      relay(true);
      step = 1;
      Timer.set(ON_TIME, false, next);
      break;

    case 1: // AUS
      relay(false);
      step = 2;
      Timer.set(PAUSE_BETWEEN, false, next);
      break;

    case 2: // 2. Impuls EIN
      relay(true);
      step = 3;
      Timer.set(ON_TIME, false, next);
      break;

    case 3: // AUS
      relay(false);
      step = 4;
      Timer.set(PAUSE_CYCLE, false, next);
      break;

    case 4:
      step = 0;
      next();
      break;
  }
}

// Start
relay(false);
next();
