var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var User = require('../models/User');

module.exports = function(passport){
    passport.use(
        new LocalStrategy({ usernameField: 'email'}, function(email, password,done){
            User.findOne({ email : email}).then(function(user){
                if(!user){
                    return done(null, false, { message: "Username is Incorrect!"});
                }

                bcrypt.compare(password, user.password, function(error, isMatch){
                    if(error){
                        throw error;
                    }

                    if(isMatch){
                        return done(null, user);
                    }
                    else{
                        return done(null, false, { message: "Password is Incorrect!"});
                    }
                });
            }).catch(function(error){
                console.log(error);
            });
        })
    );

    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });
      
    passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
          done(err, user);
        });
    });
}

