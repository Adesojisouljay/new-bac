/**
 * SpeechService handles Browser-based Text-to-Speech (TTS)
 */
class SpeechService {
    private synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
    private gender: 'male' | 'female' = (localStorage.getItem('ai_voice_gender') as 'male' | 'female') || 'female';

    /**
     * Set the preferred voice gender
     */
    setGender(gender: 'male' | 'female') {
        this.gender = gender;
        localStorage.setItem('ai_voice_gender', gender);
    }

    /**
     * Get the current voice gender
     */
    getGender(): 'male' | 'female' {
        return this.gender;
    }

    /**
     * Speak the provided text, stripping markdown code blocks first
     */
    speak(text: string, onEnd?: () => void) {
        if (!this.synth) return;

        this.stop();

        let cleanText = text.replace(/```[\s\S]*?```/g, '');
        cleanText = cleanText
            .replace(/[*#_>`~]/g, '')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .trim();

        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);

        const voices = this.synth.getVoices();

        // Find a voice matching the gender preference
        let preferredVoice;
        if (this.gender === 'female') {
            preferredVoice = voices.find(v => (v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Female')) && v.lang.includes('en'))
                || voices.find(v => v.lang.includes('en-US')) || voices[0];
        } else {
            preferredVoice = voices.find(v => (v.name.includes('Alex') || v.name.includes('Daniel') || v.name.includes('Male')) && v.lang.includes('en'))
                || voices.find(v => v.lang.includes('en-GB')) || voices[0];
        }

        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        if (onEnd) utterance.onend = onEnd;

        this.synth.speak(utterance);
    }

    /**
     * Stop all ongoing speech
     */
    stop() {
        if (this.synth) {
            this.synth.cancel();
        }
    }

    /**
     * Check if currently speaking
     */
    isSpeaking(): boolean {
        return this.synth?.speaking || false;
    }
}

export const speechService = new SpeechService();
