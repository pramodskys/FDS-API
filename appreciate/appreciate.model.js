const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    employeeId:{ type: String, required: true },
      name:{ type: String, required: true },
      email:{ type: String, required: true },
      message:{ type: String, required: true },
      title:{ type: String, required: true },
      description:{ type: String, required: true },
      image:{ type: String, required: true },
      type:{ type: String, required: true},
      reciever:{ type: Array, required: true },
      created: { type: Date, default: Date.now }
});

schema.virtual('isVerified').get(function () {
    // console.log(this.verified + 'in model')
    return !!(this.verified || this.passwordReset);
});

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
});

module.exports = mongoose.model('Appreciate', schema);