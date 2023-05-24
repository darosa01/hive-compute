const express = require("express");
const session = require('express-session');
const apiRouter = require('./api');
const entitiesRouter = require('./entities');

const app = express();

const PORT = 8080;

const sess = {
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: {}
}

if (app.get('env') === 'production') {
  sess.cookie.secure = true;
}

app.use(session(sess));
app.use(express.json());
app.use(express.urlencoded({
  extended: true
})); 
app.use('/api', apiRouter);
app.use('/entities', entitiesRouter);
app.use(express.static('src'));

// 404 handler
app.get('*', function(req, res){
  res.status(404).send('404 - Are you sure the page you are looking for was here...?');
});

app.listen(PORT, () => {
  console.log("Listening PORT: " + PORT);
  console.log("http://localhost:" + PORT);
});