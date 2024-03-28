// soundSynthesis.js
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let oscillators = {};
var allStopped = false;

const createAdsrEnvelope = (gainNode, strikeGain) => {
  const currentTime = audioCtx.currentTime;
  gainNode.gain.setValueAtTime(0*strikeGain, currentTime);
  gainNode.gain.linearRampToValueAtTime(1*strikeGain, currentTime + 0.1); // Attack
  gainNode.gain.linearRampToValueAtTime(0.7*strikeGain, currentTime + 0.3); // Decay to Sustain
};

//absolute distance between two points
function absDist(point1, point2) {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2) +
    Math.pow(point2.z - point1.z, 2)
  );
}

const stopOsc = (fingerKey) =>{
  const { oscillator, gainNode } = oscillators[fingerKey];
  gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
  oscillator.stop(audioCtx.currentTime + 0.5);
  delete oscillators[fingerKey];
}

const stopAll = () => {
  if(! allStopped){
  Object.keys(oscillators).forEach(fingerKey => {
    stopOsc(fingerKey);
  });
  console.log("stop all");
  allStopped = true;
}
}

const handleFingerState = (landmarks) => {

  const thumbTip = landmarks[4];
  const fingertips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
  const wrist = landmarks[0];

  const noteFrequencies = [261.63, 293.66, 329.63, 349.23];


  fingertips.forEach((tip, fingerIndex) => {
    const distance = absDist(tip, thumbTip);
    const fingerKey = `finger${fingerIndex}`;

    if (distance < 0.1 && !oscillators[fingerKey]) {
      allStopped = false;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(noteFrequencies[fingerIndex], audioCtx.currentTime);
      oscillator.connect(gainNode).connect(audioCtx.destination);
      createAdsrEnvelope(gainNode, 0.25);
      oscillator.start();
      oscillators[fingerKey] = { oscillator, gainNode, wristStart: wrist, freq: noteFrequencies[fingerIndex] };
    } else if (distance > 0.2 && oscillators[fingerKey]) 
    {
      stopOsc(fingerKey);
    }
  });

  // update pitch

  Object.keys(oscillators).forEach(fingerKey => {
    const { oscillator, wristStart, freq } = oscillators[fingerKey];
    //const distance = absDist(wristStart, wrist);
    var distance = wrist.y - wristStart.y;
    if(distance > 0.3){
      distance -= 0.3;
    }
    else if(distance < -0.3){
      distance += 0.3;
    }

    const pitchBend = (1 +distance) * 3;
    oscillator.frequency.setValueAtTime(freq *pitchBend, audioCtx.currentTime);
  });

};

export { handleFingerState, stopAll };
