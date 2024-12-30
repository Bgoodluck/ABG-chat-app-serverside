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


// getUserDetailsFromToken.js
// const jwt = require("jsonwebtoken");
// const userModel = require("../models/userModel");

// const getUserDetailsFromToken = async (token) => {
//     try {
//         // Check if token exists
//         if (!token) {
//             throw new Error('No token provided');
//         }

//         // Verify token and decode
//         const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        
//         if (!decodedToken || !decodedToken.id) {
//             throw new Error('Invalid token structure');
//         }

//         // Find user
//         const user = await userModel.findById(decodedToken.id)
//             .select("-password")
//             .lean();  // Use lean() for better performance

//         if (!user) {
//             throw new Error('User not found');
//         }

//         return {
//             success: true,
//             data: user
//         };
        
//     } catch (error) {
//         console.error('Token verification error:', error.message);
        
//         // Determine the type of error for proper response
//         if (error.name === 'JsonWebTokenError') {
//             return {
//                 success: false,
//                 message: 'Invalid token',
//                 logout: true
//             };
//         }
        
//         if (error.name === 'TokenExpiredError') {
//             return {
//                 success: false,
//                 message: 'Token expired',
//                 logout: true
//             };
//         }

//         return {
//             success: false,
//             message: 'Authentication failed',
//             logout: true
//         };
//     }
// };

// module.exports = getUserDetailsFromToken;