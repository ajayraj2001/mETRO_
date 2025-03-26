const asyncHandler = (requestHandler) => {  // Used to handle web request
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
        .catch((err) => {
            console.log("error=====>>>>>", err.message);  // Log the error message
            console.log("error stack=====>>>>>", err.stack);  // Log the stack trace to see where it's coming from
            next(err);  // Pass the error to the next handler
        });
    };
}; module.exports = asyncHandler;   