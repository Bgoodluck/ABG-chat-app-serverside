const express = require("express");
const userController = require("../controller/userController");


const router = express.Router();


router.post("/register", userController.registerUser)
router.post("/email", userController.checkEmail)
router.post("/password", userController.checkPassword);
router.get("/user-details", userController.userDetails);
router.get("/logout", userController.logout);
router.post("/update", userController.updateUserDetails);
router.post("/search", userController.searchUser)



module.exports = router