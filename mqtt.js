// ============================================================
// UNI-T UT353 BT -> MQTT + Home Assistant Discovery
//
// TESTMODUS:
// Simuliert zwei UT353 und sendet alle 5 Sekunden Messwerte.
//
// Später:
// TEST_MODE auf false setzen, dann werden echte BLE-Daten verwendet.
// ============================================================


// ------------------------------------------------------------
// Konfiguration
// ------------------------------------------------------------

let TEST_MODE = true;

let MQTT_STATE_PREFIX = "ut353";
let MQTT_DISCOVERY_PREFIX = "homeassistant";

let TEST_INTERVAL_MS = 5000;


// Bereits während dieser Skriptlaufzeit per Discovery gemeldete Geräte
let discovered = {};


// ------------------------------------------------------------
// MAC-Adresse in eine MQTT-taugliche ID umwandeln
//
// Beispiel:
// 18:90:67:fa:7b:3c -> 189067fa7b3c
// ------------------------------------------------------------

function addressToId(address) {
  if (address === undefined || address === null) {
    return null;
  }

  return address
    .split(":").join("")
    .split("-").join("")
    .toLowerCase();
}


// ------------------------------------------------------------
// Schallpegel aus UT353-Daten lesen
//
// Erwartet einen Text, der beispielsweise enthält:
//
// 62.3dBA
// ------------------------------------------------------------

function findDbValue(text) {
  if (typeof text !== "string") {
    return null;
  }

  let pos = text.indexOf("dBA");

  if (pos < 0) {
    return null;
  }

  let start = pos - 1;

  while (start >= 0) {
    let c = text.slice(start, start + 1);

    if (
      (c >= "0" && c <= "9") ||
      c === "." ||
      c === ","
    ) {
      start--;
    } else {
      break;
    }
  }

  let numberText = text.slice(start + 1, pos);
  numberText = numberText.replace(",", ".");

  let value = parseFloat(numberText);

  if (isNaN(value)) {
    return null;
  }

  return value;
}


// ------------------------------------------------------------
// MQTT Discovery für Home Assistant senden
// ------------------------------------------------------------

function publishDiscovery(deviceId, address) {
  if (!MQTT.isConnected()) {
    print("Discovery nicht gesendet: MQTT nicht verbunden");
    return false;
  }

  let shortId = deviceId.slice(deviceId.length - 6);
  let deviceName = "UNI-T UT353 " + shortId;

  let stateTopic =
    MQTT_STATE_PREFIX +
    "/" +
    deviceId +
    "/state";


  // Schallpegel-Sensor
  let soundConfigTopic =
    MQTT_DISCOVERY_PREFIX +
    "/sensor/ut353_" +
    deviceId +
    "_sound/config";

  let soundConfig = {
    name: "Schallpegel",
    unique_id: "ut353_" + deviceId + "_sound",

    state_topic: stateTopic,
    value_template: "{{ value_json.value }}",

    unit_of_measurement: "dBA",
    state_class: "measurement",
    icon: "mdi:volume-high",

    device: {
      identifiers: [
        "ut353_" + deviceId
      ],
      name: deviceName,
      manufacturer: "UNI-T",
      model: "UT353 BT",
      connections: [
        [
          "mac",
          address
        ]
      ]
    }
  };


  // RSSI-Sensor
  let rssiConfigTopic =
    MQTT_DISCOVERY_PREFIX +
    "/sensor/ut353_" +
    deviceId +
    "_rssi/config";

  let rssiConfig = {
    name: "Bluetooth RSSI",
    unique_id: "ut353_" + deviceId + "_rssi",

    state_topic: stateTopic,
    value_template: "{{ value_json.rssi }}",

    unit_of_measurement: "dBm",
    device_class: "signal_strength",
    state_class: "measurement",
    entity_category: "diagnostic",

    device: {
      identifiers: [
        "ut353_" + deviceId
      ]
    }
  };


  let soundOk = MQTT.publish(
    soundConfigTopic,
    JSON.stringify(soundConfig),
    0,
    true
  );

  let rssiOk = MQTT.publish(
    rssiConfigTopic,
    JSON.stringify(rssiConfig),
    0,
    true
  );


  if (soundOk && rssiOk) {
    print(
      "MQTT Discovery gesendet: " +
      deviceName +
      " (" +
      address +
      ")"
    );

    return true;
  }

  print(
    "MQTT Discovery fehlgeschlagen: " +
    deviceName
  );

  return false;
}


// ------------------------------------------------------------
// Messwert per MQTT senden
// ------------------------------------------------------------

function publishMeasurement(deviceId, address, db, rssi) {
  if (!MQTT.isConnected()) {
    print(
      "MQTT nicht verbunden, Messwert nicht gesendet"
    );

    return false;
  }

  let topic =
    MQTT_STATE_PREFIX +
    "/" +
    deviceId +
    "/state";

  let payload = {
    value: db,
    rssi: rssi,
    address: address,
    unit: "dBA"
  };

  let success = MQTT.publish(
    topic,
    JSON.stringify(payload),
    0,
    true
  );

  if (success) {
    print(
      "MQTT: " +
      topic +
      " = " +
      db +
      " dBA, RSSI " +
      rssi
    );
  } else {
    print(
      "MQTT-Versand fehlgeschlagen: " +
      topic
    );
  }

  return success;
}


// ------------------------------------------------------------
// Gemeinsame Verarbeitung für Testdaten und BLE-Daten
// ------------------------------------------------------------

function processMeasurement(address, rssi, db) {
  let deviceId = addressToId(address);

  if (deviceId === null) {
    print("Ungültige Geräteadresse");
    return;
  }

  // Discovery beim ersten Messwert senden.
  // Falls MQTT noch nicht verbunden ist, wird beim nächsten
  // Messwert erneut versucht.
  if (discovered[deviceId] !== true) {
    if (publishDiscovery(deviceId, address)) {
      discovered[deviceId] = true;
    }
  }

  // Jeder Messwert wird gesendet, auch wenn er identisch ist.
  publishMeasurement(
    deviceId,
    address,
    db,
    rssi
  );
}


// ------------------------------------------------------------
// Testdaten erzeugen
// ------------------------------------------------------------

let testCounter = 0;

function sendTestData() {
  testCounter++;

  // Kleine Wertänderung, damit man in HA den Verlauf gut sieht.
  let db1 =
    60.0 +
    ((testCounter % 10) * 0.2);

  let db2 =
    67.0 +
    ((testCounter % 6) * 0.3);


  processMeasurement(
    "12:34:56:78:9A:BC",
    -65,
    db1
  );

  processMeasurement(
    "98:76:54:32:10:FE",
    -72,
    db2
  );
}


// ------------------------------------------------------------
// Echte BLE-Pakete verarbeiten
// ------------------------------------------------------------

function startBleScanner() {
  BLE.Scanner.Subscribe(function (event, result) {
    if (event !== BLE.Scanner.SCAN_RESULT) {
      return;
    }

    if (
      result === null ||
      result.addr === undefined ||
      result.manufacturer_data === undefined
    ) {
      return;
    }

    let db = null;

    for (
      let manufacturerId in result.manufacturer_data
    ) {
      let data =
        result.manufacturer_data[manufacturerId];

      if (typeof data !== "string") {
        continue;
      }

      if (data.indexOf("dBA") < 0) {
        continue;
      }

      db = findDbValue(data);

      if (db !== null) {
        break;
      }
    }

    // Kein UT353-Messwert gefunden
    if (db === null) {
      return;
    }

    processMeasurement(
      result.addr,
      result.rssi,
      db
    );
  });


  let scanStarted = BLE.Scanner.Start({
    duration_ms: BLE.Scanner.INFINITE_SCAN,
    active: true
  });

  print(
    "UT353 BLE-Scan gestartet: " +
    scanStarted
  );
}


// ------------------------------------------------------------
// Start
// ------------------------------------------------------------

if (TEST_MODE) {
  print("UT353-Testmodus aktiviert");

  // Sofort erste Werte senden
  sendTestData();

  // Danach alle 5 Sekunden
  Timer.set(
    TEST_INTERVAL_MS,
    true,
    sendTestData
  );
} else {
  print("UT353-BLE-Modus aktiviert");

  startBleScanner();
}


// ------------------------------------------------------------
// MQTT-Verbindungsstatus regelmäßig anzeigen
// ------------------------------------------------------------

Timer.set(
  30000,
  true,
  function () {
    if (MQTT.isConnected()) {
      print("MQTT verbunden");
    } else {
      print("MQTT nicht verbunden");
    }
  }
);
