const errorHandler = (err, req, res, next) => {
    if (err) return res.status(500).json({
        message: `Error on server: ${err}`
    });
}

export default errorHandler;