const getOtp = () => {
  const max = 9999;
  return String((Math.random() * max) | 0).padStart(4, '0');
};

module.exports = getOtp;
