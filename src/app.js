const path = require('path');
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const timeout = require("connect-timeout");

const urlencodedParser = require('body-parser').urlencoded({ extended: false });
const authMiddleware = require('./middleware/authMiddleware');

const AppError = require('./utils/appError');
const errorController = require('./controllers/errorController');
const mainRoutes = require('./routes/index');

const app = express();

// 1) GLOBAL MIDDLEWARES
// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Server static files
app.use(express.static(path.join(__dirname, 'public')));

// Set security HTTP headers
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

// Development looging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Prevent parameter pollution
app.use(hpp({}));

// Data sanitization agains XSS
app.use(xss());

// Cross Origin
const allowlist = [
    process.env.APP_URL,
];
const corsOptionsDelegate = function (req, callback) {
    let corsOptions;
    if (allowlist.indexOf(req.header('Origin')) !== -1) {
        corsOptions = { origin: true }; // reflect (enable) the requested origin in the CORS response
    } else {
        corsOptions = { origin: false }; // disable CORS for this request
    }
    callback(null, corsOptions); // callback expects two parameters: error and options
};
if (process.env.NODE_ENV !== 'development') {
    app.use(cors(corsOptionsDelegate));
}

app.use(urlencodedParser);

// Handel timeout
app.use(timeout("800s"));
app.use((req, res, next) => {
    if (req.timedout) {
        // Handle timeout errors here
        return next(new AppError(`Request timed out`, 504));
    }
    next();
});

// Parse Bearer token to req.token
app.use(authMiddleware.parseBearerToken);

// Custome middleware
app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
});

// ROUTES
app.use('/v1', mainRoutes);

app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(errorController);

module.exports = app;
