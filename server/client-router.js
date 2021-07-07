"use strict"
const express = require("express");
const path = require("path");

var router = express.Router();

router.route('/*').get((req, res) => {
  res.sendFile(path.resolve("./client/build/index.html"));
});

module.exports = router;
