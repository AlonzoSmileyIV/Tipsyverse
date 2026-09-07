const authEmployee = async (req, res, next) => {
    try {
        if (!["admin", "employee"].includes(req.user?.role))
            return res.status(403).json({success: false, message: "Staff resources access denied." });
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

export { authEmployee };
