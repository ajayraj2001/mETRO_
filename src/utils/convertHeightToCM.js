function convertHeightToCM(feet, inches) {
    const feetToCM = feet * 30.48;
    const inchesToCM = inches * 2.54;
    return feetToCM + inchesToCM;
}

module.exports = convertHeightToCM;