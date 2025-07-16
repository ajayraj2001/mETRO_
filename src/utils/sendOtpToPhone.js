const axios = require("axios");

const sendOTP = async (phone, otp) => {
    try {
        const baseUrl = `http://commnestsms.com/api/push.json`;
        const message = `${otp} is your Verification code to login to the Jodi4Ever App.`;

        const params = {
            apikey: "6690b4eab7ca6",
            route: "transactional",
            sender: "JD4EVR", // Updated sender/header
            mobileno: phone,
            text: message // Important: URL encode the message
            // text: encodeURIComponent(message) // Important: URL encode the message
        };

        const response = await axios.get(baseUrl, { params });
        return response.data;
    } catch (err) {
        console.error("OTP Sending Error:", err.response?.data || err.message);
        return err;
    }
};

module.exports = sendOTP;
