const BEEP_MAIN = "/sounds/computerbeep_65.mp3";
const BEEP_SUBMIT = "/sounds/computerbeep_63.mp3";
const BEEP_REFRESH = "/sounds/computerbeep_42.mp3";
const BEEP_WATCHLIST_REMOVE = "/sounds/computerbeep_59.mp3";
const BEEP_ERROR = "/sounds/computer_error.mp3";

let audioMain: HTMLAudioElement | null = null;
let audioSubmit: HTMLAudioElement | null = null;
let audioRefresh: HTMLAudioElement | null = null;
let audioWatchlistRemove: HTMLAudioElement | null = null;
let audioErr: HTMLAudioElement | null = null;

function ensureMain() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!audioMain) {
    audioMain = new Audio(BEEP_MAIN);
    audioMain.preload = "auto";
  }
  return audioMain;
}

function ensureSubmit() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!audioSubmit) {
    audioSubmit = new Audio(BEEP_SUBMIT);
    audioSubmit.preload = "auto";
  }
  return audioSubmit;
}

function ensureRefresh() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!audioRefresh) {
    audioRefresh = new Audio(BEEP_REFRESH);
    audioRefresh.preload = "auto";
  }
  return audioRefresh;
}

function ensureWatchlistRemove() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!audioWatchlistRemove) {
    audioWatchlistRemove = new Audio(BEEP_WATCHLIST_REMOVE);
    audioWatchlistRemove.preload = "auto";
  }
  return audioWatchlistRemove;
}

function ensureErr() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!audioErr) {
    audioErr = new Audio(BEEP_ERROR);
    audioErr.preload = "auto";
  }
  return audioErr;
}

/** Warm buffers for main, submit, refresh, beep 59 (watchlist remove / reader close), and error clips. */
export function preloadButtonBeeps() {
  for (const audio of [ensureMain(), ensureSubmit(), ensureRefresh(), ensureWatchlistRemove(), ensureErr()]) {
    if (audio) {
      void audio.load();
    }
  }
}

/** Default control click (buttons, pills, rail)—`computerbeep_65`. */
export function playButtonBeep() {
  const audio = ensureMain();
  if (!audio) {
    return;
  }
  audio.volume = 0.55;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

/** Form submit / primary confirm—`computerbeep_63`. */
export function playSubmitBeep() {
  const audio = ensureSubmit();
  if (!audio) {
    return;
  }
  audio.volume = 0.55;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

/** RSS manual refresh—`computerbeep_42`. */
export function playRefreshBeep() {
  const audio = ensureRefresh();
  if (!audio) {
    return;
  }
  audio.volume = 0.55;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

function playBeep59Clip() {
  const audio = ensureWatchlistRemove();
  if (!audio) {
    return;
  }
  audio.volume = 0.55;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

/** Watchlist row remove—`computerbeep_59`. */
export function playWatchlistRemoveBeep() {
  playBeep59Clip();
}

/** RSS article reader close (`×`)—`computerbeep_59`. */
export function playReaderCloseBeep() {
  playBeep59Clip();
}

export function playErrorBeep() {
  const audio = ensureErr();
  if (!audio) {
    return;
  }
  audio.volume = 0.55;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

function isSubmitLikeClick(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }
  const node = target.closest("button, input");
  if (!node) {
    return false;
  }
  if (node instanceof HTMLInputElement && node.type === "submit") {
    return true;
  }
  if (node instanceof HTMLButtonElement) {
    return node.type === "submit";
  }
  return false;
}

export function isButtonLikeTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (
    target.closest(
      "form.market-telemetry-form button[type='submit'], form.watchlist-form button[type='submit'], form.news-rss-form button[type='submit']",
    )
  ) {
    return false;
  }

  if (target.closest("button.watchlist-remove-btn")) {
    return false;
  }

  if (target.closest("button.watchlist-drag-handle")) {
    return false;
  }

  if (target.closest("button.watchlist-row-main")) {
    return false;
  }

  if (target.closest("button.news-reader-close-x")) {
    return false;
  }

  if (target.closest("button.news-rss-refresh")) {
    return false;
  }

  return Boolean(
    target.closest("button, input[type='submit'], input[type='button'], input[type='reset']") ||
      target.closest("a.control-pill, nav.lcars-rail a"),
  );
}

/** Which non-error beep to play for this click target (global handler). */
export function beepForClickTarget(target: EventTarget | null) {
  return isSubmitLikeClick(target) ? playSubmitBeep : playButtonBeep;
}
