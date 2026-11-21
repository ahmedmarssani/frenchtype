export function speakFrench(text: string, rate = 0.92): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find((v) => v.lang.toLowerCase().startsWith('fr'));
    if (frVoice) {
      utterance.voice = frVoice;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors on unsupported browsers
  }
}
