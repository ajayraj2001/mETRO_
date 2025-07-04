// const asyncHandler = (requestHandler) => {  // Used to handle web request
//     return (req, res, next) => {
//         Promise.resolve(requestHandler(req, res, next))
//         .catch( (err) => {
//             console.log("error=====>>>>>", err.message);
//             next(err)
//         } )
//     }
// }

// module.exports = asyncHandler;

const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => {
      console.error("Async Error:", err); // Logs full error with stack trace
      next(err);
    });
  };
};

module.exports = asyncHandler;
