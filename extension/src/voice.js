/**
 * Web Speech API Controller for Voice Input
 * Audio synthesis is muted by default as requested.
 */
export class VoiceController {
  constructor(onResultCallback, onStateChangeCallback) {
    this.onResult = onResultCallback;
    this.onStateChange = onStateChangeCallback;
    this.recognition = null;
    this.isListening = false;
    this.init();
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.supported = false;
      return;
    }
    this.supported = true;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = "ru-RU";
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onStateChange) this.onStateChange(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onStateChange) this.onStateChange(false);
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (this.onResult && transcript) {
        this.onResult(transcript);
      }
    };

    this.recognition.onerror = () => {
      this.isListening = false;
      if (this.onStateChange) this.onStateChange(false);
    };
  }

  toggle() {
    if (!this.supported) return;
    if (this.isListening) {
      this.recognition.stop();
    } else {
      try {
        this.recognition.start();
      } catch {
        // already started
      }
    }
  }
}
