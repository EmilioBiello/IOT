from flask import Flask
from flask_cors import CORS
import paho.mqtt.client as mqtt
from influxdb import InfluxDBClient
from datetime import datetime
import netifaces
import random
import os
import json
import time

mqtt_username = "emilio"
mqtt_password = "iot_project_2019"
mqtt_topic = "room/#"
mqtt_client = "raspi-Biello"

client_inluxdb = InfluxDBClient('localhost', 8086)
db_name = "room"

piante_measurement = {}

app = Flask(__name__)
CORS(app)
port = 5000


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("connected OK Returned code= {}".format(rc))
        client.subscribe(mqtt_topic)
        print("Submitted on topic: {}".format(mqtt_topic))
    else:
        print("Bad connection Returned code= ", rc)


def on_disconnect(client, userdata, rc=0):
    print("DisConnected result code " + str(rc))
    client.loop_stop()


def on_message(client, userdata, msg):
    topic = str(msg.topic)
    value = str(msg.payload.decode("utf-8"))

    print("{} \t- Message: {} \t- Topic: {}".format(datetime.now().time(),
                                                    value, topic))
    choiche_topic(topic, value)


def choiche_topic(topic, value):
    topic_split = topic.split('/')
    pianta = topic_split[1]
    subtopic = topic_split[2]

    if pianta not in piante_measurement:
        piante_measurement[pianta] = {}

    if subtopic == 'temperature' or subtopic == 'humidity' or subtopic == 'lumen' or subtopic == 'igrometro':
        save_topic_get_information(pianta, subtopic, float(value))
    elif subtopic == 'elettrovalvola':
        save_topic_elettrovalvola(pianta, value)
    elif subtopic == 'out' and topic_split[3] == 'igrometro':
        save_topic_after_watering(pianta, value)


def save_topic_get_information(pianta, subtopic, value):
    now = time.time()

    if subtopic == "temperature":
        piante_measurement[pianta]['temperature'] = value
        piante_measurement[pianta]['start_time'] = now
    elif subtopic == "humidity":
        duration = (now - piante_measurement[pianta]['start_time'])
        if duration < 2.0 and piante_measurement[pianta]['temperature'] != 0.0:
            piante_measurement[pianta]['humidity'] = value
    elif subtopic == "lumen":
        duration = (now - piante_measurement[pianta]['start_time'])
        if duration < 2.0 and piante_measurement[pianta]['temperature'] != 0.0:
            piante_measurement[pianta]['lumen'] = value
    elif subtopic == "igrometro":
        duration = (now - piante_measurement[pianta]['start_time'])
        if duration < 2.0 and piante_measurement[pianta]['temperature'] != 0.0:
            piante_measurement[pianta]['soil'] = value

    if piante_measurement[pianta]['temperature'] != 0.0 and piante_measurement[pianta]['humidity'] != 0.0 and \
            piante_measurement[pianta]['lumen'] != 0.0 and piante_measurement[pianta]['soil'] != 0.0:
        create_json(pianta)
        soil = float(piante_measurement[pianta]['soil'])
        reset_variable(pianta)
        request_water(pianta, soil)


def save_topic_elettrovalvola(pianta, value):
    if value == 'on':
        value = 1
    elif value == 'off':
        value = 0
    else:
        return
    pianta = pianta + "_acqua"

    json_body = [
        {
            "measurement": pianta,
            "tags": {
                "user": "Emilio"
            },
            "fields": {
                "value": int(value)
            }
        }
    ]
    if client_inluxdb.write_points(json_body):
        print("{} \t\tInsert correct in Influxdb! WATER".format(
            datetime.now().time()))


def save_topic_after_watering(pianta, value):
    pianta = pianta + "_acqua"
    json_body = [
        {
            "measurement": pianta,
            "tags": {
                "user": "Emilio"
            },
            "fields": {
                "soil": float(value)
            }
        }
    ]
    if client_inluxdb.write_points(json_body):
        print("{} \t\tInsert correct in Influxdb! IGRO after watering".format(
            datetime.now().time()))


def create_json(pianta):
    json_body = [
        {
            "measurement": str(pianta),
            "tags": {
                "user": "Emilio"
            },
            "fields": {
                "temperature": piante_measurement[pianta]['temperature'],
                "humidity": piante_measurement[pianta]['humidity'],
                "lumen": piante_measurement[pianta]['lumen'],
                "soil": piante_measurement[pianta]['soil']
            }
        }
    ]
    # print(json_body)
    if client_inluxdb.write_points(json_body):
        print("{} \t\tInsert correct in Influxdb!".format(datetime.now().time()))


def reset_variable(pianta):
    piante_measurement[pianta]['temperature'] = 0.0
    piante_measurement[pianta]['humidity'] = 0.0
    piante_measurement[pianta]['lumen'] = 0.0
    piante_measurement[pianta]['soil'] = 0.0


def request_water(pianta, soil):
    if soil < 40.0:
        topic = "room/{}/input/auto/elettrovalvola".format(pianta)
        client.publish(topic, "on")
        time.sleep(5)
        client.publish(topic, "off")


@app.route('/')
def index():
    msg = {'data': 'Hello World! I am running on port ' + str(port)}
    response = app.response_class(
        response=json.dumps(msg, indent=4),
        status=200,
        mimetype='application/json'
    )
    return response


@app.route('/api/take-a-picture', methods=['GET'])
def take_a_picture():
    number = random.randint(1, 101)
    os.system('rm -r /var/www/html/img/pianta/*')
    os.system(
        'fswebcam -r 1280x1024 -F 10 -q /var/www/html/img/pianta/pianta_{}.jpg'.format(number))

    msg = {'data': number}
    response = app.response_class(
        response=json.dumps(msg, indent=4),
        status=200,
        mimetype='application/json'
    )
    return response


if __name__ == '__main__':
    address = netifaces.ifaddresses('wlan0')[netifaces.AF_INET][0]['addr']

    client = mqtt.Client(mqtt_client)
    client.username_pw_set(username=mqtt_username, password=mqtt_password)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(address)
    client.loop_start()

    client_inluxdb = InfluxDBClient('localhost', 8086)
    client_inluxdb.create_database(db_name)
    client_inluxdb.switch_database(db_name)

    app.run(host='0.0.0.0', port=port)
