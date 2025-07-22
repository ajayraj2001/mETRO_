const { User } = require('../../models')
const { getCurrentIST } = require('../../utils/timeUtils')

const getAdminUserDashboard = async (req, res, next) => {
    try {
        const { period = '7d' } = req.query;

        // Validate input
        const validPeriods = ['7d', '30d', '12m', 'this_week', 'this_month', 'ytd'];
        if (!validPeriods.includes(period)) {
            throw new ApiError('Invalid period parameter', 400);
        }

        // Calculate date range based on period
        const { startDate, endDate, dateFormat, groupByField, includeUpcoming } = getDateRangeConfig(period);

        // Get user registration data with source breakdown
        const chartData = await getUserRegistrationData(startDate, endDate, dateFormat, groupByField, includeUpcoming, period);

        // Get total users count
        const totalUsers = await User.countDocuments();

        // Count users registered in the selected period
        const usersInPeriod = await User.countDocuments({
            created_at: { $gte: startDate, $lte: endDate }
        });

        // Get source breakdown for the period
        const sourceBreakdown = await User.aggregate([
            {
                $match: {
                    created_at: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$source',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Format source breakdown
        const appUsers = sourceBreakdown.find(item => item._id === 'app')?.count || 0;
        const webUsers = sourceBreakdown.find(item => item._id === 'web')?.count || 0;

            // ADDED: Get today's user count
        const now = getCurrentIST();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

          // Count total users registered today
        const todayUsers = await User.countDocuments({
            created_at: { $gte: todayStart, $lte: todayEnd }
        });


        // Build response
        const response = {
            success: true,
            message: "Admin User Dashboard Data",
            data: {
                period,
                totals: {
                    total_users: totalUsers,
                    new_users_in_period: usersInPeriod,
                    app_users_in_period: appUsers,
                    web_users_in_period: webUsers,
                    today_users: todayUsers
                },
                chart: chartData
            }
        };

        res.json(response);
    } catch (error) {
        next(error);
    }
};

function getDateRangeConfig(period) {
    const now = getCurrentIST();
    let startDate, endDate, dateFormat, groupByField, includeUpcoming = false;

    switch (period) {
        case '7d':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6); // Last 7 days including today
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            dateFormat = '%Y-%m-%d';
            groupByField = 'day';
            break;

        case '30d':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 29); // Last 30 days including today
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            dateFormat = '%Y-%m-%d';
            groupByField = 'day';
            break;

        case '12m':
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 11); // Last 12 months including current month
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            dateFormat = '%Y-%m';
            groupByField = 'month';
            break;

        case 'this_week':
            // Start from Monday of current week
            const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust to make Monday the first day
            startDate = new Date(now);
            startDate.setDate(now.getDate() - diff);
            startDate.setHours(0, 0, 0, 0);

            // End date is Sunday of the same week
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);

            dateFormat = '%Y-%m-%d';
            groupByField = 'day';
            includeUpcoming = true; // Show all 7 days even if they haven't occurred yet
            break;

        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
            startDate.setHours(0, 0, 0, 0);

            // Last day of current month
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);

            dateFormat = '%Y-%m-%d';
            groupByField = 'day';
            includeUpcoming = true; // Show all days of the month even if they haven't occurred yet
            break;

        case 'ytd':
            startDate = new Date(now.getFullYear(), 0, 1); // January 1 of current year
            startDate.setHours(0, 0, 0, 0);

            // December 31 of current year
            endDate = new Date(now.getFullYear(), 11, 31);
            endDate.setHours(23, 59, 59, 999);

            dateFormat = '%Y-%m';
            groupByField = 'month';
            includeUpcoming = true; // Show all months of the year even if they haven't occurred yet
            break;
    }

    return { startDate, endDate, dateFormat, groupByField, includeUpcoming };
}

async function getUserRegistrationData(startDate, endDate, dateFormat, groupByField, includeUpcoming, period) {
    // For data retrieval, we only want to query up to the current date
    const queryEndDate = includeUpcoming ? new Date(getCurrentIST()) : endDate;

    // Use aggregation to get user registrations by date and source
    const pipeline = [
        {
            $match: {
                created_at: { $gte: startDate, $lte: queryEndDate }
            }
        },
        {
            $addFields: {
                formatted_date: {
                    $dateToString: {
                        format: dateFormat,
                        date: '$created_at',
                        timezone: '+05:30'
                    }
                }
            }
        },
        {
            $group: {
                _id: {
                    date: '$formatted_date',
                    source: '$source'
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.date',
                total: { $sum: '$count' },
                sources: {
                    $push: {
                        source: '$_id.source',
                        count: '$count'
                    }
                }
            }
        },
        { $sort: { _id: 1 } }
    ];

    const results = await User.aggregate(pipeline);

    // Transform the aggregation results to include source breakdown
    const transformedResults = results.map(item => ({
        _id: item._id,
        total: item.total,
        sources: item.sources
    }));

    // Fill in missing dates with zero values
    return fillMissingDates(transformedResults, startDate, endDate, dateFormat, 'user', period);
}

function fillMissingDates(results, startDate, endDate, dateFormat, type, period) {
    const dateMap = {};

    // Create a map of existing dates with source breakdown
    results.forEach(item => {
        dateMap[item._id] = {
            total: item.total,
            app: 0,
            web: 0
        };

        // Process sources for each date
        if (item.sources) {
            item.sources.forEach(sourceData => {
                const source = sourceData.source || 'web'; // default to web if no source
                if (source === 'app' || source === 'web') {
                    dateMap[item._id][source] = sourceData.count;
                }
            });
        }
    });

    const filledResults = [];
    const current = new Date(startDate);
    const realEndDate = new Date(endDate);

    // Loop through all dates in the range
    while (current <= realEndDate) {
        let formattedDate;

        if (dateFormat === '%Y-%m-%d') {
            formattedDate = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;

            const existingData = dateMap[formattedDate] || { total: 0, app: 0, web: 0 };

            // Format date for display based on period
            let displayDate;

            if (period === '7d' || period === '30d') {
                // Format like "Feb 22"
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                displayDate = `${monthNames[current.getMonth()]} ${current.getDate()}`;
            } else if (period === 'this_week') {
                // Format like "Mon"
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                displayDate = dayNames[current.getDay()];
            } else if (period === 'this_month') {
                // Format like "Feb 1"
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                displayDate = `${monthNames[current.getMonth()]} ${current.getDate()}`;
            }

            // Create the result object (removed _id and day fields)
            const resultObj = {
                date: displayDate,
                total: existingData.total || 0,
                app: existingData.app || 0,
                web: existingData.web || 0
            };

            filledResults.push(resultObj);
            current.setDate(current.getDate() + 1);
        } else if (dateFormat === '%Y-%m') {
            formattedDate = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

            const existingData = dateMap[formattedDate] || { total: 0, app: 0, web: 0 };

            // Format date for display
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const displayDate = monthNames[current.getMonth()];

            // Create the result object (removed _id and month fields)
            const resultObj = {
                date: displayDate,
                total: existingData.total || 0,
                app: existingData.app || 0,
                web: existingData.web || 0
            };

            filledResults.push(resultObj);
            current.setMonth(current.getMonth() + 1);
        }
    }

    return filledResults;
}

// Helper functions (assuming these exist in your codebase)
function getDayName(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}

function getMonthName(date) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[date.getMonth()];
}

module.exports = { getAdminUserDashboard }