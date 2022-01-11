require('rootpath')();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorHandler = require('_middleware/error-handler');
const mongoose = require('mongoose');
const Account = require('./accounts/account.model')


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

// allow cors requests from any origin and with credentials
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

// api routes
app.use('/accounts', require('./accounts/accounts.controller'));
app.use('/appreciate', require('./appreciate/appreciate.controller'));
// api routes for search name
// app.get('/search/:name', function(req, res){
//     var regex = new RegExp(req.params.name, 'i');
//     console.log(regex);
//     Account.find({name:regex}).then((result)=>{
//         res.status(200).json(result)
//     })
// })
function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}
function hash(password) {
    return bcrypt.hashSync(password, 10);
}

// swagger docs route
app.use('/api-docs', require('_helpers/swagger'));

// global error handler
app.use(errorHandler);

// start server
const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
app.listen(port, () => {
    console.log('Server listening on port ' + port);
});
