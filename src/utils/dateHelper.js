const { getCurrentIST } = require('./timeUtils');
const moment = require('moment');

function getDateRangeConfig(period) {
    const now = getCurrentIST();
    let startDate, endDate, dateFormat, groupByField, includeUpcoming = false;

    switch (period) {
        case '7d':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            dateFormat = '%Y-%m-%d';
            groupByField = 'day';
            break;

        case '30d':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            dateFormat = '%Y-%m-%d';
            groupByField = 'day';
            break;

        case '12m':
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 11);
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            dateFormat = '%Y-%m';
            groupByField = 'month';
            break;

        case 'this_week':
            const dayOfWeek = now.getDay();
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate = new Date(now);
            startDate.setDate(now.getDate() - diff);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            dateFormat = '%Y-%m-%d';
            groupByField = 'day';
            includeUpcoming = true;
            break;

        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
            dateFormat = '%Y-%m-%d';
            groupByField = 'day';
            includeUpcoming = true;
            break;

        case 'ytd':
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), 11, 31);
            endDate.setHours(23, 59, 59, 999);
            dateFormat = '%Y-%m';
            groupByField = 'month';
            includeUpcoming = true;
            break;
    }

    return { startDate, endDate, dateFormat, groupByField, includeUpcoming };
}

function fillMissingDates(data, startDate, endDate, dateFormat, source, period) {
    const filled = [];
    const map = new Map(data.map(item => [item._id, item.total]));
    const unit = (dateFormat === '%Y-%m') ? 'month' : 'day';
    const formatStr = dateFormat.replace(/%/g, '');

    const current = moment(startDate);
    const end = moment(endDate);

    while (current.isSameOrBefore(end)) {
        const key = current.format(formatStr);
        filled.push({ _id: key, total: map.get(key) || 0 });
        current.add(1, unit);
    }

    return filled;
}

module.exports = {
    getDateRangeConfig,
    fillMissingDates
};
