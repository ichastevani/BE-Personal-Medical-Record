const AppError = require("../utils/appError");

const sendErrorDev = (err, req, res) => {
  let message = err.message;

  if (err.cause) {
    message = err.cause.message;
  }
  else if (err.innerError) {
    message = err.innerError.message;
  }

  return res.status(err.statusCode).json({
    status: err.status,
    error: err,
    devMode: true,
    message: message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, req, res) => {
  // 1a) Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  // Programming or other unknown error: don't leak error details
  // 2a) Log error
  console.error("ERROR: 🔥", err);
  // 2b) Send generic message
  return res.status(500).json({
    status: "error",
    message: "Something went very wrong!",
  });
};

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.APP_DEBUG === "true") {
    console.error("ERROR: 🔥", err);
    sendErrorDev(err, req, res);
  } else {
    let error = err;

    if (error.name.includes("ValidationError")) {
      error = handleValidationError(error);
    }

    else if (error.name.includes("TransactionRevertInstructionError")) {
      error = handleTransactionRevertInstructionError(error);
    }

    sendErrorProd(error, req, res);
  }
};

const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);

  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

const handleTransactionRevertInstructionError = (err) => {
  return new AppError(err.reason, 402);
}
