import {apiUrl, isNativeAppRuntime} from './api';

let activeAudio: HTMLAudioElement | null = null;
let activePlayId = 0;

// LRU-like audio cache so clicking "Répéter" in Dictée plays instantaneously
const audioCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 40;

function cacheAudio(key: string, dataUrl: string) {
  if (audioCache.has(key)) {
    audioCache.delete(key);
  } else if (audioCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = audioCache.keys().next().value;
    if (oldest) audioCache.delete(oldest);
  }
  audioCache.set(key, dataUrl);
}

export function stopFrenchSpeech(): void {
  activePlayId++;
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export function hasFrenchBrowserVoice(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  try {
    const voices = window.speechSynthesis.getVoices();
    return voices.some((v) => v.lang.toLowerCase().startsWith('fr'));
  } catch {
    return false;
  }
}

async function playAudioDataUrl(dataUrl: string, playbackRate: number, playId: number): Promise<boolean> {
  if (playId !== activePlayId) return false;
  return new Promise<boolean>((resolve) => {
    try {
      const audio = new Audio(dataUrl);
      activeAudio = audio;
      audio.playbackRate = Math.min(1.3, Math.max(0.65, playbackRate));
      audio.onended = () => {
        if (activeAudio === audio) activeAudio = null;
        resolve(true);
      };
      audio.onerror = () => {
        if (activeAudio === audio) activeAudio = null;
        resolve(false);
      };
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {
          if (activeAudio === audio) activeAudio = null;
          resolve(false);
        });
      }
    } catch {
      resolve(false);
    }
  });
}

async function speakViaServerTts(cleanText: string, slow: boolean, rate: number, playId: number): Promise<boolean> {
  const cacheKey = `${slow ? 'slow' : 'norm'}::${cleanText}`;
  const cached = audioCache.get(cacheKey);
  if (cached) {
    return playAudioDataUrl(cached, slow ? 0.94 : Math.min(1.05, Math.max(0.85, rate)), playId);
  }

  try {
    const res = await fetch(apiUrl('/api/tts'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text: cleanText, slow}),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {audioBase64?: string; mimeType?: string};
    if (!data.audioBase64 || playId !== activePlayId) return false;
    const mime = data.mimeType || 'audio/wav';
    const dataUrl = `data:${mime};base64,${data.audioBase64}`;
    cacheAudio(cacheKey, dataUrl);
    return playAudioDataUrl(dataUrl, slow ? 0.94 : Math.min(1.05, Math.max(0.85, rate)), playId);
  } catch {
    return false;
  }
}

function speakViaBrowserSynth(cleanText: string, rate: number, playId: number): Promise<boolean> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'fr-FR';
      utterance.rate = rate;
      const voices = window.speechSynthesis.getVoices();
      const frVoice = voices.find((v) => v.lang.toLowerCase().startsWith('fr'));
      if (frVoice) {
        utterance.voice = frVoice;
      }

      let started = false;
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      const startTimer = window.setTimeout(() => {
        if (!started) {
          try {
            window.speechSynthesis.cancel();
          } catch {
            // ignore
          }
          finish(false);
        }
      }, 950);

      utterance.onstart = () => {
        started = true;
        window.clearTimeout(startTimer);
      };
      utterance.onend = () => {
        window.clearTimeout(startTimer);
        finish(true);
      };
      utterance.onerror = () => {
        window.clearTimeout(startTimer);
        finish(false);
      };

      if (playId !== activePlayId) {
        window.clearTimeout(startTimer);
        finish(false);
        return;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      resolve(false);
    }
  });
}

export interface SpeakFrenchOptions {
  onError?: (message: string) => void;
}

export async function speakFrench(
  text: string,
  rate = 0.92,
  options?: SpeakFrenchOptions
): Promise<boolean> {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return false;

  stopFrenchSpeech();
  const playId = activePlayId;
  const slow = rate <= 0.8;

  // Prefer server Gemini TTS when native app (Android WebView) or when no local French voice exists
  const preferServerTts = isNativeAppRuntime() || !hasFrenchBrowserVoice();

  if (preferServerTts) {
    const serverOk = await speakViaServerTts(cleanText, slow, rate, playId);
    if (serverOk) return true;
    if (playId !== activePlayId) return false;

    const nativeOk = await speakViaBrowserSynth(cleanText, rate, playId);
    if (nativeOk) return true;
  } else {
    const nativeOk = await speakViaBrowserSynth(cleanText, rate, playId);
    if (nativeOk) return true;
    if (playId !== activePlayId) return false;

    const serverOk = await speakViaServerTts(cleanText, slow, rate, playId);
    if (serverOk) return true;
  }

  options?.onError?.(
    'Synthèse vocale indisponible hors-ligne sans voix française locale. Vérifiez votre connexion pour utiliser la voix Gemini.'
  );
  return false;
}
