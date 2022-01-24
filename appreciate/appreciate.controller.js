const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const appreciateService = require('./appreciate.service');
const accountService = require('../accounts/account.service');

const authorize = require('_middleware/authorize')


// routes
router.post('/', authorize(),appreciateSchema, appreciate);
router.get('/',authorize(), getAppriciate);
router.get('/posts/:skip/:limit',authorize(), getPosts);
// router.get('/:id',authorize(),getUserAppreciate())
router.get('/recieve/:id', authorize(), getRecievedAppreciate);
router.get('/:id', authorize(), getSentAppreciate);



module.exports = router;

function appreciateSchema(req, res, next) {
    const schema = Joi.object({
        employeeId:Joi.string().required(),
        name:Joi.string().required(),
        email:Joi.string().email().required(),
        employee_role: Joi.string(),
        message:Joi.string().required(),
        title:Joi.string().required(),
        description:Joi.string().required(),
        image:Joi.string().required(),
        type:Joi.string().required(),
        reciever:Joi.array().required(),
    });
    validateRequest(req, next, schema);
}

function getRecievedAppreciate(req, res, next) {
    appreciateService.getRecievedAppreciate(req.params.id)
       .then(appreciate => res.json(appreciate))
       .catch(next);
}
function getSentAppreciate(req, res, next) {
    appreciateService.getSentAppreciate(req.params.id)
       .then(appreciate => res.json(appreciate))
       .catch(next);
}
function appreciate(req, res, next) {
    console.log("req.body",req.body)
    appreciateService.sendAppreciate(req.body, req.get('origin'))
        .then(() => res.json({ message: 'Your card has been sent successfully, please check your email' }))
        .catch(next);
}
function getAppriciate(req, res, next) {
    appreciateService.getAll()
        .then(appreciate => res.json(appreciate))
        .catch(next);
}

function getPosts(req, res, next) {
    let {skip,limit} = req.params
    appreciateService.appreciatePage(skip,limit)
    console.log("skip limit in controller :",skip,limit)
        .then(appreciate => res.json(appreciate))
        .catch(next);
}


