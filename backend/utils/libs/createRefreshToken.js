
import jwt from 'jsonwebtoken';
const createRefreshToken = (payload) => {
    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '8h' });
}

export default createRefreshToken;
