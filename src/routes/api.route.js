const adminRoute = require('./admin.route');
const userRoute = require('./user.route');

const apiRoute = require('express').Router();

apiRoute.use('/user', userRoute);
apiRoute.use('/admin', adminRoute);

module.exports = apiRoute;
