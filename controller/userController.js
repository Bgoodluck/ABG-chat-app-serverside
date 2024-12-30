const userModel = require("../models/userModel");
const bcryptjs = require("bcryptjs")
const jwt = require("jsonwebtoken");
const getUserDetailsFromToken = require("../helpers/getUserDetailsFromToken");



exports.registerUser = async(req, res)=>{

    try {
        // Validate request body
        const { firstName, lastName, email, password, picture, statusMessage, phone, socialProfiles } = req.body;

        if (!firstName ||!lastName ||!email ||!password ) {
            return res.status(400).json({
                success: false,
                message: 'Please fill all fields'
            });
        }
        // Check if user already exists
        const user = await userModel.findOne({ email });

        if (user) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        const salt = await bcryptjs.genSalt(10)
        const hashedPassword = await bcryptjs.hash(password, salt);

        const payload = {
            firstName,
            lastName,
            email,
            password: hashedPassword,
            picture,
            statusMessage,
            phone,
            socialProfiles: [],
        }

        const newUser = new userModel(payload);
        await newUser.save();

        res.json({
            success: true,
            message: 'User registered successfully',
            data: newUser
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error'
        });
        
    }
}

exports.checkEmail = async(req, res)=>{
    try {

        const { email } = req.body;

        const checkEmail = await userModel.findOne({email}).select("-password")

        if (!checkEmail) {
            return res.status(404).json({
                success: false,
                message: 'Email not found'
            });
        }

        res.json({
            success: true,
            message: 'Email exists',
            data: checkEmail
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error'
        });
        
    }
}



exports.checkPassword = async(req, res)=>{
    try {
        const { password, userId } = req.body;
        console.log("Received password check request:", { userId, passwordLength: password?.length });

        const user = await userModel.findById(userId)
        console.log("Found user:", user ? "Yes" : "No");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isMatch = await bcryptjs.compare(password, user.password);
        console.log("Password match:", isMatch);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Credentials'
            });
        }

        const tokenData = {
            id: user._id,
            email: user.email
        }

        const token = await jwt.sign(tokenData, process.env.JWT_SECRET, { expiresIn: "1d" })

        const cookieOptions = {
            httpOnly: true,  // Changed from http to httpOnly
            secure: true,
            sameSite: 'strict',  // Added for security
            maxAge: 24 * 60 * 60 * 1000  // 1 day in milliseconds
        }

        return res.cookie('token', token, cookieOptions).status(200).json({
            success: true,
            message: 'Login successful',
            token: token
        })
        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error'
        });
    }
}

exports.userDetails = async(req, res)=>{
    try {

        const token = req.headers.authorization || req.cookies.token; // Check both header and cookies


        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const user = await getUserDetailsFromToken(token)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'User details fetched successfully',
            data: user
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error'
        });
        
    }
}


exports.logout = async(req, res)=>{
    try {

        const cookieOptions ={
            http: true,
            secure: true
        }

        return res.cookie('token',"",cookieOptions).status(200).json({
            success: true,
            message: 'Logged out successfully'
        })
        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error'
        });
        
    }
}





exports.updateUserDetails = async(req, res) => {
    try {
        const token = req.headers.authorization || req.cookies.token; // Check both header and cookies

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const user = await getUserDetailsFromToken(token);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { firstName, lastName, picture, statusMessage, phone, socialProfiles } = req.body;
        
        // Create update object with only provided fields
        const updateFields = {};
        if (firstName !== undefined) updateFields.firstName = firstName;
        if (lastName !== undefined) updateFields.lastName = lastName;
        if (picture !== undefined) updateFields.picture = picture;
        if (statusMessage !== undefined) updateFields.statusMessage = statusMessage;
        if (phone !== undefined) updateFields.phone = phone;
        if (socialProfiles !== undefined) updateFields.socialProfiles = socialProfiles;

        // Validate that at least one field is being updated
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields provided for update'
            });
        }

        // Use findByIdAndUpdate to get the updated document in one query
        const updatedUser = await userModel.findByIdAndUpdate(
            user._id,
            updateFields,
            { 
                new: true, // Return updated document
                select: '-password', // Exclude password field
                runValidators: true // Run model validators
            }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'User details updated successfully',
            data: updatedUser
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error'
        });
    }
}



exports.searchUser = async(req, res)=>{
    try {
        const { search } = req.body; // Changed from searchTerm to match frontend

        if (!search) {
            return res.status(200).json({
                success: true,
                message: 'No search term provided',
                users: []
            });
        }

        const query = new RegExp(search, "i")  // Removed "g" flag as it's not needed for this case

        const users = await userModel.find({
            $or: [
                { firstName: query },
                { lastName: query },
                { email: query }
            ]
        }).select("-password") // Don't send password in response

        return res.status(200).json({
            success: true,
            message: 'Users found successfully',
            users: users  // Changed from data to users to match frontend expectation
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error',
            users: []
        });
    }
}