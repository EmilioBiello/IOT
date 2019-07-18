#include <WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>

#define PIN_TRANSISTOR_ELETTROVALVOLA 23
#define PIN_TRANSISTOR_IGROMETRO 22

#define DATA_IGROMETRO 34
#define DATA_LUMEN 35

#define DHTPIN 21
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

#define LED_ROSSO_PIN 19
#define LED_BLU_PIN 18
#define LED_VERDE_PIN 5

const int timer_info = 300000;

// WiFi
// Replace the next variables with your SSID/Password combination
const char* ssid = "OnePlusEmilio";
const char* password = "EmiLio..94";

// MQTT
// Make sure to update this for your own MQTT Broker!
const char* mqtt_server = "192.168.43.49";


const char* mqtt_topic_sub = "room/pianta_1/input/#";
const char* mqtt_topic_pub = "room/pianta_1/";
const char* mqtt_topic_sub_elettrovalvola_auto = "room/pianta_1/input/auto/elettrovalvola";
const char* mqtt_topic_sub_elettrovalvola_manual = "room/pianta_1/input/manual/elettrovalvola";
const char* mqtt_topic_sub_igrometro = "room/pianta_1/input/igrometro";
const char* mqtt_topic_sub_info = "room/pianta_1/input/info";
const char* mqtt_username = "emilio";
const char* mqtt_password = "iot_project_2019";
const char* clientID = "ESP32_Garden";

// Timers auxiliar variables
long now = millis();
long lastMeasure = 0;

WiFiClient espClient;
PubSubClient client(espClient);
long lastMsg = 0;
char msg[50];
int value = 0;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  // Connect to the WiFi
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  // Debugging - Output the IP Address of the ESP32
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* message, unsigned int length) {
  digitalWrite(LED_VERDE_PIN, HIGH);
  Serial.print("Message arrived on topic: ");
  Serial.print(topic);
  Serial.print(". Message: ");
  String messageTemp;

  for (int i = 0; i < length; i++) {
    Serial.print((char)message[i]);
    messageTemp += (char)message[i];
  }
  Serial.println();

  // Feel free to add more if statements to control more GPIOs with MQTT

  // If a message is received on the topic esp32/output, you check if the message is either "on" or "off".
  // Changes the output state according to the message

  if (String(topic) == mqtt_topic_sub_elettrovalvola_auto || String(topic) == mqtt_topic_sub_elettrovalvola_manual) {
    Serial.println("ELETTROVALVOLA");
    use_elettrovalvola(messageTemp);
    if (messageTemp == "off") {
      igro_after_watering();
    }
  } else if (String(topic) == mqtt_topic_sub_igrometro) {
    Serial.println("IGROMETRO");
    use_igrometro();
  } else if (String(topic) == mqtt_topic_sub_info) {
    info_point();
  }
  delay(500);
  digitalWrite(LED_VERDE_PIN, LOW);
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");

    // Attempt to connect
    if (client.connect(clientID, mqtt_username, mqtt_password)) {
      Serial.println("Connected to MQTT Broker!");
      // Subscribe
      client.subscribe(mqtt_topic_sub);
    } else {
      Serial.print("Connection to MQTT Broker failed..., rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);

  pinMode(PIN_TRANSISTOR_ELETTROVALVOLA, OUTPUT);
  pinMode(PIN_TRANSISTOR_IGROMETRO, OUTPUT);
  pinMode(DATA_IGROMETRO, INPUT);
  pinMode(DATA_LUMEN, INPUT);
  pinMode(LED_ROSSO_PIN, OUTPUT);
  pinMode(LED_VERDE_PIN, OUTPUT);
  pinMode(LED_BLU_PIN, OUTPUT);
  dht.begin();

  Serial.println("Start");

  digitalWrite(LED_ROSSO_PIN, HIGH);

  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  client.subscribe(mqtt_topic_sub);

  digitalWrite(LED_ROSSO_PIN, LOW);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }

  if (!client.loop()) {
    client.connect(clientID);
  }

  now = millis();
  if (now - lastMeasure > timer_info || lastMeasure == 0) {
    digitalWrite(LED_BLU_PIN, HIGH);
    lastMeasure = now;
    cycle();
    digitalWrite(LED_BLU_PIN, LOW);
    Serial.println(" --- --- --- --- --- --- ");
  }
}

float t = 0.0;
float h = 0.0;
int lumen = 0;
int igro = 0;

void cycle() {
  use_dht();
  use_lumen();
  use_igrometro();
}

void use_dht() {
  t = dht.readTemperature();
  h = dht.readHumidity();

  if (isnan(h) || isnan(t)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }

  static char temperatureTemp[7];
  dtostrf(t, 6, 2, temperatureTemp);

  static char humidityTemp[7];
  dtostrf(h, 6, 2, humidityTemp);

  publish_MQTT("temperature", temperatureTemp);
  publish_MQTT("humidity", humidityTemp);

  Serial.print(" Humidity: ");
  Serial.print(h);
  Serial.print(" %\t Temperature: ");
  Serial.print(t);
  Serial.println(" *C ");
}



void use_lumen() {
  lumen = analogRead(DATA_LUMEN);

  int lum = map(lumen, 100, 4095, 100, 0); // converto il valore analogico in percentuale

  static char lumenTemp[5];
  sprintf(lumenTemp, "%04d", lum);

  publish_MQTT("lumen", lumenTemp);

  Serial.print(" LDR: ");
  Serial.print(lumen);
  Serial.print(" - ");
  Serial.print(lum);
  Serial.println(" %");
}

void use_igrometro() {
  digitalWrite(PIN_TRANSISTOR_IGROMETRO, HIGH);
  delay(500);

  igro = analogRead(DATA_IGROMETRO);
  int umdtrr = map(igro, 700, 4095, 100, 0); // converto il valore analogico in percentuale

  delay(500);
  digitalWrite(PIN_TRANSISTOR_IGROMETRO, LOW);

  static char igroTemp[5];
  sprintf(igroTemp, "%04d", umdtrr);

  publish_MQTT("igrometro", igroTemp);

  Serial.print(" Igrometro: ");
  Serial.print(igro);
  Serial.print(" - ");
  Serial.print(umdtrr);
  Serial.println(" %");
}

void igro_after_watering() {
  digitalWrite(PIN_TRANSISTOR_IGROMETRO, HIGH);
  delay(500);

  igro = analogRead(DATA_IGROMETRO);
  int umdtrr = map(igro, 700, 4095, 100, 0); // converto il valore analogico in percentuale

  delay(500);
  digitalWrite(PIN_TRANSISTOR_IGROMETRO, LOW);

  static char igroTemp[5];
  sprintf(igroTemp, "%04d", umdtrr);

  publish_MQTT("out/igrometro", igroTemp);
}

void use_elettrovalvola(String mex) {
  if (mex == "on") {
    digitalWrite(PIN_TRANSISTOR_ELETTROVALVOLA, HIGH);
    Serial.println("HIGH - Elettrovalvola");
    publish_MQTT("elettrovalvola", "on");
  } else if (mex == "off") {
    digitalWrite(PIN_TRANSISTOR_ELETTROVALVOLA, LOW);
    Serial.println("LOW - Elettrovalvola");
    publish_MQTT("elettrovalvola", "off");
  } else {
    publish_MQTT("elettrovalvola", "Value not correct.");
    Serial.println("Value is not correct!");
  }
}

void info_point() {
  digitalWrite(LED_ROSSO_PIN, HIGH);
  delay(100);
  digitalWrite(LED_BLU_PIN, HIGH);
  delay(100);

  cycle();

  digitalWrite(LED_ROSSO_PIN, LOW);
  delay(100);
  digitalWrite(LED_BLU_PIN, LOW);
  delay(100);
}

char* mqtt_topic = "";
void publish_MQTT(char* mqtt_subtopic, char* value) {

  mqtt_topic = (char *) malloc(1 + strlen(mqtt_topic_pub) + strlen(mqtt_subtopic) );
  strcpy(mqtt_topic, mqtt_topic_pub);
  strcat(mqtt_topic, mqtt_subtopic);

  if (client.publish(mqtt_topic, value)) {
    Serial.print("Message sent about topic ");
    Serial.println(mqtt_topic);
  } else {
    Serial.println("Message failed to send. Reconnecting to MQTT Broker and trying again");
    client.connect(clientID, mqtt_username, mqtt_password);
    delay(10); // This delay ensures that client.publish doesn't clash with the client.connect call
    if (client.publish(mqtt_topic, value)) {
      Serial.print("Message sent about topic ");
      Serial.println(mqtt_topic);
    }
  }
}
