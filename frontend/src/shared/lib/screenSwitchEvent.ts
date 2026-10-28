/** Событие смены экрана из шапки: Ghost-агент успевает долететь обратно в тумблер до смены роута. */
export const SCREEN_SWITCH_EVENT = "ostrovok:screen-switch";

export interface ScreenSwitchDetail {
  to: "concierge" | "catalog";
  /** Через сколько мс сменится роут. */
  duration: number;
}

export function emitScreenSwitch(detail: ScreenSwitchDetail): void {
  window.dispatchEvent(new CustomEvent<ScreenSwitchDetail>(SCREEN_SWITCH_EVENT, { detail }));
}
