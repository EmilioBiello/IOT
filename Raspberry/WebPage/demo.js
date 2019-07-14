// Create a client instance
var client = null;
var connected = false;

// Called after form input is processed
function startConnect() {
    var clientID = "clientID-" + makeid();
    var hostname = document.getElementById("host").value;
    var port = document.getElementById("port").value;

    // Print output for the user in the messages div
    logMessage("INFO", "Connecting to: ", hostname, ", on port: ", port, " using the following client value", client, "]");


    // Initialize new Paho client connection
    client = new Paho.MQTT.Client(hostname, Number(port), clientID);

    // Set callback handlers
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;
    client.onConnected = onConnected;

    var options = {
        invocationContext: {host: hostname, port: port, clientId: clientID},
        userName: 'emilio',
        password: 'iot_project_2019',
        onSuccess: onConnect,
        onFailure: onFail
    };

    // Connect the client, if successful, call onConnect function
    client.connect(options);
    var statusSpan = document.getElementById("connectionStatus");
    statusSpan.innerHTML = "Connecting...";
}

// Called when the disconnection button is pressed
function startDisconnect() {
    logMessage("INFO", "Disconnecting from Server.");
    client.disconnect();
    var statusSpan = document.getElementById("connectionStatus");
    statusSpan.innerHTML = "Connection - Disconnected.";
    connected = false;
    setFormEnabledState(false);
    clear_table();
}

// Called when the client connects
function onConnect(context) {
    // Once a connection has been made, make a subscription and send a message.
    var connectionString = context.invocationContext.host + ":" + context.invocationContext.port;
    logMessage("INFO", "Connection Success ", "[URI: ", connectionString, ", ID: ", context.invocationContext.clientId, "]");
    var statusSpan = document.getElementById("connectionStatus");
    statusSpan.innerHTML = "Connected to: <code>" + connectionString + "</code> as <code>" + context.invocationContext.clientId + "</code>";
    connected = true;
    setFormEnabledState(true);
}

function onFail(context) {
    logMessage("ERROR", "Failed to connect. [Error Message: ", context.errorMessage, "]");
    var statusSpan = document.getElementById("connectionStatus");
    statusSpan.innerHTML = "Failed to connect: " + context.errorMessage;
    connected = false;
    setFormEnabledState(false);
}

function onConnected(reconnect, uri) {
    // Once a connection has been made, make a subscription and send a message.
    logMessage("INFO", "Client Has now connected: [Reconnected: ", reconnect, ", URI: ", uri, "]");
    connected = true;
}

// Called when the client loses its connection
function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        logMessage("INFO", "Connection Lost. [Error Message: ", responseObject.errorMessage, "]");
    }
    connected = false;
}

// Called when a message arrives
function onMessageArrived(message) {
    var now = new Date();
    var date = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    var time = now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
    var timeString = date + '  ' + time;

    document.getElementById("info_time_message").innerHTML = 'Last measurement: <code>' + timeString + "</code>";

    var mex = Number(message.payloadString);

    if (isNaN(message.payloadString)) {
        mex = message.payloadString;
    }
    populated_table_sub(timeString, message.destinationName, mex);
}


function onPublish() {
    var topic = switch_topic(document.getElementById('topic_pub').value);
    var message = document.getElementById('msg_pub').value;
    logMessage("INFO", "Publishing Message: [Topic: ", topic, ", Payload: ", message, "]");

    message = new Paho.MQTT.Message(message);
    message.destinationName = topic;
    client.send(message);

    var now = new Date();
    var date = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    var time = now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
    var timeString = date + '  ' + time;

    populated_table_pub(timeString, message.destinationName, message.payloadString);
}

function onSubscribe() {
    var topic = document.getElementById("topic").value;
    logMessage("INFO", "Subscribing to: [Topic: ", topic, "]");
    client.subscribe(topic);
    // Print output for the user in the messages div
    document.getElementById("info_topic_sub").innerHTML = 'Subscribing to: <kbd>' + topic + '</kbd>\n';
    $('#subscribe').prop('disabled', true);
    $('#unsubscribe').prop('disabled', false);
}

function onUnsubscribe() {
    var topic = document.getElementById("topic").value;
    client.unsubscribe(topic, {
        onSuccess: unsubscribeSuccess,
        onFailure: unsubscribeFailure,
        invocationContext: {topic: topic}
    });
    indice_sub = 0;
    $('#subscribe').prop('disabled', false);
    $('#unsubscribe').prop('disabled', true);
}

function unsubscribeSuccess(context) {
    logMessage("INFO", "Unsubscribed. [Topic: ", context.invocationContext.topic, "]");
}

function unsubscribeFailure(context) {
    logMessage("ERROR", "Failed to onUnsubscribe. [Topic: ", context.invocationContext.topic, ", Error: ", context.errorMessage, "]");
}

function clearHistory() {
    $('.info_subscribe_class').remove();
}

function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

// Sets various form controls to either enabled or disabled
function setFormEnabledState(enabled) {

    // Connection Panel Elements
    if (enabled) {
        $('#connect').prop('disabled', true);
        $('#disconnect').prop('disabled', false);
        $('#subscribe').prop('disabled', false);
        $('#send_btn').prop('disabled', false);
    } else {
        $('#connect').prop('disabled', false);
        $('#disconnect').prop('disabled', true);
        $('#subscribe').prop('disabled', true);
        $('#unsubscribe').prop('disabled', true);
        $('#send_btn').prop('disabled', true);

    }
    document.getElementById("host").disabled = enabled;
    document.getElementById("port").disabled = enabled;

    // Subscription Panel Elements
    document.getElementById("topic").disabled = !enabled;

    // Publish Panel Elements
    document.getElementById("msg_pub").disabled = !enabled;
    document.getElementById("topic_pub").disabled = !enabled;
}

function logMessage(type, ...content) {
    var consolePre = document.getElementById("consolePre");
    var now = new Date();
    var date = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    var time = now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
    var timeString = date + '  ' + time;
    var logMessage = timeString + " - " + type + " - " + content.join("");
    consolePre.innerHTML += logMessage + "\n";

    if (type === "INFO") {
        console.info(logMessage);
    } else if (type === "ERROR") {
        console.error(logMessage);
    } else {
        console.log(logMessage);
    }
}

var indice_sub = 1;

function populated_table_sub(timestamp, topic, message) {
    var my_class = "info_subscribe_class";
    var last_child = $('#table_info_subscribe>tbody:last-child');

    if (indice_sub == 1 || (indice_sub % 20 == 0)) {
        $('.dataTables_empty').remove();
        $('.odd').remove();
        $('.info_subscribe_class').remove();
    }

    $(last_child).append(
        '<tr class="' + my_class + '">' +
        '<td class="text-center" scope="row">' + (indice_sub++) + '</td>' +
        '<td class="font-weight-light">' + timestamp + '</td>' +
        '<td class="font-weight-light">' + topic + '</td>' +
        '<td class="font-weight-normal">' + message + '</td>' +
        '</tr>'
    );

    $('#table_info_subscribe>tbody:last-child').focus();
}

var indice_pub = 1;

function populated_table_pub(timestamp, topic, message) {
    var my_class = "info_publish_class";
    var last_child = $('#table_info_publish>tbody:last-child');

    if (indice_pub == 1 || (indice_pub % 10 == 0)) {
        $('.dataTables_empty').remove();
        $('.odd').remove();
        $('.info_publish_class').remove();
    }

    $(last_child).append(
        '<tr class="' + my_class + '">' +
        '<td class="text-center" scope="row">' + (indice_pub++) + '</td>' +
        '<td class="font-weight-light">' + timestamp + '</td>' +
        '<td class="font-weight-light">' + topic + '</td>' +
        '<td class="font-weight-normal">' + message + '</td>' +
        '</tr>'
    );
}

function clear_table() {
    $('.info_publish_class').remove();
    $('.info_subscribe_class').remove();
    indice_sub = 0;
    indice_pub = 0;
}

function switch_topic(topic) {
    switch (topic) {
        case "1":
            topic = "room/pianta_1/input/elettrovalvola";
            break;
        case  "2":
            topic = "room/pianta_1/input/igrometro";
            break;
        case "3":
            topic = "room/pianta_1/input/info";
            break;
        default:
            topic = "error";
    }
    return topic;
}