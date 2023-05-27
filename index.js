const { Datastore } = require('@google-cloud/datastore');
const { DatastoreStore } = require('@google-cloud/connect-datastore');
const express = require("express");
const session = require('express-session');
const adminRouter = require('./admin');
const apiRouter = require('./api');
const entitiesRouter = require('./entities');

const app = express();

const PORT = process.env.PORT || 8080;

const sess = {
  store: new DatastoreStore({
    kind: 'express-sessions',
    expirationMs: 1000 * 60 * 60, // 1h session expiration
    dataset: new Datastore({
      projectId: process.env.GCLOUD_PROJECT,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    })
  }),
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
app.use('/admin', adminRouter);
app.use('/api', apiRouter);
app.use('/entities', entitiesRouter);
app.use(express.static('static'));

// 404 handler
app.get('*', function(req, res){
  res.status(404).send('404 - Are you sure the page you are looking for was here...?');
});

app.listen(PORT, () => {
  console.log("Listening PORT: " + PORT);
  console.log("http://localhost:" + PORT);
});