const config = require('config.json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require("crypto");
const sendEmail = require('_helpers/send-email');
const db = require('_helpers/db');
const Role = require('_helpers/role');
const { any } = require('joi');

module.exports = {
    sendAppreciate,
    appreciatePage,
    getAll,
    getRecievedAppreciate,
    getSentAppreciate
};


async function getAll() {
    const appreciate = await db.Appreciate.find().sort({ "created": -1 });
    return appreciate;
}
//Get all with Pagination 
async function appreciatePage() {
    const appreciate = await db.Appreciate.find().skip(skip).limit(limit).sort({ "created": -1 });;
    return appreciate;
}

async function sendAppreciate(params, origin) {
    // create appreciate object
    console.log("params :", JSON.stringify(params))
    const appreciate = new db.Appreciate(params);
    // save account
    await appreciate.save();

    // send email
    await sendAppreciateEmail(params, origin);
}
async function getSentAppreciate(id) {
    let query = { "employeeId": id }
    const appreciate = await db.Appreciate.find(query).sort({ "created": -1 });;
    return appreciate;
}
async function getRecievedAppreciate(id) {
    let query = { "reciever.employeeId": id }
    const appreciate = await db.Appreciate.find(query).sort({ "created": -1 });;
    return appreciate;
}


async function sendAppreciateEmail(params, origin) {
    let sendMessage;
    let recieveMessage = ''


    sendMessage = `<p>Dear ${params.name}</p>
                   <p>An eCard has been sent to the following recipients:</p>
                   ${params.reciever[0].name}
                   <p>Thank you.</p>`;
    recieveMessage =`<h2>${params.title}</h2>
                    <p>To : ${params.reciever[0].name}</p>
                    <p>${params.message}</p>
                    <p>From : ${params.name}</p>
                    <p>Recieved On :${new Date()}</p>`
    await sendEmail({
        to: params.email,
        subject: 'Your eCard has been sent',
        html: `${sendMessage}`
    });
    await sendEmail({
        to: params.reciever[0].email,
        subject: 'You have received a new eCard',
        html: `<img src="cid:logo1"/> <br/>${recieveMessage}`,
        attachments: [{
            filename: 'model.png',
            path: __dirname + `./model.png`,
            cid: 'logo1' //same cid value as in the html img src
        }]
    });
}