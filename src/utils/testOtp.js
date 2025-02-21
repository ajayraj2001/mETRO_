var unirest = require("unirest");

// Function to send SMS using Fast2SMS
function sendSMS(Otp, phone) {
    var req = unirest("POST", "https://www.fast2sms.com/dev/bulkV2");

    req.headers({
        "authorization": "lPh3MJBNQLV0uicOYA8sgHznWI9fUkyreKpq5o6dxCFDX7RT1tATfLH6e8ha9Stm2XEQvMRwDdsiWKIc"
    });

    req.form({
        "variables_values": Otp,  // You can customize this according to your OTP or message variables
        "route": "otp",              // Route for OTP
        "numbers": phone  // Enter the comma-separated phone numbers
    });

    req.end(function (res) {
        if (res.error) {
            console.error("Error:", res.error);
            return;
        }

        // If the request was successful, print the response
        console.log("SMS Sent Successfully:", res.body);
    });
}

// Call the sendSMS function
sendSMS("2654", "7834913016");
