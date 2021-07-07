"use strict"
const express = require("express");
const path = require("path");

var router = express.Router();

const options = { root: __dirname };

router.route('*').get((req, res) => {
  res.sendFile(path.resolve('./public/index.html'));
});

module.exports = router;
