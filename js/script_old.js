const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let oscillators = {};

const loadHandpose = async () => {
    const net = await handpose.load({
        maxNumHands: 2,
        detectionConfidence: 0.2,
        trackingConfidence: 0.9
    });
    
    return net;
};

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
        const { oscillator, gainNode, wristStart, freq } = oscillators[fingerKey];
        const pitchBend = (wristStart - wristY) * 5;
        oscillator.frequency.setValueAtTime(freq + pitchBend, audioCtx.currentTime);
    });
};

// Define hand connections manually
const handConnections = [
    [0, 1], [1, 2], [2, 3], [3, 4],   // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8],   // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17], // Connections between fingers
];

const detectHands = async (net) => {
    const handEstimates = await net.estimateHands(video);
    context.clearRect(0, 0, canvas.width, canvas.height); // Clear previous drawings

    if (handEstimates.length > 0) {
        const hand = handEstimates[0];
        const landmarks = hand.landmarks;
        const thumbTip = landmarks[4];
        const fingertips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
        const wrist = landmarks[0];

        // Draw landmarks
        landmarks.forEach(landmark => {
            context.beginPath();
            context.arc(landmark[0], landmark[1], 5, 0, 2 * Math.PI);
            context.fillStyle = 'red';
            context.fill();
        });

        // Draw connections
        handConnections.forEach(([startIdx, endIdx]) => {
            const start = landmarks[startIdx];
            const end = landmarks[endIdx];
            context.beginPath();
            context.moveTo(start[0], start[1]);
            context.lineTo(end[0], end[1]);
            context.strokeStyle = 'green';
            context.lineWidth = 2;
            context.stroke();
        });

        fingertips.forEach((tip, index) => {
            const distance = Math.sqrt(Math.pow(tip[0] - thumbTip[0], 2) + Math.pow(tip[1] - thumbTip[1], 2));
            const touching = distance < 20;
            handleFingerState(index + 5, touching, wrist[1]);
        });

        updatePitch(wrist[1]);
    }
};


const setupWebcam = () => {
    return new Promise((resolve, reject) => {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                video.srcObject = stream;
                video.addEventListener('loadeddata', () => resolve());
            })
            .catch(reject);
    });
};

const runHandpose = async () => {
    const net = await loadHandpose();
    await setupWebcam();

    const detect = async () => {
        await detectHands(net);
        requestAnimationFrame(detect);
    };

    detect();
};

runHandpose();