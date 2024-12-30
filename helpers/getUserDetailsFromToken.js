const jwt = require("jsonwebtoken")
const userModel = require("../models/userModel")

const getUserDetailsFromToken = async(token)=>{

    try {

        if (!token) {
            return {
                message: "session out",
                logout: true
            }        
        }
        const decodedToken = await jwt.verify(token, process.env.JWT_SECRET)

        if (!decodedToken) {
            return {
                message: "session out",
                logout: true
            }
        }

        const user = await userModel.findById(decodedToken.id).select("-password")

        if (!user) {
            return {
                message: "session out",
                logout: true
            }
        }

        return user;
        
    } catch (error) {
        console.error(error);
        // res.status(500).json({
        //     success: false,
        //     message: error.message || 'Server Error'
        // });
        
    }
}

module.exports = getUserDetailsFromToken;