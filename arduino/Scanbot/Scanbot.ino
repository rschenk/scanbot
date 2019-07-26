/*
 * Scanbot by Ryan Schenk 2018
 *
 * The code to read the digital indicator came from:
 *   https://web.archive.org/web/20181118142706/http://wei48221.blogspot.com:80/2016/01/using-digital-caliper-for-digital-read_21.html
 *
 */
#include <JC_Button.h>  // https://github.com/JChristensen/JC_Button

#define DEBUG false

#define OPTOSWITCH_PIN 2  // Note interrupts can only be attached to certain pins
#define INDICATOR_CLOCK_PIN 5
#define INDICATOR_DATA_PIN 6
#define BUTTON_PIN 9
#define LED_PIN 10

// Note that our circuit to raise the indicator gauge's signal voltage also
// inverts the logic levels. So when the clock is HIGH, our arduino reads that
// as LOW, etc.
#define INDICATOR_CLOCK_HIGH LOW
#define INDICATOR_CLOCK_LOW HIGH

// Magic numbers for reading the Harbor Frieght indicator
// If a pulse is longer than this (micros), that signifies we are at the start
// of a new sequence.
#define INDICATOR_NEW_SEQUENCE_THRESHOLD 650

#define INDICATOR_MM_SCALING_FACTOR 100.0
#define INDICATOR_INCH_SCALING_FACTOR 2000.0

// Magic numbers for converting the mouse opto into distance
#define MOUSE_MM_SCALING_FACTOR 1.008
#define MOUSE_INCH_SCALING_FACTOR 25.2

ToggleButton btn(
  BUTTON_PIN,
  false,      // initial state
  25,         // debounce ms
  false,      // disable internal pull-up resistor
  false       // invert logic (needed if using pull-down resistor)
);

boolean recording = false;

// For storing the time when the clock signal is changed from HIGH to LOW
// (falling edge trigger of data output).
unsigned long time_now;

// For storing the sequence coming out of the gauge
unsigned long sequence;

volatile boolean interrupt_tripped = false;
volatile unsigned long opto_clicks = 0;

void setup() {
  // put your setup code here, to run once:
  pinMode(INDICATOR_CLOCK_PIN, INPUT);
  pinMode(INDICATOR_DATA_PIN, INPUT);
  pinMode(OPTOSWITCH_PIN, INPUT);
  pinMode(BUTTON_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);

  btn.begin();

  attachInterrupt(
    digitalPinToInterrupt(OPTOSWITCH_PIN),
    onOptoInterrupt,
    CHANGE
  );

  Serial.begin(115200);
}

void loop() {
  // put your main code here, to run repeatedly:
  btn.read();
  handle_button_state_change();

  digitalWrite(LED_PIN, recording);
  if(!recording) return;
  
  // If clock is LOW, wait until it turns to HIGH
  while (digitalRead(INDICATOR_CLOCK_PIN) == INDICATOR_CLOCK_LOW) {}

  time_now = micros();

  // Wait for the end of the HIGH pulse
  while (digitalRead(INDICATOR_CLOCK_PIN) == INDICATOR_CLOCK_HIGH) {}
  
  // If the HIGH pulse was longer than our threshold, we are at the start of a
  // new bit sequence
  if ( (micros() - time_now) > INDICATOR_NEW_SEQUENCE_THRESHOLD) {
    digitalWrite(LED_PIN, LOW);

    // Sets global sequence variable as a side-effect, rather than returning. I
    // dunno, seems to be how microcontroller programs are done?
    decodeIndicatorPacket();

    if(interrupt_tripped) {
      print_measurements();
      interrupt_tripped = false;
    }
  }
}

void handle_button_state_change() {
  if(btn.changed()) {
    recording = btn.toggleState();

    if(recording) {
      opto_clicks = 0;
      Serial.println("BEGIN");
    } else {
      Serial.println("END"); 
    }
  }
}

void decodeIndicatorPacket() {
  sequence = 0;
  int i = 0;

  // Wait until clock returns to HIGH to begin reading the sequence
  while (digitalRead(INDICATOR_CLOCK_PIN) == INDICATOR_CLOCK_HIGH) {};

  for (i = 0; i <= 23; i++) {
    // Wait until clock returns to LOW
    while (digitalRead(INDICATOR_CLOCK_PIN) == INDICATOR_CLOCK_LOW) { }

    bitWrite(sequence, i, !digitalRead(INDICATOR_DATA_PIN));

    // Wait until clock returns to HIGH
    while (digitalRead(INDICATOR_CLOCK_PIN) == INDICATOR_CLOCK_HIGH) {}
  }

  if (DEBUG) {
    // Show the binary sequence for debugging
    for (i = 0; i <= 23; i++) {
      Serial.print(bitRead(sequence, i));
      Serial.print(" ");
    }
    Serial.println();
  }
}


void print_measurements() {
  int sign = 1;
  bool is_inches;
  long value = 0;
  
  if (bitRead(sequence, 20) == 1) sign = -1;  // Bit 21 is the sign bit. 0 -> +, 1 -> -
  is_inches = bitRead(sequence, 23);          // Bit 24 tells the measureing unit (1 -> in, 0 -> mm)

  value = sequence & 0xFFFFF;
  value *= sign;
  
  if (is_inches) {
    Serial.print(opto_clicks / MOUSE_INCH_SCALING_FACTOR, 3);
    Serial.print("in ");
    Serial.print(value / INDICATOR_INCH_SCALING_FACTOR, 3);  // Print result with 3 decimals
    Serial.println("in");
  } else {
    Serial.print(opto_clicks / MOUSE_MM_SCALING_FACTOR, 2);
    Serial.print("mm ");
    Serial.print(value / INDICATOR_MM_SCALING_FACTOR, 2);    // Print result with 2 decimals
    Serial.println("mm");
  }
}

void onOptoInterrupt() {
  interrupt_tripped = true;
  opto_clicks++;
}

