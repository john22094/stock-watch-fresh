import { useEffect, useState } from "react";

export type AlertSettings = {
  daysBefore: number;
  soundEnabled: boolean;
  popupEnabled: boolean;
};

const KEY = "validup_alert_settings";

const DEFAULTS: AlertSettings = {
  daysBefore: 7,
  soundEnabled: true,
  popupEnabled: true,
};

export function loadAlertSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveAlertSettings(s: AlertSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("validup-alert-settings", { detail: s }));
}

export function useAlertSettings() {
  const [settings, setSettings] = useState<AlertSettings>(loadAlertSettings);
  useEffect(() => {
    const handler = (e: any) => setSettings(e.detail);
    window.addEventListener("validup-alert-settings", handler);
    return () => window.removeEventListener("validup-alert-settings", handler);
  }, []);
  return [settings, (s: AlertSettings) => { saveAlertSettings(s); setSettings(s); }] as const;
}

/** Plays a short notification beep using WebAudio (no asset required). */
export function playAlertBeep() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // ignore
  }
}
