const config = require('config.json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require("crypto");
const sendEmail = require('_helpers/send-email');
const db = require('_helpers/db');
const Role = require('_helpers/role');
var XLSX = require('xlsx');


module.exports = {
    authenticate,
    refreshToken,
    revokeToken,
    register,
    verifyEmail,
    forgotPassword,
    validateResetToken,
    resetPassword,
    getAll,
    getById,
    create,
    update,
    delete: _delete,
    searchUsers,
    insertAll
};

async function authenticate({ email, password, ipAddress }) {
    const account = await db.Account.findOne({ email });
    console.log("account in service :",account)
    if (!account || !account.isVerified || !bcrypt.compareSync(password, account.passwordHash)) {
        throw 'Email or password is incorrect';
    }

    // authentication successful so generate jwt and refresh tokens
    const jwtToken = generateJwtToken(account);
    const refreshToken = generateRefreshToken(account, ipAddress);

    // save refresh token
    await refreshToken.save();

    // return basic details and tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: refreshToken.token
    };
}

async function refreshToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);
    const { account } = refreshToken;

    // replace old refresh token with a new one and save
    const newRefreshToken = generateRefreshToken(account, ipAddress);
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    await refreshToken.save();
    await newRefreshToken.save();

    // generate new jwt
    const jwtToken = generateJwtToken(account);

    // return basic details and tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: newRefreshToken.token
    };
}

async function revokeToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);

    // revoke token and save
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    await refreshToken.save();
}

async function insertAll(){
//Reading XLSX data and storing it in variable
    var workbook = XLSX.readFile('sample.xlsx');
    var sheet_name_list = workbook.SheetNames;
    var json_sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list])
    console.log("json_sheet",json_sheet)   
    let len = json_sheet.length;
    let email_arr = []
    let i = 0;
    //Parsing data and updating it(password,verified)
    while(i < len){
        let randomstring = Math.random().toString(36).slice(-8);
       let email_obj = {user :json_sheet[i].fullName,password:randomstring,email:json_sheet[i].email}
       email_arr.push(email_obj)
        json_sheet[i].verificationToken = randomTokenString();
        json_sheet[i].passwordHash = hash(randomstring);
        json_sheet[i].verified = new Date
        i++;
    }
    console.log("json_sheet parsed :",json_sheet)   
    
//Writing parsed data(email,user,password) to XLSX sheet
    // var work_sheet = XLSX.utils.json_to_sheet(email_arr)
    // var workBook = XLSX.utils.book_new();
    // XLSX.utils.book_append_sheet(workBook, work_sheet, "Send Email Catalog");
    // XLSX.write(workBook, {bookType: 'xlsx', type: 'buffer'})
    // XLSX.write(workBook, {bookType: 'xlsx', type: 'binary'})
    // XLSX.writeFile(workBook, 'send_email.xlsx')
    
//Inserting all data to Mongo Atlasz
if(await db.Account.insertMany(json_sheet)){
    await sendRegisteredSuccesAll(email_arr)
}
//     db.Account.insertMany(json_sheet, function(error, docs) {
//     if(error){
//         console.log("error :",error)
//     }
//     //On succes Send email to All users using nodemailer
//     console.log("docs :",docs)
//     await sendRegisteredSuccesAll(email_arr,origin)
//     res.status(200).json(json_sheet)
// });
}

async function register(params, origin) {
    // validate
    if (await db.Account.findOne({ email: params.email })) {
        // send already registered error in email to prevent account enumeration
        return await sendAlreadyRegisteredEmail(params.email, origin);
    }

    // create account object
    const account = new db.Account(params);

    // first registered account is an admin
    const isFirstAccount = (await db.Account.countDocuments({})) === 0;
    account.role = isFirstAccount ? Role.Admin : Role.User;
    account.verificationToken = randomTokenString();

    // hash password
    account.passwordHash = hash(params.password);

    // save account
    await account.save();

    // send email
    await sendVerificationEmail(account, origin);
}

async function verifyEmail({ token }) {
    const account = await db.Account.findOne({ verificationToken: token });

    if (!account) throw 'Verification failed';

    account.verified = Date.now();
    account.verificationToken = undefined;
    await account.save();
}

async function searchUsers( text ) {
    console.log("text :",text)
    let searchText = {"fullName":{'$regex': text,'$options': 'i'}}
    const account = await db.Account.find(searchText);
    return account;

}



async function forgotPassword({ email }, origin) {
    const account = await db.Account.findOne({ email });
console.log("account :",account)
    // always return ok response to prevent email enumeration
    if (!account) return;

    // create reset token that expires after 24 hours
    account.resetToken = {
        token: randomTokenString(),
        expires: new Date(Date.now() + 24*60*60*1000)
    };
    await account.save();

    // send email
    await sendPasswordResetEmail(account, origin);
}

async function validateResetToken({ token }) {
    const account = await db.Account.findOne({
        'resetToken.token': token,
        'resetToken.expires': { $gt: Date.now() }
    });

    if (!account) throw 'Invalid token';
}

async function resetPassword({ token, password }) {
    const account = await db.Account.findOne({
        'resetToken.token': token,
        'resetToken.expires': { $gt: Date.now() }
    });

    if (!account) throw 'Invalid token';

    // update password and remove reset token
    account.passwordHash = hash(password);
    account.passwordReset = Date.now();
    account.resetToken = undefined;
    await account.save();
}

async function getAll() {
    const accounts = await db.Account.find();
    return accounts.map(x => basicDetails(x));
}

async function getById(id) {
    const account = await getAccount(id);
    return basicDetails(account);
}

async function create(params) {
    // validate
    if (await db.Account.findOne({ email: params.email })) {
        throw 'Email "' + params.email + '" is already registered';
    }

    const account = new db.Account(params);
    account.verified = Date.now();

    // hash password
    account.passwordHash = hash(params.password);

    // save account
    await account.save();

    return basicDetails(account);
}

async function update(id, params) {
    const account = await getAccount(id);

    // validate (if email was changed)
    if (params.email && account.email !== params.email && await db.Account.findOne({ email: params.email })) {
        throw 'Email "' + params.email + '" is already taken';
    }

    // hash password if it was entered
    if (params.password) {
        params.passwordHash = hash(params.password);
    }

    // copy params to account and save
    Object.assign(account, params);
    account.updated = Date.now();
    await account.save();

    return basicDetails(account);
}

async function _delete(id) {
    const account = await getAccount(id);
    await account.remove();
}

// helper functions

async function getAccount(id) {
    console.log('id = ', id);
    if (!db.isValidId(id)) throw 'Account not found';
    const account = await db.Account.findById(id);
    if (!account) throw 'Account not found';
    return account;
}

async function getRefreshToken(token) {
    const refreshToken = await db.RefreshToken.findOne({ token }).populate('account');
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}

function hash(password) {
    return bcrypt.hashSync(password, 10);
}

function generateJwtToken(account) {
    // create a jwt token containing the account id that expires in 15 minutes
    return jwt.sign({ sub: account.id, id: account.id }, config.secret, { expiresIn: '15m' });
}

function generateRefreshToken(account, ipAddress) {
    // create a refresh token that expires in 7 days
    return new db.RefreshToken({
        account: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 7*24*60*60*1000),
        createdByIp: ipAddress
    });
}

function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}

function basicDetails(account) {
    const { id, firstName,fullName, lastName, employeeId, email, role, created, updated, isVerified } = account;
    return { id, firstName,fullName, lastName, employeeId, email, role, created, updated, isVerified };
}

async function sendVerificationEmail(account, origin) {
    let message;
    if (origin) {
        const verifyUrl = `${origin}/account/verify-email?token=${account.verificationToken}`;
        message = `<p>Please click the below link to verify your email address:</p>
                   <p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
    } else {
        message = `<p>Please use the below token to verify your email address with the <code>/account/verify-email</code> api route:</p>
                   <p><code>${account.verificationToken}</code></p>`;
    }

    await sendEmail({
        to: account.email,
        subject: 'Sign-up Verification API - Verify Email',
        html: `<h4>Verify Email</h4>
               <p>Thanks for registering!</p>
               ${message}`
    });
}

async function sendAlreadyRegisteredEmail(email, origin) {
    let message;
    if (origin) {
        message = `<p>If you don't know your password please visit the <a href="${origin}/account/forgot-password">forgot password</a> page.</p>`;
    } else {
        message = `<p>If you don't know your password you can reset it via the <code>/account/forgot-password</code> api route.</p>`;
    }

    await sendEmail({
        to: email,
        subject: 'Sign-up Verification API - Email Already Registered',
        html: `<h4>Email Already Registered</h4>
               <p>Your email <strong>${email}</strong> is already registered.</p>
               ${message}`
    });
}

async function sendPasswordResetEmail(account, origin) {
    let message;
    if (origin) {
        const resetUrl = `${origin}/account/reset-password?token=${account.resetToken.token}`;
        message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>`;
    } else {
        message = `<p>Please use the below token to reset your password with the <code>/account/reset-password</code> api route:</p>
                   <p><code>${account.resetToken.token}</code></p>`;
    }

    await sendEmail({
        to: account.email,
        subject: 'Sign-up Verification API - Reset Password',
        html: `<h4>Reset Password Email</h4>
               ${message}`
    });
}

async function sendRegisteredSuccesAll(account) {
    let i = 0
    let len = account.length;
    var user = null
    let url = 'https://appreciateday.int.thomsonreuters.com/'
    while(i<len){
        user = account[i]
        let message = `<p>Hi ${user.user},</p>
            <p>Welcome to Appreciate App!</p>
             <p>Please use the below credentials to login to the app</p>
             <p><a href="${url}">Login</a></p>
             <p>User name : ${user.email}</p>
             <p>Password : ${user.password}</p>`;
     
        await sendEmail({
                    to: user.email,
                    subject: 'Appreciate day 2022 - Login details',
                    html: `<h4>Reset Password Email</h4>
                           ${message}`
                });
        i++;
    }
}
