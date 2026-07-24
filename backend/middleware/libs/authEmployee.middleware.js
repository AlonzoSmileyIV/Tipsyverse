const authEmployee = async (req, res, next) => {
    try {
        if (req.user.role !== 'employee')
            return res.status(403).json({success: false, message: "Employee resources access denied." });
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

export { authEmployee };
