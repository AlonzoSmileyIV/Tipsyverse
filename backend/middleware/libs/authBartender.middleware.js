const authBartender = async (req, res, next) => {
    try {
        if (!['employee','bartender'].includes(req?.user?.role))
            return res.status(403).json({success: false, message: "Bartender resources access denied." });
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

export { authBartender };
