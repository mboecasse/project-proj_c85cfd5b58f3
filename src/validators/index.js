// File: src/validators/index.js
// Generated: 2025-10-16 10:47:53 UTC
// Project ID: proj_c85cfd5b58f3
// Task ID: task_vu0addwq9htm


const auth = require('./auth.validator');


const cart = require('./cart.validator');


const order = require('./order.validator');


const product = require('./product.validator');

module.exports = {
  auth,
  cart,
  product,
  order
};
