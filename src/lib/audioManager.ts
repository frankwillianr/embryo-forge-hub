/**
 * Gerenciador global de áudio para garantir que apenas um áudio toque por vez
 */

class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listeners: Set<(isPlaying: boolean, audioId: string | null) => void> = new Set();

  // Registrar listener para mudanças de estado
  addListener(callback: (isPlaying: boolean, audioId: string | null) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notificar todos os listeners
  private notifyListeners(isPlaying: boolean, audioId: string | null) {
    this.listeners.forEach(listener => listener(isPlaying, audioId));
  }

  // Parar qualquer áudio que esteja tocando
  stopAll() {
    // Parar áudio HTML
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // Parar Web Speech API
    if (this.currentUtterance) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }

    this.notifyListeners(false, null);
  }

  // Tocar áudio MP3
  async playAudio(url: string, audioId: string): Promise<void> {
    // Para qualquer áudio anterior
    this.stopAll();

    const audio = new Audio(url);
    this.currentAudio = audio;

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        this.currentAudio = null;
        this.notifyListeners(false, null);
        resolve();
      };

      audio.onerror = (error) => {
        this.currentAudio = null;
        this.notifyListeners(false, null);
        reject(error);
      };

      audio.play()
        .then(() => {
          this.notifyListeners(true, audioId);
        })
        .catch(reject);
    });
  }

  // Tocar usando Web Speech API
  playSpeech(text: string, audioId: string): void {
    // Para qualquer áudio anterior
    this.stopAll();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const allVoices = window.speechSynthesis.getVoices();
    const ptVoices = allVoices.filter(v => v.lang.startsWith("pt"));
    if (ptVoices.length > 0) {
      utterance.voice = ptVoices[0];
    }

    utterance.onend = () => {
      this.currentUtterance = null;
      this.notifyListeners(false, null);
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled') {
        this.currentUtterance = null;
        this.notifyListeners(false, null);
      }
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    this.notifyListeners(true, audioId);
  }

  // Verificar se um áudio específico está tocando
  isPlaying(audioId: string): boolean {
    return this.currentAudio !== null || this.currentUtterance !== null;
  }
}

// Instância global
export const audioManager = new AudioManager();
