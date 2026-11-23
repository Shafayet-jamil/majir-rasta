// কিবোর্ড + মোবাইলের টাচ বাটন
export const keys = { left: false, right: false, up: false, down: false, boost: false };
const pressedOnce = new Set();

const MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'boost', ShiftLeft: 'boost', ShiftRight: 'boost',
};
const ONCE = {
  KeyH: 'horn', KeyP: 'pause', Escape: 'pause', Digit1: 'opt1', Numpad1: 'opt1', Digit2: 'opt2', Numpad2: 'opt2',
  Enter: 'enter', KeyM: 'mute',
};

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (MAP[e.code]) {
      keys[MAP[e.code]] = true;
      e.preventDefault();
    }
    if (ONCE[e.code] && !e.repeat) pressedOnce.add(ONCE[e.code]);
  });
  window.addEventListener('keyup', (e) => {
    if (MAP[e.code]) keys[MAP[e.code]] = false;
  });
  window.addEventListener('blur', () => {
    Object.keys(keys).forEach((k) => (keys[k] = false));
    pressedOnce.add('blur');
  });

  // টাচ বাটন: data-key="left" ইত্যাদি
  document.querySelectorAll('[data-key]').forEach((el) => {
    const k = el.dataset.key;
    const down = (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('on');
      if (k in keys) keys[k] = true;
      else pressedOnce.add(k);
    };
    const up = (e) => {
      e.preventDefault();
      el.classList.remove('on');
      if (k in keys) keys[k] = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}

// একবার চাপা বাটন (হর্ন, পজ ইত্যাদি) — পড়লেই মুইছা যায়
export function consume(name) {
  if (pressedOnce.has(name)) {
    pressedOnce.delete(name);
    return true;
  }
  return false;
}
export function clearOnce() {
  pressedOnce.clear();
}
