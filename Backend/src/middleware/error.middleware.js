const errorHandler = (err, req, res, next) => {
    let { statusCode, message } = err;

    if (!err.success && !statusCode) {
        statusCode = 500;
        message = err.message || "Internal Server Error";
    }

    res.locals.errorMessage = err.message;

    const response = {
        statusCode,
        message,
        success: false,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    };

    res.status(statusCode || 500).json(response);
};

export { errorHandler };
