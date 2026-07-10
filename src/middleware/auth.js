const jwt = require("jsonwebtoken");
const config = require("../config");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ message: "Missing auth token" });
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.sub).lean();
    if (!user) return res.status(401).json({ message: "Invalid auth token" });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired auth token" });
  }
}

module.exports = { signToken, requireAuth };
