const mongoose = require("mongoose");
const config = require("./config");

async function connectDb() {
  console.log("Mongo URI:", config.mongoUri);

  mongoose.set("strictQuery", true);

  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
}

module.exports = { connectDb };
