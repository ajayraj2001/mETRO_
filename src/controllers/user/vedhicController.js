const axios = require('axios');
const User = require("../../models/user");
const asyncHandler = require('express-async-handler');

const matchWithVedicAstro = asyncHandler(async (req, res, next) => {
    const loggedInUserId = req.user._id;
    const { matchUserId } = req.params;
    const { lang = 'en' } = req.query

    if (!matchUserId) {
        return res.status(400).json({
            success: false,
            message: "Matched user ID is required.",
        });
    }

    const [boy, girl] = await Promise.all([
        User.findById(loggedInUserId),
        User.findById(matchUserId),
    ]);

    if (!boy || !girl) {
        return res.status(404).json({
            success: false,
            message: "One or both users not found.",
        });
    }

    const isBoy = boy.gender === 'Male';
    const isGirl = girl.gender === 'Female';

    // Assigning based on gender
    const male = isBoy ? boy : girl;
    const female = isGirl ? girl : boy;

    if (!male.dob || !female.dob || !male.birth_time || !female.birth_time || !male.birth_lat || !male.birth_long || !female.birth_lat || !female.birth_long) {
        return res.status(400).json({
            success: false,
            message: "One or both users have missing birth details.",
        });
    }

    const apiUrl = 'https://api.vedicastroapi.com/v3-json/matching/ashtakoot-with-astro-details';

    const params = {
        api_key: process.env.VEDIC_ASTRO_API_KEY, // set in .env file
        boy_dob: new Date(male.dob).toLocaleDateString('en-GB'), // DD/MM/YYYY
        boy_tob: male.birth_time,
        boy_tz: 5.5, // You can dynamically detect if needed
        boy_lat: parseFloat(male.birth_lat),
        boy_lon: parseFloat(male.birth_long),

        girl_dob: new Date(female.dob).toLocaleDateString('en-GB'),
        girl_tob: female.birth_time,
        girl_tz: 5.5,
        girl_lat: parseFloat(female.birth_lat),
        girl_lon: parseFloat(female.birth_long),

        lang: lang,
    };

    try {
        const { data } = await axios.get(apiUrl, { params });

        return res.status(200).json({
            success: true,
            message: "Ashtakoot matching result",
            data,
        });
    } catch (err) {
        console.error('Vedic Astro API Error:', err?.response?.data || err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch data from Vedic Astro API.",
        });
    }
});


module.exports = { matchWithVedicAstro }