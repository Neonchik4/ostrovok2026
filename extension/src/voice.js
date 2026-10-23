/**
 * Web Speech API Voice Controller & Speech Synthesis
 * Captures microphone input and synthesizes friendly Russian responses.
 */

export class VoiceController {
  constructor(onTranscript, onListeningChange) {
    this.onTranscript = onTranscript;
    this.onListeningChange = onListeningChange;
    this.recognition = null;
    this.isListening = false;

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.lang = "ru-RU";
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onListeningChange) this.onListeningChange(true);
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript && this.onTranscript) {
        this.onTranscript(transcript);
      }
    };

    this.recognition.onerror = () => {
      this.stop();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onListeningChange) this.onListeningChange(false);
    };
  }

  start() {
    if (!this.recognition || this.isListening) return;
    try {
      this.recognition.start();
    } catch {
      // Ignored if already active
    }
  }

  stop() {
    if (!this.recognition || !this.isListening) return;
    try {
      this.recognition.stop();
    } catch {
      // Ignored
    }
    this.isListening = false;
    if (this.onListeningChange) this.onListeningChange(false);
  }

  toggle() {
    if (this.isListening) this.stop();
    else this.start();
  }
}

/**
 * Speech Synthesis (Audio Output)
 */
export function speakAloud(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[^\w\sа-яА-ЯёЁ.,!?-]/gi, "").trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ru-RU";
    utterance.rate = 1.05;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Graceful fallback if audio permissions are restricted
  }
}
