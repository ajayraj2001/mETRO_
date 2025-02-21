// const { default: axios } = require('axios');

// async function sendOtpToPhone(phone, otp) {
//   return console.log('hit');
//   const response = await axios({
//     method: 'POST',
//     url: 'https://api.msg91.com/api/v5/flow/',
//     headers: {
//       authkey: '285140ArLurg2KnR61e3d660P1',
//       'Content-Type': 'application/JSON',
//       // Cookie: 'PHPSESSID=p6sigj223tdkhtfnq7l41tplh3',
//     },
//     data: {
//       flow_id: '61e559bdd8caa36a6b0d0c53',
//       mobiles: '916392985407',
//       otp: '2569',
//     },
//   });
//   const data = response.data;
//   console.log('msg res:\n', data);
// }
// sendOtpToPhone();
// module.exports = sendOtpToPhone;


const { default: axios } = require('axios');

async function sendOtpToPhone(phone, otp) {
  try {
    console.log('Otp Sending ------')
    const response = await axios({
      method: 'POST',
      url: 'https://api.msg91.com/api/v5/flow/',
      headers: {
        authkey: '285140ArLurg2KnR61e3d660P1',
        'Content-Type': 'application/JSON',
      },
      data: {
        flow_id: '61e559bdd8caa36a6b0d0c53',
        mobiles: phone, // Use the provided phone number parameter
        otp: otp, // Use the provided OTP parameter
      },
    });
    const data = response.data;
    console.log('msg res:\n', data);
    return data; // Return the response data
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

module.exports = sendOtpToPhone;

