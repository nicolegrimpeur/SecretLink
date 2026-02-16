import express from "express";
import helmet from 'helmet';
import cors from 'cors';
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import serveIndex from "serve-index";

import {env} from "./modules/shared/env.js";
import {httpLogger} from './modules/shared/logger.js';

import secretLinkRouter from './modules/routes/secretLink/linksRoutes.js';
import secretLinkUserRouter from "./modules/routes/secretLink/userRoutes.js";


const app = express();

import http from "http";

const serverHTTP = http.createServer(app);


app.enable('trust proxy');

app.use(helmet({
    crossOriginResourcePolicy: {policy: 'same-site'},
    contentSecurityPolicy: false, // si tu sers du HTML/CSS statique varié; sinon active et configure
    referrerPolicy: {policy: 'no-referrer'},
}));

app.use('./.well-known', express.static('.well-known'), serveIndex('.well-known'));

app.use(bodyParser.json());

app.use(express.json({limit: '1mb'}));

app.use(cookieParser());

const ALLOWED_ORIGINS = ['http://localhost:8100', 'https://nicob.ovh'];
const corsOptions = {
    origin(origin, cb) {
        if (!origin) return cb(null, true); // postman, curl, etc.
        if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'idempotency-key'],
};

app.use(cors(corsOptions));
app.options('/*path', cors(corsOptions));

app.use(httpLogger);

app.get('/*path', function (req, res, next) {
    /////////// debug
    // const options = {
    //     timeZone: 'Europe/Paris',
    //     year: 'numeric',
    //     month: 'long',
    //     day: 'numeric',
    //     hour: 'numeric',
    //     minute: 'numeric',
    //     second: 'numeric'
    // };
    // const today = new Date();
    // console.log(req.headers['x-forwarded-for'] || req.socket.remoteAddress)
    // console.log('path |', today.toLocaleTimeString("fr-FR", options), '|', req.path);

    const maintenance = env.MAINTENANCE_MODE;

    if (maintenance) {
        // si maintenance
        res.send('Maintenance en cours');
    } else {
        // si pas maintenance, on continue
        next();
    }
});

app.use('/citations', citationsRouter);
app.use('/secretLink/links', secretLinkRouter);
app.use('/secretLink/users', secretLinkUserRouter);
app.use('/', vracRouter);
app.use('/', projetsIonicRouter);
app.use('/', simpleProjectsRouter);

app.get(['/*path', '/'], function (req, res) {
    res.redirect(env.BASE_URL + '/cv/');
});

serverHTTP.listen(env.PORT);

console.log("let's go port : " + env.PORT);
