var base_url = "http://" + location.hostname;

function start_page() {
    const hostname = location.hostname;
    const grafana = base_url + ":3000/d/5OvLQ4Wgz/pianta_1?orgId=1&refresh=1m";
    document.getElementById("host").value = hostname;
    $("#link_grafana").attr("href", grafana);

    $('#disconnect').prop('disabled', true);
    $('#subscribe').prop('disabled', true);
    $('#unsubscribe').prop('disabled', true);
    $('#send_btn').prop('disabled', true);
}

function getImage() {
    $('#take_picture').prop('disabled', true);

    var flask_url = base_url + ":5000" + "/api/take-a-picture";

    fetch(flask_url, {method: "GET"})
        .then((data) => data.json())
        .then((resp) => {

            $('#image_pianta').attr("src", "img/pianta/pianta_" + resp.data + ".jpg");
            $('#take_picture').prop('disabled', false);
        }).catch((err) => {
        console.error("Error from: " + flask_url + ":   " + err);
        $('#take_picture').prop('disabled', false);
    });
}