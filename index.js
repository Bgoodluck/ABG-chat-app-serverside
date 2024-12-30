const express = require("express");
const cors = require("cors");
require("dotenv").config()
const connectDB = require("./config/connectDB")
const userRoute = require("./routes/userRoute")
const messageRoute = require("./routes/messageRoute")
const conversationRoute = require("./routes/conversationRoute")
const cookiesParser = require("cookie-parser")
const { app, server } = require("./socket/index")


// const app = express();

app.use(express.json());

app.use(cookiesParser()); // Add this line before using any middleware that uses cookies.



app.use(cors({
    origin: process.env.FRONTEND_URL,
    allowedHeaders: ["Content-Type", "Authorization", "auth-token", "token"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
}));


app.use("/api/user",userRoute)
app.use("/api/message", messageRoute)
app.use("/api/messages", conversationRoute)

const PORT = process.env.PORT || 8282

app.get("/",(req, res)=>{
    res.send("Hello World from the server");
})

connectDB().then(()=>{
    server.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
})
})
