import cv2
import mediapipe as mp
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
mp_hands = mp.solutions.hands

# MIDI STUFF
"""Show how to open an output port and send MIDI events."""

import logging
import sys
import time
import numpy as np

from rtmidi.midiutil import open_midioutput
from rtmidi.midiconstants import *

#class HandLandmark(enum.IntEnum):
"""The 21 hand landmarks."""
WRIST = 0
THUMB_CMC = 1
THUMB_MCP = 2
THUMB_IP = 3
THUMB_TIP = 4
INDEX_FINGER_MCP = 5
INDEX_FINGER_PIP = 6
INDEX_FINGER_DIP = 7
INDEX_FINGER_TIP = 8
MIDDLE_FINGER_MCP = 9
MIDDLE_FINGER_PIP = 10
MIDDLE_FINGER_DIP = 11
MIDDLE_FINGER_TIP = 12
RING_FINGER_MCP = 13
RING_FINGER_PIP = 14
RING_FINGER_DIP = 15
RING_FINGER_TIP = 16
PINKY_MCP = 17
PINKY_PIP = 18
PINKY_DIP = 19
PINKY_TIP = 20
    
log = logging.getLogger('midiout')
logging.basicConfig(level=logging.DEBUG)

# Prompts user for MIDI input port, unless a valid port number or name
# is given as the first argument on the command line.
# API backend defaults to ALSA on Linux.
port = sys.argv[1] if len(sys.argv) > 1 else None

try:
    midiout, port_name = open_midioutput(port,use_virtual=True)
except (EOFError, KeyboardInterrupt):
    sys.exit()

sounding = np.array([[False]*22]*2)
starty = np.array([[0.0]*22]*2)

finger2noteRyukyu = [
    [
    [INDEX_FINGER_TIP,  60],  # C
    [MIDDLE_FINGER_TIP, 64],  # E
    [RING_FINGER_TIP,   65],  # F 
    [PINKY_TIP,         67]], # G
    
    [
    [INDEX_FINGER_TIP,  77], # F
    [MIDDLE_FINGER_TIP, 79], # G
    [RING_FINGER_TIP,   83], # B
    [PINKY_TIP,         84]] # C
   
]

finger2notePenta = [
    [
    [INDEX_FINGER_TIP,  60],  # C
    [MIDDLE_FINGER_TIP, 62],  # D
    [RING_FINGER_TIP,   64],  # E 
    [PINKY_TIP,         67]], # G
    
    [
    [INDEX_FINGER_TIP,  69], # A
    [MIDDLE_FINGER_TIP, 72], # C 
    [RING_FINGER_TIP,   76], # E
    [PINKY_TIP,         79]] # G
   
]

finger2note = finger2notePenta
# For webcam input:
cap = cv2.VideoCapture(0)
with mp_hands.Hands(
    model_complexity=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5) as hands:
  while cap.isOpened():
    success, image = cap.read()
    if not success:
      print("Ignoring empty camera frame.")
      # If loading a video, use 'break' instead of 'continue'.
      continue

    # To improve performance, optionally mark the image as not writeable to
    # pass by reference.
    image.flags.writeable = False
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = hands.process(image)

    # Draw the hand annotations on the image.
    image.flags.writeable = True
    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    
    rightDetected = False
    leftDetected  = False
    
    if results.multi_hand_landmarks:
      
      for i, hand_landmarks in enumerate(results.multi_hand_landmarks):
        mp_drawing.draw_landmarks(
            image,
            hand_landmarks,
            mp_hands.HAND_CONNECTIONS,
            mp_drawing_styles.get_default_hand_landmarks_style(),
            mp_drawing_styles.get_default_hand_connections_style())
        
        landmark = hand_landmarks.landmark
        handNum = int(landmark[5].x>landmark[17].x)
        
        if(handNum):
            rightDetected = True
            #print("right")
        else:
            leftDetected  = True
            #print("left")
            
        wrist_y = landmark[WRIST].y
        thumb_y = landmark[THUMB_TIP].y
        thumb_z = landmark[THUMB_TIP].z
       
        for finger, note in finger2note[handNum]:
            tipArray   = np.array([landmark[finger].x, landmark[finger].y])
            thumbArray = np.array([landmark[THUMB_TIP].x, landmark[THUMB_TIP].y])
            tipToThumbDist = abs(np.sqrt(np.sum(np.square(tipArray - thumbArray)))) / abs(thumb_z**0.8)
            #if finger == INDEX_FINGER_TIP:
            #    print(tipToThumbDist)
            #print(handNum)
            if sounding[handNum,finger]:
                
                #only right hand controls bend
                if(handNum):
                    bend = int((starty[handNum,finger] - wrist_y)*(2**13)) + 0x2000
                    #print(bend) 
                    midiout.send_message([PITCH_BEND, bend & 0x7f, (bend >> 7) & 0x7f])

                if tipToThumbDist > 0.9 and tipToThumbDist != 0:
                    #print("Sending NoteOff event.")
                    note_off = [NOTE_OFF, note, 0]
                    midiout.send_message(note_off)
                    sounding[handNum,finger] = False

            else:

                if tipToThumbDist < 0.5 and tipToThumbDist != 0:
                    bend = 0x2000
                    midiout.send_message([PITCH_BEND, bend & 0x7f, (bend >> 7) & 0x7f])
                    starty[handNum,finger] = wrist_y
                    sounding[handNum,finger] = True
                    #print("Sending NoteOn event.")
                    note_on = [NOTE_ON, note, 112]  # channel 1, middle C, velocity 112
                    midiout.send_message(note_on)
                    
    if not rightDetected:
        for finger, note in finger2note[1]:
            note_off = [NOTE_OFF, note, 0]
            midiout.send_message(note_off)
    if not leftDetected:
        for finger, note in finger2note[0]:
            note_off = [NOTE_OFF, note, 0]
            midiout.send_message(note_off)
            
            
        
    # Flip the image horizontally for a selfie-view display.
    cv2.imshow('MediaPipe Hands', cv2.flip(image, 1))
    if cv2.waitKey(5) & 0xFF == 27:
      break
    
cap.release()
del midiout
print("Exit.")
