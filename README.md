# Scanbot
Scanbot is a scanner made from hacked computer mouse parts and a Harbor Freight digital indicator gauge, which I made to digitize the bottom contours of surfboards. By placing a flat reference across the bottom of a board, and running the scanbot mouse along that flat surface, with the indicator gauge probe running along the bottom of the surfboard, you can capture even the most complex bottom contours.

I attached the indicator to the mouse to give a Z-axis depth reading, and hijacked one axis of an old-school ball mouse to give a X-axis distance reading. I made a small circuit and wrote some Arduino code to read both axes and send them to a computer, where they saved and plotted by Javascript software.

Scanbot's software runs in Node.js and its firmware is written in Arduino. Both software and firmware, along with the hardware circuit design, are in this repo:

* `schematics/` contains the circuit desing and board layout
* `arduino/` contains the Arduino code
* `src/` and kind of everything else is the Node.js code for running the software

## Hardware
I've documented the hardware via a circuit diagram, as well as my layout to fit the circuit onto a perfboard inside the mouse. You can find these in the `schematics/` folder.

There are three components to the hardware/circuit. One is to hijack the mouse's ball mechanism to allow us to determine the x-axis position as we roll along. The second is to read the z-axis depth from the serial interface on the indicator gauge. And finally, we need some sort of user interface to capture the scans, and conveniently the mouse has buttons that we can use for this purpose.

The biggest design challenge for me was that I wanted to be able to fit everything inside the original mouse body. I thought it would be funniest if it looked just like a normal old mouse (minus the probe mounted to the front of it), with a single USB plug that would just plug into the computer. This meant completely replacing the mouse's original circuitry with my own, which fit into the same space and located the microswitch for the mouse button in the right spot. It also meant finding an Arduino that was small enough to fit inside the mouse. I used a [µduino](https://www.crowdsupply.com/uduino/uduino) which was unbelievably tiny and worked perfectly.

### X-axis 
The core of the scanner is an old computer mouse, the kind with the ball. The way these work is, the ball rubs up against a roller and spins it. On the other end of the roller inside the mouse, is an [optical rotary encoder](https://www.analogictips.com/rotary-encoders-part-1-optical-encoders/), which is basically a disc with evenly spaced holes around the edge. There's an LED on one side of the disc and a light detector on the other side; as the disc spins, the LED light either shines through the holes or is blocked by the disc, producing a blinking pattern on the detector that you can count and deduce how far you've gone. See the above link for more details.

If you remember these old mice, you'll remember that the ball itself was annoying and the rollers always needed to be cleaned. The ball also had way more resolution than I needed for a surfboard scanner, so I threw out the ball and replaced it with a small rubber wheel from an R/C airplane that I mounted directly on to the roller as it if were an axle. This gives me about 25 steps per inch, or one step per millimeter, which is plenty good enough resolution for my purposes.

### Z-axis
The depth axis is measured by a cheapo depth indicator gauge that I got from Harbor Freight (a US retailer of cheap tools of varying quailty). I already had this gauge kicking around because I use it to accurately set the fence of my bandsaw when I'm resawing wood. I made a wood block to hold the gauge...both the mouse and the wood block are mounted to a thin sheet of plastic that holds the two together.

It turns out that there's a hidden serial data port on these gauges, and various folks on the internet have published how to read data from it. I found an [incredible blog post](https://web.archive.org/web/20181118142706/http://wei48221.blogspot.com:80/2016/01/using-digital-caliper-for-digital-read_21.html) detailing exactly how to do this, including some sample Arduino code which became the basis of my firmware. There are several other pages I found with information about these.[^1] [^2] [^3] [^4]

From a hardware standpoint, the hardest part about reading the gauge is that the gauge runs on a single 1.5v battery, which is too low of a voltage to trigger a `HIGH` state in the Arduino, but it is enough to open a transistor. We can use transistors to boost the gauge's clock and data lines up to the 5v high that will make the Arduino code easy to write.

### Interface
The mouse already has buttons on it! Perfect! I replaced the mouse's original circuit board with my own, but was careful to keep a microswitch underneath the left mouse button so that it could still be used to start/stop the scanning process. There's also an LED that blinks when the scanner is active and a packet is received by the gauge.

## Firmware
The firmware is located in `arduino/` and is based on a blog article by [Wei-Hsiung Huang](http://wei48221.blogspot.tw/2016/01/using-digital-caliper-for-digital-read_21.html). It's intended to run on a [µduino](https://www.crowdsupply.com/uduino/uduino) but should run on any Arduino.

While scanning, it needs to do two things at once, read the depth from the gauge and count the x-position from the wheel. Because the gauge only outputs a painfully slow 10 updates per second, I opted to do the data decoding synchronously (that is, without interrupts). The clicks from the mouse wheel hit an interrupt which increments a counter for the x-position. The button flips a boolean that determines whether or not we are recording a scan.

The algorithm is very simple, if we are recording a scan, update the mouse wheel counts asynchronously. When a packet arrives from the indicator gauge, and the mouse has moved since the last packet arrived, print the current (X, Z) coordinates to the serial port.

Note that I do not track the direction that the mouse is moving, only that it has moved. Therefore you can only move the mouse in one direction, you cannot roll it back-and-forth.

## Software
The software is written in Node.js, reads the data from the serial port, saves it to a file, then renders it as an SVG drawing.

### Installation
Make sure that you have [Node and NPM](https://nodejs.org/en/download/) installed, the preferred version is listed in `.node_version`. Then cd to the root of this repository and `npm install`.

### Usage

* Plug the dial indicator into the mouse and turn it on. 
* Plug the mouse into the USB port of your computer.
* Start the Scanbot software by typing either `npm start` or `./bin/scanbot` (they do the same thing).
* You'll be prompted to either "Scan" or "Re-Render". Select Scan.
* Select the serial port for the mouse (Scanbot will try to find the mouse port and pre-select it if possible).
* Provide a name and description for your scan. The name is used as the filename, the description is optional metadata.
* Click the mouse button, make sure the LED is flashing, and begin scanning.
* Click-and-hold the mouse button for a second until the LED turns off to stop the scan.
* Make as many scans as you like, then press "q" <Enter> on the computer keyboard to stop scanning mode.
* You'll be prompted to name all the scans you took, which is optional but useful.
* Your scans will be rendered and saved to the `scans/` directory.

### Files created

Scanbot will create four files. 

The first is named `*.rawscan.txt` and is the exact output from the mouse, written to the filesystem in real time, along with a metadata header section. After the scans are complete and you provide the scan names, the metadata section of this file is re-written with the scan names added to the header.

Next it will create a `*.json` file containing the same data, parsed into json, normalized, with some calculations precomputed. This is the file that the SVG renders are produced from. I don't really need to write this to disk, but, I dunno, it's kinda fun.

Finally it will create two `*.svg` files, which are rendered via [Paper.js](http://paperjs.org) and [paper-jsdom](https://www.npmjs.com/package/paper-jsdom). The first file contains 100% full-scale drawings of your scans, rendered at 72dpi. Your drawing will be the exact size as your original object. The second drawing is named `*@3y.svg` and scales the depth coordinates by a factor of 3. I do this to make subtle bottom contours of surfboards more easily distinguished on the screen.

### Re-rendering

The second option of Scanbot is Re-rendering files. This will allow you to select any `.json` file and re-render the SVGs. I did this frequently when developing and tweaking the rendering code, but you probably won't ever need to do it.

## References

[^1]: [Blog of Wei-Hsiung Huang: Using Digital Caliper For Digital Read Out (DRO) Applications](http://wei48221.blogspot.tw/2016/01/using-digital-caliper-for-digital-read_21.html)
[^2]: [Robocombo - Interfacing TI Launchpad to Digital Caliper](http://robocombo.blogspot.tw/2010/12/using-tis-launchpad-to-interface.html)
[^3]: [Arduino reads digital caliper - martin's useless and useful creations](https://sites.google.com/site/marthalprojects/home/arduino/arduino-reads-digital-caliper)
[^4]: [Interfacing the TI Launchpad to Digital Caliper | Four-Three-Oh!](http://43oh.com/2010/12/interfacing-ti-launchpad-to-digital-caliper/)

