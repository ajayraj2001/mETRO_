const calculateAge = (dob) => {
  const currentDate = new Date();
  const birthDate = new Date(dob);
  const ageDiff = currentDate - birthDate;
  const age = Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25)); // Approximate age in years
  return age;
};

module.exports = calculateAge;
