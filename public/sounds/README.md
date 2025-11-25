# Sound Effects for Quiz Interactions

Place your audio files in this folder. The following files are expected:

## Required Audio Files

### 1. `correct.mp3`
- **Purpose**: Played when user selects the correct answer
- **Recommended**: A short, positive sound (chime, ding, success tone)
- **Duration**: 0.5-1.5 seconds
- **Example sources**: 
  - https://freesound.org (search "success", "correct", "ding")
  - https://mixkit.co/free-sound-effects/
  - https://pixabay.com/sound-effects/

### 2. `incorrect.mp3`
- **Purpose**: Played when user selects the wrong answer
- **Recommended**: A short, gentle negative sound (soft buzz, low tone)
- **Duration**: 0.5-1 second
- **Tip**: Avoid harsh or jarring sounds to keep learning positive

## Usage in Code

The sounds are loaded and played via the `useSoundEffects` hook:

```tsx
import { useSoundEffects } from '@/hooks/useSoundEffects';

function MyComponent() {
  const { playCorrectSound, playIncorrectSound } = useSoundEffects();
  
  // Call when answer is correct
  playCorrectSound();
  
  // Call when answer is incorrect
  playIncorrectSound();
}
```

## Audio Format Recommendations

- **Format**: MP3 (best browser compatibility) or WAV
- **Quality**: 128kbps or higher for MP3
- **Volume**: Normalize audio to consistent volume levels
- **Size**: Keep files under 100KB for quick loading
