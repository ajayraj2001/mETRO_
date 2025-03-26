const asyncHandler = (requestHandler) => {  // Used to handle web request
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
        .catch( (err) => {
            console.log("error=====>>>>>", err.message);
            next(err)
        } )
    }
}

module.exports = asyncHandler;