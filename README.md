# UNI-T UT353BT + Home Assistant + Shelly

This project provides a reliable way to use the **UNI-T UT353BT** as a permanent BLE sound level sensor for Home Assistant.

The UT353BT normally stops advertising its dB values after approximately **5 minutes** when no Bluetooth device is connected, even with **APO disabled**. Instead of maintaining a permanent BLE connection, this solution periodically restarts Bluetooth by simulating the ON/OFF button.

The complete solution uses only inexpensive hardware and two Shelly scripts.

---

## Features

- Continuous BLE advertising
- No permanent BLE connection required
- Supports multiple UT353BT devices
- Automatic MQTT discovery for Home Assistant
- MQTT publishing of every received dB value
- Powered from an external 12 V supply
- Automatic recovery after power loss

---

# Hardware

- UNI-T UT353BT
- 12 V DC power supply
- MP1584EN DC-DC Buck Converter (adjusted to approximately 4.8 V)
- Shelly 1 Gen4

---

# UT353BT modifications

Two simple modifications are required.

## 1. External power supply

Solder two wires to

- BAT+
- BAT-

These are connected to the output of the MP1584EN converter.

![UT353BT front PCB](images/pcb_front.jpg)

*Placeholder: Front PCB showing BAT+ and BAT- solder points.*

---

## 2. ON/OFF button

Solder two wires to the ON/OFF button contacts.

These wires are connected to the Shelly relay.

![UT353BT rear PCB](images/pcb_back.jpg)

*Placeholder: Rear PCB showing the ON/OFF button solder points.*

---

# Wiring

- 12 V power supply → MP1584EN input
- MP1584EN output (~4.8 V) → BAT+ / BAT-
- 12 V power supply → Shelly 1 Gen4
- Shelly relay → ON/OFF button contacts

![Complete wiring](images/wiring.jpg)

*Placeholder: Complete wiring diagram / photo.*

---

# How it works

The UT353BT behaves as follows:

- A short or long press on **ON/OFF** powers the device on.
- A **long press** enables Bluetooth.
- If no Bluetooth device is connected, BLE advertising stops after approximately **5 minutes**, even when APO is disabled.

Instead of keeping a permanent BLE connection alive, the Shelly periodically simulates two long button presses every **4 minutes**.

### If the device has just powered up

- First long press → powers the UT353BT on
- Second long press → enables Bluetooth

### If the device is already running

- First long press → disables Bluetooth
- Second long press → enables Bluetooth again

The Bluetooth timeout is therefore continuously reset and the UT353BT keeps broadcasting its dB values indefinitely.

---

# Shelly scripts

This repository contains two scripts.

## 1. Button Press Script

Runs on the Shelly 1 Gen4.

Its only task is periodically simulating the required double long press.

```
Long Press
↓

Pause

↓

Long Press

↓

Wait 4 minutes

↓

Repeat
```

---

## 2. BLE Scanner Script

Also runs on the Shelly.

Functions:

- scans BLE advertisements
- detects UT353BT devices
- decodes the dB value
- publishes every measurement via MQTT
- automatically creates MQTT Discovery entities
- automatically supports multiple UT353BT devices

Each sensor is identified by its Bluetooth MAC address.

Example MQTT topic:

```
ut353/AA:BB:CC:DD:EE:FF/state
```

---

# Home Assistant

The MQTT Discovery messages automatically create a sensor for every detected UT353BT.

No manual Home Assistant configuration is required.

![Home Assistant](images/homeassistant.png)

*Placeholder: Home Assistant sensor screenshot.*

---

# Repository

```
README.md
button_press.js
ble_scanner.js
images/
    pcb_front.jpg
    pcb_back.jpg
    wiring.jpg
    homeassistant.png
```

---

# Notes

- The MP1584EN output should be adjusted to approximately **4.8 V** before connecting the UT353BT.
- The relay contacts are connected only to the ON/OFF button.
- No permanent Bluetooth connection is required.
- The BLE scanner can receive data from multiple UT353BT devices simultaneously.

---

# License

MIT
