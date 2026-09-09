const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        return Promise.resolve(requestHandler(req, res, next)).catch((err) => {
            if (typeof next === 'function') {
                return next(err);
            }
            console.error("Unhandled error in asyncHandler:", err);
            const statusCode = err.statusCode || err.status || 500;
            if (res && !res.headersSent) {
                return res.status(statusCode).json({
                    success: false,
                    message: err.message || "Internal Server Error",
                    statusCode,
                    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
                });
            }
        });
    };
};

export { asyncHandler };
