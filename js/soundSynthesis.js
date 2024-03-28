// soundSynthesis.js
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var noteEvents = { Left: [], Right: [] };
var allStopped = false;
const noteFrequenciesRight = [261.63, 293.66, 329.63, 349.23].map(frequency => frequency / 8); // Halve twice for two octaves down
const noteFrequenciesLeft = [261.63, 293.66, 329.63, 349.23].map(frequency => frequency / 4); // Left hand frequencies remain unchanged
var initialized = false;

const absDist = (point1, point2) => {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2) +
    Math.pow(point2.z - point1.z, 2)
  );
}

class NoteEvent {
  constructor(frequency, audioCtx, oscCount = 3) {
    this.audioCtx = audioCtx
    this.freq = frequency;
    this.oscillators = [];
    this.gainNode = audioCtx.createGain();
    for (let oscNo = 0; oscNo < oscCount; oscNo++) {
      // Create a new oscillator for each iteration
      var newOsc = audioCtx.createOscillator();
      newOsc.type = 'sawtooth';  // Set oscillator type
      newOsc.baseFreq = frequency;
    
      // Calculate detune value based on oscillator's position relative to the center
      var detuneAmount = 18; // Reduced detune amount, adjust as needed
      var detuneValue = (oscNo - (oscCount - 1) / 2) * (detuneAmount / ((oscCount - 1) / 2));    
    
      // Set the oscillator's base frequency
      newOsc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      
      // Apply the detune value to the oscillator
      newOsc.detune.setValueAtTime(detuneValue, audioCtx.currentTime);
    
      // Connect the oscillator to the gain node and then to the destination
      newOsc.connect(this.gainNode).connect(audioCtx.destination);
    
      // Add the oscillator to the array of oscillators
      this.oscillators.push(newOsc);
    }
    

    this.sounding = false;
    this.wristStart = { x: 0, y: 0, z: 0 };
    this.started = false;
  }


  strike(strikeGain) {

    allStopped = false;
    console.log("strike!");
    this.sounding = true;
    const currentTime = this.audioCtx.currentTime;
    this.gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(1 * strikeGain, currentTime + 0.2); // Attack
    this.gainNode.gain.linearRampToValueAtTime(0.7 * strikeGain, currentTime + 0.3); // Decay to Sustain
    if (!this.started) {
      this.started = true;
      this.oscillators.forEach(osc=>{
        osc.start();
      })
    }
  }

  release() {
    this.sounding = false;
    console.log("release!");
    const currentTime = this.audioCtx.currentTime;
    this.gainNode.gain.cancelScheduledValues(0);
    this.gainNode.gain.linearRampToValueAtTime(0, currentTime + 0.5);
  }

  /*stop() {
    const currentTime = this.audioCtx.currentTime;
    this.oscillator.stop(currentTime + 0.5);
  }*/
}


const initialize = () => {
  console.log("initialize");
  for (let fingerIndex = 0; fingerIndex < 4; fingerIndex++) {
    noteEvents.Left.push(new NoteEvent(noteFrequenciesLeft[fingerIndex], audioCtx));
    noteEvents.Right.push(new NoteEvent(noteFrequenciesRight[fingerIndex], audioCtx));
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => {
      console.log("Audio Context resumed!");
    }).catch(e => console.error(e));
  }
  initialized = true;
}

const handleFingerState = (landmarks, hand) => {

  hand = hand[0].displayName;

  if (!initialized) {
    initialize()
  }
  const thumbTip = landmarks[4];
  const fingertips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
  const wrist = landmarks[0];

  fingertips.forEach((tip, fingerIndex) => {
    const distance = absDist(tip, thumbTip);
    const noteEvent = noteEvents[hand][fingerIndex];

    if (distance < 0.07) {
      if (!noteEvent.sounding) {
        noteEvent.wristStart = wrist;
        noteEvent.strike(0.1);
      }

    } else if (distance > 0.12) {
      if (noteEvent.sounding) {
        noteEvent.release();
      }
    }
  });

  // update pitch
  updatePitch(wrist, hand);
};

const updatePitch = (wrist, hand) => {

  noteEvents[hand].forEach(noteEvent => {
    noteEvent.oscillators.forEach(osc => {
      //const distance = absDist(wristStart, wrist);
      var distance = wrist.y - noteEvent.wristStart.y;

      // minimum distance for pitchBend
      const minPB = 1;
      if (distance > minPB) {
        distance -= minPB;
      }
      else if (distance < -minPB) {
        distance += minPB;
      }

      const pitchBend = (1 - distance) * 3;
      osc.frequency.setValueAtTime(osc.baseFreq * pitchBend, audioCtx.currentTime + 0.01);

    });
  });

}

const stopAll = () => {
  if (!allStopped) {
    noteEvents.Left.forEach(event => {
      event.release();
    });
    noteEvents.Right.forEach(event => {
      event.release();
    });
    console.log("stop all");
    allStopped = true;
  }
}

export { handleFingerState, stopAll, initialize };
