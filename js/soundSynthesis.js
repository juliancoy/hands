// soundSynthesis.js
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let oscillators = {};

const createAdsrEnvelope = (gainNode) => {
  const currentTime = audioCtx.currentTime;
  gainNode.gain.setValueAtTime(0, currentTime);
  gainNode.gain.linearRampToValueAtTime(1, currentTime + 0.1); // Attack
  gainNode.gain.linearRampToValueAtTime(0.7, currentTime + 0.3); // Decay to Sustain
};

const handleFingerState = (fingerIndex, touching, wristY) => {
  const noteFrequencies = [261.63, 293.66, 329.63, 349.23];
  const fingerKey = `finger${fingerIndex}`;

  if (touching && !oscillators[fingerKey]) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(noteFrequencies[fingerIndex - 5], audioCtx.currentTime);
    oscillator.connect(gainNode).connect(audioCtx.destination);
    createAdsrEnvelope(gainNode);
    oscillator.start();
    oscillators[fingerKey] = { oscillator, gainNode, wristStart: wristY, freq: noteFrequencies[fingerIndex - 5]};
  } else if (!touching && oscillators[fingerKey]) {
    const { oscillator, gainNode } = oscillators[fingerKey];
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    oscillator.stop(audioCtx.currentTime + 0.5);
    delete oscillators[fingerKey];
  }
};

const updatePitch = (wristY) => {
  Object.keys(oscillators).forEach(fingerKey => {
    const { oscillator, wristStart, freq } = oscillators[fingerKey];
    const pitchBend = (wristStart - wristY) * 5;
    oscillator.frequency.setValueAtTime(freq + pitchBend, audioCtx.currentTime);
  });
};

export { handleFingerState, updatePitch };
