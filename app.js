'use strict';
const port = 3000;
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io').listen(server);
const bodyParser = require('body-parser');
const passport = require('passport'), LocalStrategy = require('passport-local').Strategy;
const ensureLogin = require('connect-ensure-login');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const mqtt = require('mqtt');

console.log("Start application ...");

const client  = mqtt.connect('mqtt://eclipse-mosquitto', {
    username: 'admin',
    password: '123456'
});

client.on('connect', function () {
    console.log("MQtt server success connected...");
});

const expressSession = session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
});
const sharedSession = require("express-socket.io-session");

// Authentication strategy
passport.use(new LocalStrategy(async (username, password, callback) => {
    let user = (username === 'admin' && password === '123456') ? {id: 1} : false;
    return callback(null, user);
}));
// Set user ID to session
passport.serializeUser(function (user, cb) {
    cb(null, user.id);
});
// Get user info from db by session ID
passport.deserializeUser(function (id, cb) {
    cb(null, {id: 1});
});

/**
 * Static resources
 */
app.use(express.static('public'));
app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js')); // redirect bootstrap JS
app.use('/js', express.static(__dirname + '/node_modules/vue/dist')); // VUE JS
app.use('/js', express.static(__dirname + '/public')); // Custom JS
app.use('/css', express.static(__dirname + '/public/css')); // Custom css
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css')); // redirect CSS bootstrap
app.use('/css', express.static(__dirname + '/node_modules/font-awesome/css')); // icons
app.use('/fonts', express.static(__dirname + '/node_modules/font-awesome/fonts')); // icons
app.use('/favicon.ico', express.static(__dirname + '/public/favicon.ico')); // favicon
app.use('/images', express.static(__dirname + '/public/profiles')); // User profiles images
app.use('/img', express.static(__dirname + '/public/img')); // User profiles images

// Express application properties.
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

// Parse body to JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(expressSession);
app.use(passport.initialize());
app.use(passport.session());

// Http request - send index file only
app.get('/', ensureLogin.ensureLoggedIn('/login'), (req, res) => res.sendFile(__dirname + '/views/index.html'));
// Get login form
app.get('/login', (req, res) => res.render('login'));
// Try to login
app.post('/login', passport.authenticate('local', {failureRedirect: '/login'}), (req, res) => res.redirect('/'));
// Logout
app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});

/**
 * Web sockets connections
 */
io.use(sharedSession(expressSession));

io.on('connection', function (socket) {
    client.on('message', function (topic, message) {
        socket.emit('message_received', {
            pub: topic,
            message: message.toString(),
            date: new Date()
        });
    });

    let session = socket.handshake.session;
    if (!session.passport || !session.passport.user)
        socket.disconnect("Authorization required");
    socket.on('error', (e) => {
        console.log("Socket error: ", e);
    });

    socket.on('topic', (id) => {
        client.subscribe(id, function (err) {
            if (err)
                socket.emit('topic_error', {id: id, message: err.message});
            else
                socket.emit('subscribed', id);
        });
    });

    socket.on('send', async (data) => {
        data.pubs.forEach((pub) => {
            client.publish(pub, data.message);
        });
    });
});

/**
 * HTTP listener
 */
server.listen(port, function () {
    console.log("Server started in port: " + port);
});